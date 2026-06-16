import { KernelMessage } from '@jupyterlab/services';

// import '../style/index.css';

import { nodState } from './state';
import { NotebookPanel } from '@jupyterlab/notebook';
import {
  IControlFuture,
  IShellFuture
} from '@jupyterlab/services/lib/kernel/kernel';
import {
  IExecuteReplyMsg,
  IExecuteRequestMsg
} from '@jupyterlab/services/lib/kernel/messages';
import { requestAPI } from './request';
import { getNodKernel } from './kernelHelpers';
import { nodSchema } from './types';

export function requestExecute(
  code: string
): IShellFuture<IExecuteRequestMsg, IExecuteReplyMsg> | null {
  const kernel =
    nodState.Instance().tracker.currentWidget?.sessionContext?.session?.kernel;
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
  return future;
}

export function requestDebug(
  cmd: string,
  stackIndex: number
): IControlFuture<
  KernelMessage.IDebugRequestMsg,
  KernelMessage.IDebugReplyMsg
> | null {
  const kernel =
    nodState.Instance().tracker.currentWidget?.sessionContext?.session?.kernel;
  if (!kernel) {
    return null;
  }
  const message = {
    type: 'request' as const,
    seq: 0,
    command: cmd,
    arguments: { stackIndex }
  };
  const future = kernel.requestDebug(message);
  if (future !== null) {
    future.onReply = async msg => {
      console.log('REQUEST DEBUG RESPONSE', msg);
    };
  }
  return future;
}

export async function exitSession(id: string) {
  const state = nodState.Instance()
  const kernelManager = nodState.Instance().app.serviceManager.kernels;
  const nodKernel = await kernelManager.findById(id)
  if (nodKernel !== undefined) {
    await kernelManager.shutdown(id)
    await kernelManager.refreshRunning()
  }
  state.mode = 'existing'
}

export async function writeChange(
  panel: NotebookPanel,
  frame: NonNullable<nodState['currentFrame']>
) {
  const contentsManager = nodState.Instance().contentsManager;
  await nodState.Instance().app.commands.execute('docmanager:save-all');
  await contentsManager
    .get(panel.context.path, { type: 'file', format: 'base64', content: true })
    .then(nb_content => {
      console.debug('nb_content', nb_content);
      const dataToSend = {
        program_info: frame,
        notebookContent: nb_content.content
      };
      console.debug('sending write request: ', dataToSend);
      requestAPI<any>('write_file', {
        body: JSON.stringify(dataToSend),
        method: 'POST'
      })
        .then(reply => {
          console.log("write out successful");
        })
        .catch(reason => {
          console.error(
            `Error on POST /nodpy/write_file ${dataToSend}.\n${reason}`
          );
        });
    });
}

export async function getKernels() {
  // console.log('sending kernels request');
  const res = await requestAPI<any>('kernels', {
    method: 'GET',
  })
    .then(reply => {
      // console.log(reply);
      if (reply === "e30=") {
        return undefined
      }
      if (reply !== undefined && reply !== "") {
        try {
          const jsonObj = JSON.parse(atob(reply));
          const kernelFile = Object.keys(jsonObj).pop()
          const val = Object.values(jsonObj).pop()
          // console.log(kernelFile, val)
          const schema = nodSchema.parse(val);
          return schema
        } catch (e) {
          console.error(
            `Error on POST /nodpy/kernels. Schema Parsing \n${e} , ${reply}`
          );
        }
      }
      return undefined

    })
    .catch(reason => {
      console.error(
        `Error on GET /nodpy/kernels.\n${reason}`
      );
      return undefined
    });
  return res
}

export async function setKernelToOpen(key: string) {
  console.log('sending kernelToOpen');
  const res = await requestAPI<any>('kernels', {
    method: 'POST',
    body: key//JSON.stringify("t"),
  })
    .then(reply => {
      console.log(reply);
    })
    .catch(reason => {
      console.error(
        `Error on POST /nodpy/kernels.\n${reason}`
      );
      return undefined
    });
  return res
}