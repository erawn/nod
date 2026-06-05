import { nodState } from "./state";
import {
    INotebookTracker,
    NotebookPanel,
    NotebookTracker,
} from '@jupyterlab/notebook';
function updateLockedUI(panel: NotebookPanel) {
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