
import { KernelMessage } from '@jupyterlab/services';

import '../style/index.css';

import { nodState } from './state';
import { nodSchema } from './types';

import {
    Contents,
} from '@jupyterlab/services'
import { IShellFuture } from '@jupyterlab/services/lib/kernel/kernel';
import { IExecuteReplyMsg, IExecuteRequestMsg } from '@jupyterlab/services/lib/kernel/messages';

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

export async function resetState() {
    const future = requestExecute(`get_ipython().reset_selective(r"^(?!__STARTINGVARIABLES$).*$")`)
    if (future !== null) {
        future.onIOPub = msg => {
            console.log("resetState")
            console.log(msg)
        }
        return future.done
    }
    return null
}

export async function exitSession() {
    const future = requestExecute('exit')
    if (future !== null) {
        future.onReply = msg => {
            nodState.Instance().app.commands.execute('notebook:close-and-shutdown')
        }
    }
    return
}

export async function checkNodInfo(): Promise<KernelMessage.IExecuteReplyMsg | null> {
    const future = requestExecute('print(__NODINFO)')
    if (future !== null) {
        future.onIOPub = msg => {
            if (
                msg.header.msg_type !== 'status' &&
                msg.header.msg_type !== 'stream'
            ) {
                console.log('requestExecute', msg.header.msg_type, msg.content);
            }
            if (KernelMessage.isStreamMsg(msg)) {
                const result = msg as KernelMessage.IStreamMsg;
                if (
                    result.content.name === "stdout"
                ) {
                    console.log("setting active")
                    try {
                        const jsonObj = JSON.parse(result.content.text)
                        const schema = nodSchema.parse(jsonObj)
                        nodState.Instance().pythonInfo = schema
                        nodState.Instance().status = 'active'
                        console.log(schema)
                    } catch (err) {
                        console.log(err)
                    }
                    //TODO: Find condition on failure
                } else if (result.content.text.search('') >= 0) {
                    nodState.Instance().status = 'inactive'
                } else {
                    console.log('found weird message!', msg);
                }
            }
        };
        return future.done
    }
    return null
}

export function writeChange() {

    const sourceFile = nodState.Instance().pythonInfo?.sourceFile
    const children = nodState.Instance().tracker.currentWidget?.content.widgets
    const indent = nodState.Instance().pythonInfo?.indent
    if (children === undefined || sourceFile === undefined || indent === undefined) {
        return
    }

    const toExport = children.map((cell, index) => {
        return !cell.hasClass('nod-export') ?
            cell?.model.sharedModel.getSource().split('\n')
                .map(line => " ".repeat(indent).concat(line))
                .join('\n').concat(index === children.length - 1 ? "" : '\n\n')
            : ""
    }).join('')
    console.log("TO EXPORT", toExport)

    const contentsManager = nodState.Instance().contentsManager

    contentsManager.get(sourceFile, { type: "file", content: true }).then(original => {

        let lines = (original.content as string).split(/\r?\n/)
        const editPos = nodState.Instance().pythonInfo?.funcBodyPosition
        if (editPos === undefined) {
            return
        }
        console.log("LINES", lines)
        console.log("EDITPOS", editPos)
        const newFileContent = [lines.slice(0, editPos[0]).join('\n'), toExport, lines.slice(editPos[1]).join('\n')].join('\n')
        console.log("NEW FILE", newFileContent)
        const newModel = {
            ...original,
            content: newFileContent
        } as Contents.IModel;
        return contentsManager.save(sourceFile, newModel)
    }).then(() => {
        exitSession()

    }).then(() => {

    }).catch((err) => {
        console.log(err)
    })


}