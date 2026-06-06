import { IDocumentManager } from "@jupyterlab/docmanager";
import { nodState } from "./state";
import { nodSchema } from "./types";

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
    console.log(Array.from(kernelManager.running()))
    const oldKernelId = nodState.Instance().nodKernelId
    const oldNodKernel = Array.from(kernelManager.running())
        .find(val =>
            val.name === "nod" &&
            val.id === oldKernelId &&
            val.execution_state &&
            (['idle', 'busy', 'starting', 'connected', 'connecting', 'restarting'].includes(val.execution_state)))
    if (oldNodKernel) {
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


export function getNodInfo() {
    const contentsManager = nodState.Instance().contentsManager
    contentsManager.get(contentsManager.normalize(nodState.Instance().connection_dir + "/nodInfo.json"), { type: 'file', format: 'base64', content: true })
        .then(file => {
            const jsonObj = JSON.parse(atob(file.content))
            const schema = nodSchema.parse(jsonObj)
            console.log(schema)
            if (nodState.Instance().status !== 'active') {
                nodState.Instance().pythonInfo = schema
                nodState.Instance().status = 'active'
            }
        })
}