import { Dialog } from "@jupyterlab/apputils";
import { nodState } from "./state";
import { NotebookPanel } from '@jupyterlab/notebook';
import { getNodInfo, getNodKernel, launchNodKernel } from "./kernelHelpers";
import { Throttler } from '@lumino/polling';

export function kernelWaitDialog(checkKernel: boolean = true) {
    if (nodState.Instance().status == 'active') {
        return
    }
    console.log("dialogID", nodState.Instance().dialogID)
    if (nodState.Instance().dialogID === "") {
        const dialog = new Dialog({
            title: "Waiting for Nod Kernel...",
            body: "Call notebook() from a Python file in the same directory",
            buttons: [Dialog.okButton({ label: "Refresh" })]
        });
        nodState.Instance().dialogID = dialog.id
        dialog.launch().then(() => {
            console.log("DIALOG LAUNCH")
            if (checkKernel)
                checkKernelStatus.invoke()
        });
    }
}

export const checkKernelStatus = new Throttler(checkKernelStatusInner, { limit: 100, edge: 'trailing' })
async function checkKernelStatusInner() {
    console.log("Check Kernel Status")
    const manager = nodState.Instance().app.serviceManager.kernels
    await manager.refreshRunning().then(() => {
        getNodKernel().then(async (id) => {
            if (id === undefined) {
                console.log("setting to inactive")
                nodState.Instance().status = 'inactive'
                const launchPromise = launchNodKernel().then(() => checkKernelStatus.invoke())
                kernelWaitDialog()
                await launchPromise
            } else {
                console.log("REFRESHING NOD STATE Found Nod Kernel")
                const idSearch = Dialog.tracker.find(dialog => dialog.id === nodState.Instance().dialogID)
                if (idSearch !== undefined) {
                    idSearch.resolve()
                }
                nodState.Instance().dialogID = ""
                nodState.Instance().activateSidebars()
                await getNodInfo()
            }
        })
    })

}
export function updateLockedUI(panel: NotebookPanel) {
    const state = nodState.Instance()
    if (nodState.Instance().locked && panel.id !== nodState.Instance().notebookLockId) {
        panel.content.widgets.forEach(cell => cell.model.setMetadata("editable", false))
        if (!panel.contentHeader.contains(state.readOnlyHeader)) {
            console.log('adding widget')
            panel.contentHeader.addWidget(state.readOnlyHeader);
        }
        state.readOnlyHeader.setHidden(false)
    } else {
        panel.content.widgets.forEach(cell => cell.model.setMetadata("editable", true))
        state.readOnlyHeader.setHidden(true)
        const model = panel.content.model
        if (model !== null) {
            for (const cell of model.cells) {
                cell.sharedModel.changed.connect((cell, change) => {
                    if (change.sourceChange) {
                        console.log("Cell source change", change, cell)
                        if (!nodState.Instance().locked) {
                            nodState.Instance().lock(panel)
                            updateLockedUI(panel)
                        }
                    }
                }, nodState.Instance().app)
            }
        }
    }
}

export function onCurrentNotebookChanged(panel: NotebookPanel) {

    const frame = nodState.Instance().getFrameFromPath(panel.context.path)
    if (frame) {
        const newIndex = nodState.Instance().pythonInfo?.stack_info.indexOf(frame)
        console.log("new index", newIndex)
        if (newIndex !== undefined)
            nodState.Instance().currentFrameIndex = newIndex
    }

    updateLockedUI(panel)
    panel.content.model?.cells.changed.connect((cellList, changeArgs) => {
        if (panel.isRevealed) { //this means its a user-edit
            updateLockedUI(panel)
        }
    })
}