import { IDocumentManager } from "@jupyterlab/docmanager";
import { nodState } from "./state";
import { nodSchema } from "./types";
import { Dialog, ISessionContext, showDialog } from "@jupyterlab/apputils";
import { checkKernelStatus, kernelWaitDialog } from "./interfaceHelpers";
import { writeChange } from "./messaging";

export async function openNotebookWithNodKernel(notebookFile: string, docManager: IDocumentManager) {
    const state = nodState.Instance()
    const normalized = docManager.services.contents.normalize(notebookFile);
    await state.app.serviceManager.kernels.refreshRunning()
    const nodKernelId = await getNodKernel()

    const existingNotebook = state.tracker.find(panel => panel.context.sessionContext.path === notebookFile)
    if (existingNotebook) {
        console.log("Existing Notebook with Path", existingNotebook)
        existingNotebook.sessionContext.kernelPreference = { autoStartDefault: false, id: nodKernelId, shutdownOnDispose: false };
        state.app.shell.activateById(existingNotebook.id)
    }
    else {
        console.log("opening", normalized, nodKernelId)
        docManager.openOrReveal(normalized, 'default', { name: "nod" }, {}, { id: nodKernelId })
    }
}
export async function getNodKernel(): Promise<string | undefined> {
    const app = nodState.Instance().app
    const kernelManager = app.serviceManager.kernels
    console.log("Current Nod Kernels ", Array.from(kernelManager.running()))
    const oldKernelId = nodState.Instance().nodKernelId
    const oldNodKernel = Array.from(kernelManager.running())
        .find(val =>
            val.name === "nod" &&
            val.id === oldKernelId &&
            val.execution_state &&
            (['idle', 'busy', 'starting', 'connected', 'connecting', 'restarting'].includes(val.execution_state)))
    if (oldNodKernel) {
        console.log("found existing kernel with id and status", oldKernelId, oldNodKernel.execution_state)
        return nodState.Instance().nodKernelId
    } else {
        const existingNodKernel = Array.from(kernelManager.running())
            .find(val =>
                val.name === "nod" &&
                val.execution_state &&
                (['idle', 'busy', 'starting', 'connected', 'connecting', 'restarting'].includes(val.execution_state)))
        if (existingNodKernel) {
            nodState.Instance().nodKernelId = existingNodKernel.id
        } else {
            return undefined
        }
    }
    return nodState.Instance().nodKernelId
}

var launching: boolean = false
export async function launchNodKernel() {
    console.log("launch nod kernel enter")
    const app = nodState.Instance().app
    for (const name in app.serviceManager.kernelspecs.specs?.kernelspecs) {
        const spec = app.serviceManager.kernelspecs.specs?.kernelspecs[name]!;
        if (spec.display_name === 'nod') {
            if (!launching && nodState.Instance().status !== 'active') {
                try {
                    launching = true
                    console.log("Launching Nod Kernel")
                    await app.serviceManager.kernels.startNew({ ...spec }).then((connection) => {
                        launching = false
                        nodState.Instance().nodKernelId = connection.model.id
                        console.log(" LAUNCHNODKERNEL: Started Up New Nod!", connection.model.id)
                    })
                    return nodState.Instance().nodKernelId
                }
                catch (e) {
                    console.log(e)
                    return undefined
                }
            }
        }
    }
    return undefined
}


export async function getNodInfo() {
    const contentsManager = nodState.Instance().contentsManager
    const file = await contentsManager.get(contentsManager.normalize(nodState.Instance().connection_dir + "/nodInfo.json"), { type: 'file', format: 'base64', content: true })
    const jsonObj = JSON.parse(atob(file.content))
    const schema = nodSchema.parse(jsonObj)
    console.log(schema)
    if (nodState.Instance().status !== 'active') {
        console.log("REFRESHING NOD STATE Found Nod Kernel")
        nodState.Instance().pythonInfo = schema
        nodState.Instance().status = 'active'
        nodState.Instance().dialogID = ""
        nodState.Instance().activateSidebars()
    }
}

/**
 * Restart the session.
 *
 * @returns A promise that resolves with whether the kernel has restarted.
 *
 * #### Notes
 * If there is a running kernel, present a dialog.
 * If there is no kernel, we start a kernel with the last run
 * kernel name and resolves with `true`.
 */
export async function default_restart(
    sessionContext: ISessionContext,
    restartOptions?: ISessionContext.IRestartOptions
): Promise<boolean> {
    const trans = nodState.Instance().translator.load('jupyterlab');

    await sessionContext.initialize();
    if (sessionContext.isDisposed) {
        throw new Error('session already disposed');
    }
    const kernel = sessionContext.session?.kernel;
    if (!kernel && sessionContext.prevKernelName) {
        await sessionContext.changeKernel({
            name: sessionContext.prevKernelName
        });
        return true;
    }
    // Bail if there is no previous kernel to start.
    if (!kernel) {
        throw new Error('No kernel to restart');
    }

    // Skip the dialog and restart the kernel
    const kernelPluginId = '@jupyterlab/apputils-extension:sessionDialogs';
    const skipKernelRestartDialog =
        sessionContext.kernelPreference?.skipKernelRestartDialog ?? false;
    const skipKernelRestartDialogSetting = (
        await nodState.Instance().settingRegistry?.get(
            kernelPluginId,
            'skipKernelRestartDialog'
        )
    )?.composite as boolean;
    if (skipKernelRestartDialogSetting || skipKernelRestartDialog) {
        await sessionContext.restartKernel();
        return true;
    }

    const restartBtn = Dialog.warnButton({
        label: trans.__('Restart'),
        ariaLabel: trans.__('Confirm Kernel Restart')
    });
    const result = await showDialog({
        title: trans.__('Restart Kernel?'),
        body: trans.__(
            'Do you want to restart the kernel of %1? All variables will be lost.',
            sessionContext.name
        ),
        buttons: [
            Dialog.cancelButton({ ariaLabel: trans.__('Cancel Kernel Restart') }),
            restartBtn
        ],
        checkbox: {
            label: trans.__('Do not ask me again.'),
            caption: trans.__(
                'If checked, the kernel will restart without confirmation prompt in the future; you can change this back in the settings.'
            )
        }
    });

    if (kernel.isDisposed) {
        return false;
    }
    if (result.button.accept) {
        if (typeof result.isChecked === 'boolean' && result.isChecked == true) {
            sessionContext.kernelPreference = {
                ...sessionContext.kernelPreference,
                skipKernelRestartDialog: true
            };
        }
        await restartOptions?.onBeforeRestart();
        await sessionContext.restartKernel();
        return true;
    }
    return false;
}

export async function restart(
    sessionContext: ISessionContext,
    restartOptions?: ISessionContext.IRestartOptions
): Promise<boolean> {
    const trans = nodState.Instance().translator.load('jupyterlab');

    await sessionContext.initialize();
    if (sessionContext.isDisposed) {
        throw new Error('session already disposed');
    }
    console.log("session context", sessionContext)
    const kernel = sessionContext.session?.kernel;
    console.log("NOD RESTART", kernel?.name)

    if (kernel?.name !== 'nod') {
        default_restart(sessionContext, restartOptions)
    }

    if (!kernel && sessionContext.prevKernelName) {
        console.log("no kernel, opening old")
        await sessionContext.changeKernel({
            name: sessionContext.prevKernelName
        });
        return true;
    }
    // Bail if there is no previous kernel to start.
    if (!kernel) {
        throw new Error('No kernel to restart');
    }
    nodState.Instance().status = 'inactive'

    const nodNoSave = Dialog.warnButton({
        label: ('Restart without Export'),
        ariaLabel: ('Confirm Nod Restart without Saving'),
        accept: true,
    })
    const restartBtn = Dialog.createButton({
        label: ('Export and Restart'),
        ariaLabel: ('Confirm Nod Restart')
    })
    const result = await showDialog({
        title: trans.__('Restart Nod Session?'),
        body: trans.__(
            'Do you want to restart the Nod Session of %1? Modifications will be copied back to Source Files.',
            sessionContext.name
        ),
        buttons: [
            Dialog.cancelButton({ ariaLabel: trans.__('Cancel Nod Restart') }),
            nodNoSave,
            restartBtn
        ],
        // checkbox: {
        //     label: trans.__('Do not ask me again.'),
        //     caption: trans.__(
        //         'If checked, the kernel will restart without confirmation prompt in the future; you can change this back in the settings.'
        //     )
        // }
    })
    if (kernel.isDisposed) {
        return false;
    }
    const state = nodState.Instance()

    if (result.button.accept) {
        await nodState.Instance().app.commands.execute('docmanager:save-all')
        if (result.button.label === "Export and Restart") {
            if (state.notebookLockId !== "") {
                const nbToExport = state.tracker.find(panel => panel.id === state.notebookLockId)
                if (nbToExport !== undefined) {
                    const frame = state.getFrameFromPath(nbToExport.context.path)
                    if (frame !== undefined)
                        await writeChange(nbToExport, frame)
                }
            }
        }
        await restartOptions?.onBeforeRestart();
        const restartPromise = sessionContext.restartKernel(); //TODO--let program continue? 
        kernelWaitDialog()
        await restartPromise
        console.log("POST RESTART")
        state.unlock()
        checkKernelStatus()
        return true;
    }
    return false;
}