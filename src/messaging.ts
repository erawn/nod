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
import { nodSchema, nodSchemas } from './types';
import { DebugProtocol } from '@vscode/debugprotocol';
import { PromiseDelegate } from '@lumino/coreutils';
import { IDebugger } from '@jupyterlab/debugger';
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
let _seq = 0;
export async function sendRequest<K extends keyof IDebugger.ISession.Request>(
  command: any,
  args: IDebugger.ISession.Request[K],
  type: K | any
): Promise<IDebugger.ISession.Response[K]> {
  const message = await _sendDebugMessage({
    type: 'request',
    seq: _seq++,
    command,
    arguments: args
  });
  return message.content as IDebugger.ISession.Response[K];
}
async function _sendDebugMessage(
  msg: KernelMessage.IDebugRequestMsg['content']
): Promise<KernelMessage.IDebugReplyMsg> {
  const kernel =
    nodState.Instance().tracker.currentWidget?.sessionContext?.session?.kernel;
  if (!kernel) {
    return Promise.reject(
      new Error('A kernel is required to send debug messages.')
    );
  }
  const reply = new PromiseDelegate<KernelMessage.IDebugReplyMsg>();
  const future = kernel.requestDebug(msg);
  future.onReply = (msg: KernelMessage.IDebugReplyMsg): void => {
    reply.resolve(msg);
  };
  await future.done;
  return reply.promise;
}
export function requestDebug(
  cmd: string,
  args: any
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
    arguments: args
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
  const state = nodState.Instance();
  const kernelManager = nodState.Instance().app.serviceManager.kernels;
  const nodKernel = await kernelManager.findById(id);
  if (nodKernel !== undefined) {
    await kernelManager.shutdown(id);
    await kernelManager.refreshRunning();
  }
  state.mode = 'existing';
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
          console.log('write out successful');
        })
        .catch(reason => {
          console.error(
            `Error on POST /nodpy/write_file ${dataToSend}.\n${reason}`
          );
        });
    });
}

export async function getKernels(): Promise<nodSchemas | undefined> {
  // console.log('sending kernels request');
  const res = await requestAPI<any>('kernels', {
    method: 'GET'
  })
    .then(reply => {
      // console.log(reply);
      if (reply === 'e30=') {
        return undefined;
      }
      if (reply !== undefined && reply !== '') {
        try {
          const jsonObj = JSON.parse(atob(reply));
          // const val = Object.values(jsonObj).pop()
          // console.log(kernelFile, val)
          const schema = nodSchemas.parse(jsonObj);
          return schema;
        } catch (e) {
          console.error(
            `Error on POST /nodpy/kernels. Schema Parsing \n${e} , ${reply}`
          );
        }
      }
      return undefined;
    })
    .catch(reason => {
      console.error(`Error on GET /nodpy/kernels.\n${reason}`);
      return undefined;
    });
  return res;
}

export async function setKernelToOpen(key: string) {
  console.log('sending kernelToOpen');
  const res = await requestAPI<any>('kernels', {
    method: 'POST',
    body: key //JSON.stringify("t"),
  })
    .then(reply => {
      console.log(reply);
    })
    .catch(reason => {
      console.error(`Error on POST /nodpy/kernels.\n${reason}`);
      return undefined;
    });
  return res;
}
export async function inspectVariable(
  variablesReference: number
): Promise<DebugProtocol.Variable[]> {
  console.log('inspect variable', variablesReference);
  const kernelID = await getNodKernel();
  if (kernelID === undefined) {
    throw new Error('No active nod session');
  }
  const reply = await sendRequest(
    'nod_variables',
    {
      variablesReference
    },
    'variables'
  );
  if (reply.success) {
    return reply.body.variables;
  } else {
    throw new Error(reply.message);
  }
}
export async function getDefinedVariables(
  function_id: string
): Promise<DebugProtocol.Variable[]> {
  const kernelID = await getNodKernel();
  if (kernelID === undefined) {
    throw new Error('No active nod session');
  }
  const inspectReply = await sendRequest(
    'nod_inspect_variables',
    { function_id },
    ''
  );
  const variables = inspectReply.body.variables;
  return variables;
  // const variableScopes = [
  //   {
  //     name: this._trans.__('Globals'),
  //     variables: variables
  //   }
  // ];
  // this._model.variables.scopes = variableScopes;
}
