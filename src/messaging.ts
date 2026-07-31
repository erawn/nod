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
import { nodSchemas, nodStudyLogRequest } from './types';
import { DebugProtocol } from '@vscode/debugprotocol';
import { PromiseDelegate } from '@lumino/coreutils';
import { Debugger, IDebugger } from '@jupyterlab/debugger';
import { WidgetTracker } from '@jupyterlab/apputils';
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
  console.log('sending debug message : ', command, args);
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
    console.error('no kernel');
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
  state.mode = 'existing';
  if (nodKernel !== undefined) {
    const content: KernelMessage.IExecuteRequestMsg['content'] = {
      code: 'quit',
      silent: true,
      store_history: false
    };
    try {
      const connection = state.app.serviceManager.kernels.connectTo({
        model: nodKernel
      });
      await connection.requestExecute(content).done;
      await kernelManager.shutdown(id);
    } catch (e) {
      console.log(e);
    } finally {
      await kernelManager.refreshRunning();
      state.status = 'inactive';
    }
  }
}

export async function studyLogSend(request: nodStudyLogRequest) {
  nodState
    .Instance()
    .getStudyLogEnabled()
    .then(async enabled => {
      if (enabled) {
        const codeTracking = await nodState.Instance().getCodeTrackingDisabled()
        if (codeTracking) {
          request.function_id = undefined
          request.cell = undefined
          request.cellChangeArgs = undefined
          request.nodInfo = undefined
          request.var_string = undefined
          request.varname = undefined
        }
        requestAPI<any>('study_log', {
          body: JSON.stringify(request),
          method: 'POST'
        })
          .then(reply => {
            console.log('study_log successful');
          })
          .catch(reason => {
            console.error(
              `Error on POST /nodpy/study_log ${request}.\n${reason}`
            );
          });
      }
    });
}

export async function writeChange(
  panel: NotebookPanel,
  frame: NonNullable<nodState['currentFrame']>
) {
  const contentsManager = nodState.Instance().contentsManager;
  await nodState.Instance().app.commands.execute('docmanager:save-all');
  await contentsManager
    .get(panel.context.path, { type: 'file', format: 'base64', content: true })
    .then(async nb_content => {
      const study_log = await nodState.Instance().getStudyLogEnabled();
      const code_tracking = await nodState.Instance().getCodeTrackingDisabled();
      let study_option;
      if (study_log && code_tracking) {
        study_option = "usage_only"
      } else if (study_log && !code_tracking) {
        study_option = "full"
      }
      else if (!study_log) {
        study_option = 'none'
      }
      console.debug('nb_content', nb_content);
      const dataToSend = {
        program_info: frame,
        notebookContent: nb_content.content,
        study_log: study_option,
        key: nodState.Instance().pythonInfo?.key
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
          console.warn(
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
    body: key
  })
    .then(reply => {
      console.log('Set kernel to open reply:', reply);
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
const trackerMime = new WidgetTracker<Debugger.VariableRenderer>({
  namespace: 'debugger/render-variable'
});
export function renderNodMimeVariable(variable: IDebugger.IVariable) {
  const state = nodState.Instance();
  const activeWidget = state.debuggerHandler.activeWidget;
  const activeRendermime =
    activeWidget instanceof NotebookPanel
      ? activeWidget.content.rendermime
      : state.rendermime;

  if (!activeRendermime) {
    return;
  }
  const name = variable.name;
  const id = `jp-debugger-variable-mime-${name}-${state.debuggerService.session?.connection?.path.replace(
    '/',
    '-'
  )}`;
  if (
    !name || // Name is mandatory
    trackerMime.find(widget => widget.id === id) // Widget already exists
    // (!frameId && service.hasStoppedThreads()) // frame id missing on breakpoint
  ) {
    return;
  }
  // const model = state.nodLogSidebar.log.model
  const variablesModel = state.nodLogSidebar.log.model;

  const widget = new Debugger.VariableRenderer({
    dataLoader: () => inspectRichNodVariable(variable.variablesReference),
    rendermime: activeRendermime,
    translator: state.translator
  });
  widget.addClass('jp-DebuggerRichVariable');
  widget.id = id;
  widget.title.icon = Debugger.Icons.variableIcon;
  widget.title.label = `${name} - ${state.debuggerService.session?.connection?.name}`;
  widget.title.caption = `${name} - ${state.debuggerService.session?.connection?.path}`;
  void trackerMime.add(widget);
  const disposeWidget = () => {
    widget.dispose();
    variablesModel.changed.disconnect(refreshWidget);
    activeWidget?.disposed.disconnect(disposeWidget);
  };
  const refreshWidget = () => {
    // Refresh the widget only if the active element is the same.
    if (state.debuggerHandler.activeWidget === activeWidget) {
      void widget.refresh();
    }
  };
  widget.disposed.connect(disposeWidget);
  variablesModel.changed.connect(refreshWidget);
  activeWidget?.disposed.connect(disposeWidget);

  state.app.shell.add(widget, 'main', {
    mode: trackerMime.currentWidget ? 'split-right' : 'split-bottom',
    activate: false,
    type: 'Debugger Variables'
  });
}
export async function inspectRichNodVariable(
  variablesReference: number
): Promise<IDebugger.IRichVariable> {
  console.log('rich inspect variable', variablesReference);
  const kernelID = await getNodKernel();
  if (kernelID === undefined) {
    throw new Error('No active nod session');
  }
  const reply = await sendRequest(
    'nod_inspect_rich_variable',
    {
      variablesReference
    },
    ''
  );
  if (reply.success) {
    return reply.body;
  } else {
    throw new Error(reply.message);
  }
}
export async function pushVariable(
  variable: IDebugger.IVariable
): Promise<boolean> {
  const { variablesReference, name, evaluateName, value } = variable;
  console.log('push variable', variablesReference);
  const kernelID = await getNodKernel();
  if (kernelID === undefined) {
    throw new Error('No active nod session');
  }
  const state = nodState.Instance();
  const data: nodStudyLogRequest = {
    kind: 'nod_log_inject_state',
    varname: name,
    var_string: value,
    function_id: state.currentFrame?.function_id,
    key: state.pythonInfo?.key ?? ''
  };
  studyLogSend(data);
  const reply = await sendRequest(
    'nod_log_push',
    {
      variablesReference,
      name,
      evaluateName
    },
    ''
  );
  console.log(
    'sending push variable request',
    'nod_log_push',
    {
      variablesReference,
      name,
      evaluateName
    },
    ''
  );
  if (!reply.success) {
    console.error('Nod: push variable failed');
  }
  return reply.success;
}
export async function getDefinedVariables(
  function_id: string
): Promise<DebugProtocol.Variable[] | undefined> {
  const kernelID = await getNodKernel();
  if (kernelID === undefined) {
    console.log('No active nod session');
    return;
  }
  const inspectReply = await sendRequest(
    'nod_inspect_variables',
    { function_id },
    ''
  );
  const variables = inspectReply.body.variables;
  return variables;
}
