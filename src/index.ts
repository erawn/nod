import {
  ILabShell,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { INotebookTracker, NotebookActions } from '@jupyterlab/notebook';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { IStateDB } from '@jupyterlab/statedb';
import {
  Contents,
  IContentsManager,
  ISessionManager,
  Session
} from '@jupyterlab/services';
import { nodState } from './state';
import { addCommands } from './commands';
import { CodeViewers } from './codeViewers';
import { getKernels, requestDebug, studyLogSend } from './messaging';
import { PageConfig } from '@jupyterlab/coreutils';
import { IMainMenu } from '@jupyterlab/mainmenu';
import { ITranslator, nullTranslator } from '@jupyterlab/translation';
// import { XMLParser } from 'fast-xml-parser';
import {
  ICommandPalette,
  ISessionContextDialogs,
  IToolbarWidgetRegistry
} from '@jupyterlab/apputils';
import { IConsoleTracker } from '@jupyterlab/console';
import { INodStackFrame, nodStudyLogRequest } from './types';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { CallstackModel, NodRunningModel } from './model';
import { NodSidebar } from './callstack';
import {
  checkKernelStatus,
  onCurrentNotebookChanged
} from './interfaceHelpers';
import {
  getNodKernel,
  openNotebookWithNodKernel,
  restart
} from './kernelHelpers';
import { NodLogModel, NodLogSidebar } from './nodLog';
import { IDebugger, IDebuggerHandler } from '@jupyterlab/debugger';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
/**
 * Initialization data for the nod extension.
 */

const plugin: JupyterFrontEndPlugin<void> = {
  id: 'nod:plugin',
  description: 'A JupyterLab extension.',
  autoStart: true,
  requires: [
    INotebookTracker,
    ISettingRegistry,
    IContentsManager,
    ILabShell,
    IMainMenu,
    ITranslator,
    IToolbarWidgetRegistry,
    ISessionContextDialogs,
    ICommandPalette,
    IConsoleTracker,
    IDocumentManager,
    ISessionManager,
    JupyterFrontEnd.IPaths,
    IDebugger,
    IDebuggerHandler,
    IRenderMimeRegistry
  ],
  optional: [IStateDB],
  activate: (
    app: JupyterFrontEnd,
    notebookTracker: INotebookTracker,
    settingRegistry: ISettingRegistry,
    contentsManager: Contents.IManager,
    labShell: ILabShell | null,
    mainMenu: IMainMenu,
    translator: ITranslator,
    toolbarRegistry: IToolbarWidgetRegistry,
    sessionContextDialogs: ISessionContextDialogs,
    palette: ICommandPalette,
    consoleTracker: IConsoleTracker,
    docManager: IDocumentManager,
    sessionManager: Session.IManager,
    paths: JupyterFrontEnd.IPaths,
    debuggerService: IDebugger,
    handler: IDebugger.IHandler,
    rendermime: IRenderMimeRegistry,
    jupyter_state: IStateDB | null
  ) => {
    console.log(PageConfig.getOption('nod_active'));
    const isActive = PageConfig.getOption('nod_active') === 'true';
    console.log('nod_active', isActive);
    // let previousStatus = '';
    // const trans = (translator ?? nullTranslator).load('jupyterlab');
    debuggerService.sessionChanged.connect(() =>
      console.log('debug sessionChanged')
    );
    notebookTracker.activeCellChanged.connect(() => {
      nodState
        .Instance()
        .app.serviceManager.kernels.refreshRunning()
        .then(() =>
          console.log(
            'kernels',
            Array.from(nodState.Instance().app.serviceManager.kernels.running())
          )
        );
      sessionManager
        .refreshRunning()
        .then(() =>
          console.log('sessions', Array.from(sessionManager.running()))
        );
      // getKernels().then((reply) => {
      //   console.log(reply)
      // console.log(
      //   contentsManager.normalize(state.paths.directories.serverRoot)
      // );
      // console.log(contentsManager.get(state.paths.directories.serverRoot))
      // console.log(
      //   notebookTracker.currentWidget?.sessionContext.session?.kernel?.status
      // );
      // })

      // nodState.Instance().tracker.forEach(panel => {
      //   console.log(panel.context.path, panel);
      // });
    });
    if (!isActive) {
      console.log(
        'Nod extension loaded, but not called from a nod() call, assuming existing mode'
      ); //Todo assume --existing mode
    }
    if (settingRegistry) {
      Promise.all([app.restored, settingRegistry.load(plugin.id)])
        .then(([_, setting]) => {
          const onSettingsUpdate = () => {
            console.log('settings updated!');
          };
          onSettingsUpdate();
          setting.changed.connect(onSettingsUpdate);
        })
        .catch(error => {
          console.error(
            'Failed to load notebook table of content settings.',
            error
          );
        });
    }

    if (settingRegistry) {
      settingRegistry
        .load(plugin.id)
        .then(settings => {
          console.log('nod settings loaded:', settings.composite);
        })
        .catch(reason => {
          console.error('Failed to load settings for nod.', reason);
        });
    }

    console.log('JupyterLab extension nod is activated!');
    const connection_dir = PageConfig.getOption('nod_connection_dir');
    const nod_CWD = PageConfig.getOption('nod_CWD');
    const trans = (translator ?? nullTranslator).load('jupyterlab');
    console.log('connection_dir', connection_dir);
    console.log('nod_CWD', nod_CWD);
    const callStackModel = new CallstackModel({});
    const runningModel = new NodRunningModel();
    const callstackSidebar = new NodSidebar({
      translator,
      model: callStackModel,
      runningModel: runningModel
    });
    const commandRegistry = app.commands;
    const nodLogModel = new NodLogModel();
    const nodLogSidebar = new NodLogSidebar({
      translator,
      model: nodLogModel,
      commands: commandRegistry,
      debuggerService: debuggerService
    });
    console.log(nodLogModel, nodLogSidebar);
    console.log(
      notebookTracker,
      app,
      contentsManager,
      translator,
      connection_dir,
      callstackSidebar,
      nodLogSidebar,
      settingRegistry,
      docManager,
      paths,
      isActive ? 'from_cli' : 'existing',
      nod_CWD,
      sessionManager
    );
    const state = nodState.Instance(
      notebookTracker,
      app,
      contentsManager,
      translator,
      connection_dir,
      callstackSidebar,
      nodLogSidebar,
      settingRegistry,
      docManager,
      paths,
      isActive ? 'from_cli' : 'existing',
      nod_CWD,
      debuggerService,
      handler,
      rendermime,
      sessionManager
    );
    // if (restorer) {
    //   restorer.add(nodLogSidebar, 'nod-log-sidebar');
    //   restorer.add(callstackSidebar, 'nod-callstack-sidebar');
    // }
    console.log(state);
    addCommands(
      app.commands,
      mainMenu,
      translator,
      palette,
      consoleTracker,
      notebookTracker
    );
    app.docRegistry.addWidgetExtension('Notebook', new CodeViewers());
    app.shell.add(state.callstackSidebar, 'left', {
      type: 'Debugger',
      rank: 400
    });
    app.shell.add(state.nodLogSidebar, 'right', {
      type: 'Debugger',
      rank: 400
    });

    app.started.then(() => {
      console.log('started');
      // disableKernelSwitching(sessionContextDialogs, toolbarRegistry);
      if (isActive) {
        // checkKernelStatus();
        docManager.closeAll();
      } else {
        let kernelPreference =
          notebookTracker.currentWidget?.sessionContext.kernelPreference;
        if (kernelPreference !== undefined) {
          kernelPreference = {
            autoStartDefault: false,
            name: 'nod',
            shutdownOnDispose: false
          };
        }
      }

      // state.callstackSidebar.activate()
      //TODO close all besides the ones we want to open?
    });
    app.restored.then(async () => {
      console.log('restored');
      //persist connected status through reload
      if (jupyter_state !== undefined) {
        try {
          const existing_key = (await jupyter_state?.fetch(
            'nod_state_kernel_key'
          )) as { key: string };
          const existing_id = (await jupyter_state?.fetch(
            'nod_state_kernel_id'
          )) as { id: string };
          console.log(existing_key, existing_id);
          // if (existing_state !== undefined) {
          const kernels = await getKernels();
          const kernel_id = await getNodKernel();
          const new_schema = kernels?.find(
            kernel_info => kernel_info.key === existing_key.key
          );
          if (new_schema !== undefined && kernel_id === existing_id.id) {
            console.log('found existing state after reload');
            await state.reset(new_schema, kernel_id);
          }
          // }
        } catch (e) {
          console.log((e as Error).message);
        }
      }
      if (isActive) {
        console.log('restored');
        checkKernelStatus();
        state.activateSidebars();
      } else {
        notebookTracker.forEach(panel => {
          if (panel.context.path.includes('nod')) {
            panel.sessionContext.kernelPreference = {
              ...panel.sessionContext.kernelPreference,
              autoStartDefault: false,
              shutdownOnDispose: false,
              shouldStart: false
            };
          }
        });
      }
      sessionContextDialogs.restart = restart;
    });
    NotebookActions.executed.connect((slot, params) => {
      const { cell } = params;
      const data: nodStudyLogRequest = {
        kind: 'execute_cell',
        cell: JSON.stringify(cell.model.sharedModel.toJSON()),
        function_id: nodState.Instance().currentFrame?.function_id ?? undefined,
        key: nodState.Instance().pythonInfo?.key ?? ''
      };
      studyLogSend(data);
    });
    notebookTracker.widgetUpdated.connect((tracker, panel) => {
      console.log('widget updated');
      panel.sessionContext.kernelPreference = {
        ...panel.sessionContext.kernelPreference,
        autoStartDefault: false,
        shutdownOnDispose: false,
        shouldStart: false
      };
    });
    notebookTracker.currentChanged.connect((tracker, panel) => {
      console.log('current nb Changed');
      if (panel) {
        if (panel.isRevealed) {
          onCurrentNotebookChanged(panel);
        } else {
          panel.revealed.then(() => onCurrentNotebookChanged(panel));
        }

        panel?.sessionContext.statusChanged.connect((context, status) => {
          console.log('STATUS CHANGED', status);
          console.log('Previous kernel', context.prevKernelName);

          if (status === 'idle') {
            const newId = state.currentFrame?.function_id;
            if (newId !== undefined) {
              state.nodLogSidebar.log.updateVariables(newId);
              state.nodLogSidebar.update();
            }
          }
          // if (status === 'restarting') {
          //   {
          //   }
          // } else
          if (
            //todo -- make this less temperamental
            [
              // 'unknown',
              'dead'
            ].includes(status) &&
            context.session?.kernel?.name === 'nod'
          ) {
            console.log('status changed to dead');
            checkKernelStatus();
          }
          // previousStatus = status;
        });
      }
    });

    app.serviceManager.kernels.runningChanged.connect((manager, model) => {
      console.log('running changed', model);
      if (state.status === 'active') {
        // checkKernelStatus();
        // const newId = state.currentFrame?.function_id;
        // if (newId !== undefined) {
        //   nodLogSidebar.log.updateVariables(newId);
        //   nodLogSidebar.update();
        // }
        // getNodKernel()
      }
    });

    state.statusChanged.connect((state, status) => {
      if (status === 'active') {
        console.log('Nod ACTIVE');
        const currentNotebookPath =
          notebookTracker.currentWidget?.context.path ?? '';
        const selectedFrame = state.getFrameFromPath(currentNotebookPath);
        const selectedIndex = selectedFrame
          ? state.pythonInfo?.stack_info.indexOf(selectedFrame)
          : 0;
        if (selectedIndex) {
          console.log('Setting index on active to', selectedIndex);
          state.currentFrameIndex = selectedIndex;
        }
        const currentFrame = state.currentFrame;
        if (currentFrame && currentFrame.file_info) {
          const openNotebook = notebookTracker.find(
            panel =>
              currentFrame &&
              currentFrame.file_info !== undefined &&
              currentFrame.file_info.notebook_file.includes(panel.context.path)
          );
          if (openNotebook === undefined) {
            openNotebookWithNodKernel(
              currentFrame.file_info.notebook_file,
              docManager
            );
          }
          notebookTracker.forEach(panel => {
            const selectedFrame = state.getFrameFromPath(panel.context.path);
            if (selectedFrame === undefined) {
              if (panel.context.path.includes('nod')) {
                // docManager.closeFile(panel.context.path)
                // docManager.deleteFile(panel.context.path)
                panel.dispose();
              }
            }
          });
        }
        const frames = state.pythonInfo?.stack_info.map((frame, index) => {
          return {
            id: index,
            name: frame.function_name,
            source: {
              path: frame.source_file,
              name: frame.relative_source_file
            },
            scope: {
              name: frame.function_name,
              variables: [{ name: 'a', value: '10' }]
            }
          } as INodStackFrame;
        });
        if (frames) {
          console.debug('setting frames', state.currentFrameIndex);
          console.debug(
            'setting filters',
            state.pythonInfo?.module_filters ?? ['']
          );
          callStackModel.setFrames(
            frames,
            state.currentFrameIndex,
            state.pythonInfo?.module_filters ?? ['']
          );
        }
      }
      if (status === 'inactive') {
        runningModel.selectedKernelKey = '';
        callstackSidebar.refreshKernels();
        callStackModel.setFrames([], -1, ['']);
        const variableScopes = [
          {
            name: trans.__('Globals'),
            variables: []
          }
        ];
        nodLogModel.scopes = variableScopes;
      }
    });

    nodState.Instance().currentFrameChanged.connect((state, frameNum) => {
      console.debug('Switching to frame ', frameNum);
      callStackModel.frame = callStackModel.frames[frameNum];

      const notebookFile = state.currentFrame?.file_info?.notebook_file;
      if (notebookFile !== undefined) {
        openNotebookWithNodKernel(notebookFile, docManager).then(() => {
          requestDebug('nod_switch', { stackIndex: frameNum });
          const function_id = state.currentFrame?.function_id;
          if (function_id !== undefined) {
            nodLogSidebar.log.updateVariables(function_id);
            nodLogSidebar.update();
          }
          const data: nodStudyLogRequest = {
            kind: 'navigate_stackframe',
            function_id: function_id,
            key: nodState.Instance().pythonInfo?.key ?? ''
          };
          studyLogSend(data);
        });
      } else {
        console.error('Notebook file is undefined', state.currentFrame);
      }
    });
    nodState.Instance().lockChanged.connect((state, id) => {
      const path = notebookTracker.find(panel => panel.id === id)?.context.path;
      if (path !== undefined) {
        const frame = state.getFrameFromPath(path);
        if (frame !== undefined) {
          callStackModel.editedNotebookIndex = frame.index;
        }
        console.debug('setting edited nb path', path);
      } else {
        callStackModel.editedNotebookIndex = -1;
      }
    });
    nodState.Instance().nodKernelIdChanged.connect((state, id) => {
      console.log('setting nod_kernel_id to ', id);
      jupyter_state?.save('nod_state_kernel_id', { id: id });
    });
    nodState.Instance().pythonInfoChanged.connect((state, info) => {
      if (info !== null) {
        const data: nodStudyLogRequest = {
          kind: 'notebook_start',
          nodInfo: info ?? undefined,
          key: info.key
        };
        studyLogSend(data);
      }

      console.log('python info changed');
      console.log('setting nod_kernel_key to ', info?.key);
      jupyter_state?.save('nod_state_kernel_key', { key: info?.key });
      for (const session of state.sessionManager.running()) {
        console.log(
          'looking at session:',
          session,
          state.getFrameFromPath(session.path)
        );
        if (
          session.kernel?.name === 'nod' &&
          state.getFrameFromPath(session.path) === undefined
        ) {
          console.log('shutting down', session, session.kernel);
          // state.sessionManager.shutdown(session.id)
        }
      }
      const newId = state.currentFrame?.function_id;
      if (newId !== undefined) {
        nodLogSidebar.log.updateVariables(newId);
        nodLogSidebar.update();
      }

      const frames = state.pythonInfo?.stack_info.map((frame, index) => {
        return {
          id: index,
          name: frame.function_name,
          source: { path: frame.source_file, name: frame.relative_source_file },
          scope: {
            name: frame.function_name,
            variables: [{ name: 'a', value: '10' }]
          }
        } as INodStackFrame;
      });
      if (frames) {
        console.debug('setting frames', state.currentFrameIndex);
        console.debug(
          'setting filters',
          state.pythonInfo?.module_filters ?? ['']
        );
        callStackModel.setFrames(
          frames,
          state.currentFrameIndex,
          state.pythonInfo?.module_filters ?? ['']
        );
        runningModel.selectedKernelKey = state.pythonInfo?.key ?? '';
      }
    });

    callStackModel.currentFrameChanged.connect((model, frame) => {
      if (frame?.id !== undefined) {
        nodState.Instance().currentFrameIndex = frame?.id;
      }
    });

    // https://github.com/fails-components/jupyterfails/blob/master/packages/interceptor/src/index.ts
  }
};

export default plugin;
