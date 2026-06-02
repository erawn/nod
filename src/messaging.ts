
import { KernelMessage, ServerConnection } from '@jupyterlab/services';

import '../style/index.css';

import { nodState } from './state';

import {
    Contents,
} from '@jupyterlab/services'
import { IControlFuture, IKernelConnection, IShellFuture } from '@jupyterlab/services/lib/kernel/kernel';
import { IExecuteReplyMsg, IExecuteRequestMsg } from '@jupyterlab/services/lib/kernel/messages';
import { URLExt } from '@jupyterlab/coreutils';
import { showDialog } from '@jupyterlab/apputils';
import { Widget } from '@lumino/widgets';
import { nodSchema } from './types';
import { IDocumentManager } from '@jupyterlab/docmanager';




export async function openNotebookWithNodKernel(notebookFile: string, docManager: IDocumentManager) {
    const state = nodState.Instance()
    // docManager.openOrReveal(notebookFile, 'default', { name: "nod" })
    const normalized = docManager.services.contents.normalize(notebookFile);
    await state.app.serviceManager.kernels.refreshRunning()
    const nodKernelId = await getNodKernel()
    // const existingNotebook = docManager.findWidget(normalized)
    // if (existingNotebook) {
    //     docManager.contextForWidget(existingNotebook).
    // }
    const existingNotebook = state.tracker.find(panel => panel.context.sessionContext.path === notebookFile)
    if (existingNotebook) {
        console.log("Existing Notebook with Path", existingNotebook)
        // existingNotebook.activate()
        // const existingKernelID = existingNotebook.context.sessionContext.session?.kernel?.id
        // const kernel = nodKernels.find((kernel) => kernel.id === existingKernelID)
        // if (nodKernels.length > 0 && kernel) {
        //     // console.log("Opening Existing File", )
        //     // docManager.openOrReveal(notebookFile, 'default', { name: "nod" })
        // }
        // existingNotebook.sessionContext.dispose()
        console.log("Existing Kernel ID", existingNotebook.sessionContext.session?.id)
        console.log("New NOD Kernel", nodKernelId)
        existingNotebook.sessionContext.kernelPreference = { autoStartDefault: false, id: nodKernelId, shutdownOnDispose: false };
        // existingNotebook.sessionContext.initialize().then(() => existingNotebook.context.sessionContext.sessionManager.connectTo())

        state.app.shell.activateById(existingNotebook.id)
        // docManager.openOrReveal(existingNotebook.context.path)
        // docManager.openOrReveal(normalized, 'default', { name: "nod" }, {}, { id: nodKernelId })
        // state.app.listPlugins
    }
    else {
        console.log("opening", normalized)
        //nodKernels.sort((a, b) => a.last_activity - b.last_activity)
        // const nodKernel = nodKernels[0]
        console.log("opening new with id", nodKernelId)

        docManager.openOrReveal(normalized, 'default', { name: "nod" }, {}, { id: nodKernelId })

        // } else {
        //     docManager.openOrReveal(normalized, 'default', { name: "nod" }, {}, {})
        // }
        // }
    }

}

var launching: boolean = false
async function launchNodKernel() {
    const app = nodState.Instance().app
    for (const name in app.serviceManager.kernelspecs.specs?.kernelspecs) {
        const spec = app.serviceManager.kernelspecs.specs?.kernelspecs[name]!;
        if (spec.display_name === 'nod') {
            if (!launching && nodState.Instance().status !== 'active') {
                try {
                    launching = true
                    console.log("Launching Nod Kernel")
                    await app.serviceManager.kernels.startNew(spec).then((connection) => {
                        launching = false
                        nodState.Instance().nodKernelId = connection.model.id
                        console.log(" LAUNCHNODKERNEL: Started Up New Nod!", connection.model.id)
                    })
                    return nodState.Instance().nodKernelId
                }
                catch (e) {
                    console.log(e)
                }
            }
        }
    }
}
export async function getNodKernel() {
    const app = nodState.Instance().app
    // await app.serviceManager.kernelspecs.refreshSpecs()
    const kernelManager = app.serviceManager.kernels
    // await kernelManager.refreshRunning()
    console.log(Array.from(kernelManager.running()))
    const oldKernelId = nodState.Instance().nodKernelId
    const oldNodKernel = Array.from(kernelManager.running())
        .find(val =>
            val.name === "nod" &&
            val.id === oldKernelId &&
            val.execution_state &&
            (['idle', 'busy', 'starting', 'connected', 'connecting', 'restarting'].includes(val.execution_state)))
    if (oldNodKernel) {

    } else {
        const existingNodKernel = Array.from(kernelManager.running())
            .find(val =>
                val.name === "nod" &&
                val.execution_state &&
                (['idle', 'busy', 'starting', 'connected', 'connecting', 'restarting'].includes(val.execution_state)))
        if (existingNodKernel) {
            nodState.Instance().nodKernelId = existingNodKernel.id
        } else {
            await launchNodKernel().then((id => {
                if (id) {
                    return id
                }
            }))
        }
    }
    return nodState.Instance().nodKernelId

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

export function requestExecute(code: string): IShellFuture<IExecuteRequestMsg, IExecuteReplyMsg> | null {
    const kernel = nodState.Instance().tracker.currentWidget?.sessionContext?.session?.kernel;
    if (!kernel) {
        //TODO--throw error
        console.log('Session has no kernel.');
        return null;
    }
    const content: KernelMessage.IExecuteRequestMsg['content'] = {
        code: code,
        silent: true,
        store_history: false
    };
    const future = kernel.requestExecute(content);
    return future

}

export function requestDebug(cmd: string, stackIndex: number): IControlFuture<KernelMessage.IDebugRequestMsg, KernelMessage.IDebugReplyMsg> | null {
    const kernel = nodState.Instance().tracker.currentWidget?.sessionContext?.session?.kernel;
    if (!kernel) {
        return null
    }
    const message = {
        type: "request" as "request",
        seq: 0,
        command: cmd,
        arguments: { stackIndex }
    }
    const future = kernel.requestDebug(message);
    return future
}

export async function exitSession() {
    const future = requestExecute('exit')
    if (future !== null) {
        future.onReply = async msg => {
            const app = nodState.Instance().app
            const trans = nodState.Instance().translator.load('jupyterlab')
            const setting = app.serviceManager.serverSettings;
            const apiURL = URLExt.join(setting.baseUrl, 'api/shutdown');

            // Shutdown all kernel and terminal sessions before shutting down the server
            // If this fails, we continue execution so we can post an api/shutdown request
            try {
                await Promise.all([
                    app.serviceManager.sessions.shutdownAll(),
                    app.serviceManager.terminals.shutdownAll()
                ]);
            } catch (e) {
                // Do nothing
                console.log(`Failed to shutdown sessions and terminals: ${e}`);
            }

            return ServerConnection.makeRequest(
                apiURL,
                { method: 'POST' },
                setting
            )
                .then(result => {
                    if (result.ok) {
                        // Close this window if the shutdown request has been successful
                        const body = document.createElement('div');
                        const p1 = document.createElement('p');
                        p1.textContent = trans.__(
                            'You have shut down the Jupyter server. You can now close this tab.'
                        );
                        const p2 = document.createElement('p');
                        p2.textContent = trans.__(
                            'To use %1 again, you will need to relaunch it.',
                            app.name
                        );

                        body.appendChild(p1);
                        body.appendChild(p2);
                        void showDialog({
                            title: trans.__('Server stopped'),
                            body: new Widget({ node: body }),
                            buttons: []
                        });
                        window.close();
                    } else {
                        throw new ServerConnection.ResponseError(result);
                    }
                })
                .catch(data => {
                    throw new ServerConnection.NetworkError(data);
                });
        }
    }
    return
}

export function writeChange() {
    const instance = nodState.Instance()
    if (instance.currentFrame === null) {
        return
    }
    const currentFrame = instance.currentFrame
    if (currentFrame === undefined) {
        return
    }
    const children = instance.tracker.currentWidget?.content.widgets
    const indent = currentFrame.indent
    if (children === undefined) {
        return
    }

    const toExport = children.map((cell, index) => {
        return !cell.hasClass('nod-export') ?
            cell?.model.sharedModel.getSource().split('\n')
                .map(line => " ".repeat(indent).concat(line))
                .join('\n').concat(index === children.length - 1 ? "" : '\n\n')
            : ""
    }).join('')

    console.log('path', nodState.Instance().tracker.currentWidget?.context.path)
    const contentsManager = nodState.Instance().contentsManager
    const sourceFile = contentsManager.normalize(currentFrame.relative_source_file)
    console.log("sourcefile", sourceFile)

    //TODO: Rewrite this --- pass in top text and bottom text at start so we can't run into alignment, overwriting issues like this.
    contentsManager.get(sourceFile, { type: "file", content: true }).then(original => {
        const instance = nodState.Instance()
        if (instance.currentFrame === null) {
            return
        }
        let lines = (original.content as string).split(/\r?\n/)
        const editPos = currentFrame.function_body_position
        console.log("LINES", lines)
        console.log("EDITPOS", editPos)
        const topContent = lines.slice(0, editPos?.start.line - 1).join('\n')
        const bottomContent = lines.slice(editPos.end.line).join('\n')
        console.log(topContent)
        console.log("TO EXPORT", toExport)
        console.log(bottomContent)
        const newFileContent = [topContent, toExport, bottomContent].join('\n')
        console.log("NEW FILE", newFileContent)
        const newModel = {
            ...original,
            content: newFileContent
        } as Contents.IModel;
        return contentsManager.save(sourceFile, newModel)
    }).catch((err) => {
        console.log(err)
    })
}