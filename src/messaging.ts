
import { KernelMessage, ServerConnection } from '@jupyterlab/services';

import '../style/index.css';

import { nodState } from './state';

import {
    Contents,
} from '@jupyterlab/services'
import { IControlFuture, IShellFuture } from '@jupyterlab/services/lib/kernel/kernel';
import { IExecuteReplyMsg, IExecuteRequestMsg } from '@jupyterlab/services/lib/kernel/messages';
import { URLExt } from '@jupyterlab/coreutils';
import { showDialog } from '@jupyterlab/apputils';
import { Widget } from '@lumino/widgets';
import { nodSchema } from './types';

export function getNodInfo() {
    const contentsManager = nodState.Instance().contentsManager
    contentsManager.get(contentsManager.normalize(nodState.Instance().connection_dir + "/nodInfo.json"), { type: 'file', format: 'base64', content: true })
        .then(file => {
            const jsonObj = JSON.parse(atob(file.content))
            const schema = nodSchema.parse(jsonObj)
            console.log(schema)
            nodState.Instance().pythonInfo = schema
            nodState.Instance().status = 'active'
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
    const children = instance.tracker.currentWidget?.content.widgets
    const indent = instance.currentFrame.indent
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
    const sourceFile = contentsManager.normalize(instance.currentFrame.relative_source_file)
    console.log("sourcefile", sourceFile)

    //TODO: Rewrite this --- pass in top text and bottom text at start so we can't run into alignment, overwriting issues like this.
    contentsManager.get(sourceFile, { type: "file", content: true }).then(original => {
        const instance = nodState.Instance()
        if (instance.currentFrame === null) {
            return
        }
        let lines = (original.content as string).split(/\r?\n/)
        const editPos = instance.currentFrame.function_body_position
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