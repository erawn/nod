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

export async function exitSession() {
  const future = requestExecute('exit');
  if (future !== null) {
    future.onReply = async msg => {
      const how_restart = nodState.Instance().pythonInfo?.how_restart;
      if (how_restart !== undefined && how_restart !== 'continue') {
        getNodKernel();
        const kernelManager = nodState.Instance().app.serviceManager.kernels;
        kernelManager.refreshRunning().then(() => {
          kernelManager.running();
          Array.from(kernelManager.running())
            .filter(kernel => {
              kernel.name === 'nod';
            })
            .map(kernel => kernelManager.shutdown(kernel.id));
        });
      }
    };
  }
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
      console.log('nb_content', nb_content);
      const dataToSend = {
        program_info: frame,
        notebookContent: nb_content.content
      };
      console.log('sending write request: ', dataToSend);
      requestAPI<any>('write_file', {
        body: JSON.stringify(dataToSend),
        method: 'POST'
      })
        .then(reply => {
          console.log(reply);
        })
        .catch(reason => {
          console.error(
            `Error on POST /nodpy/write_file ${dataToSend}.\n${reason}`
          );
        });
    });
}
