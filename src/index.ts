import {
  ILabShell,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { INotebookTracker } from '@jupyterlab/notebook';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { AccordionPanel } from '@lumino/widgets';
import {
  Contents,
  IContentsManager,
  ISessionManager,
  ITerminalManager,
  Session,
  Terminal
} from '@jupyterlab/services';
import { nodState } from './state';
import { addCommands } from './commands';
import { CodeViewers } from './codeViewers';
import { getKernels, requestDebug, setKernelToOpen } from './messaging';
import { PageConfig } from '@jupyterlab/coreutils';
import { IMainMenu } from '@jupyterlab/mainmenu';
import { ITranslator, nullTranslator } from '@jupyterlab/translation';
// import { XMLParser } from 'fast-xml-parser';
import {
  ICommandPalette,
  ISessionContextDialogs,
  IToolbarWidgetRegistry
} from '@jupyterlab/apputils';
import { IRunningSessions } from "@jupyterlab/running";
import { IConsoleTracker } from '@jupyterlab/console';
import { INodStackFrame, nodSchema } from './types';
import { IDocumentManager, PathStatus } from '@jupyterlab/docmanager';
import { IDebugger } from '@jupyterlab/debugger';
import { CallstackModel, NodSessionItem, NodRunningModel } from './callstack/model';
import { NodSidebar } from './callstack';
import {
  checkKernelStatus,
  onCurrentNotebookChanged
} from './interfaceHelpers';
import { openNotebookWithNodKernel, restart } from './kernelHelpers';
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
    IDebugger,
    IDocumentManager,
    ISessionManager,
    JupyterFrontEnd.IPaths
  ],
  optional: [ISettingRegistry],
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
    debuggerService: IDebugger,
    docManager: IDocumentManager,
    sessionManager: Session.IManager,
    paths: JupyterFrontEnd.IPaths
  ) => {
    console.log(PageConfig.getOption('nod_active'))
    const isActive = (PageConfig.getOption('nod_active') === "true");
    console.log('nod_active', isActive);
    const trans = (translator ?? nullTranslator).load('jupyterlab')
    notebookTracker.activeCellChanged.connect(() => {

      // getKernels().then((reply) => {
      //   console.log(reply)
      console.log(contentsManager.normalize(state.paths.directories.serverRoot))
      // console.log(contentsManager.get(state.paths.directories.serverRoot))
      console.log(notebookTracker.currentWidget?.sessionContext.session?.kernel?.status)
      // })
      console.log(
        Array.from(nodState.Instance().app.serviceManager.kernels.running())
      );
      nodState.Instance().tracker.forEach(panel => {
        console.log(panel.context.path, panel);
      });
    });
    if (!isActive) {
      console.log(
        'Nod extension loaded, but not called from a nod() call, assuming existing mode'
      ); //Todo assume --existing mode
    }

    console.log('JupyterLab extension nod is activated!');
    const connection_dir = PageConfig.getOption('nod_connection_dir');
    const nod_CWD = PageConfig.getOption('nod_CWD')
    console.log('connection_dir', connection_dir);
    const callStackModel = new CallstackModel({});
    const runningModel = new NodRunningModel({})
    const callstackSidebar = new NodSidebar({
      translator,
      service: debuggerService,
      model: callStackModel,
      runningModel: runningModel
    });
    const state = nodState.Instance(
      notebookTracker,
      app,
      contentsManager,
      translator,
      connection_dir,
      callstackSidebar,
      settingRegistry,
      docManager,
      paths,
      isActive ? "from_cli" : "existing",
      nod_CWD
    );
    console.log(state)
    addCommands(app.commands, mainMenu, translator, palette, consoleTracker, notebookTracker);
    app.docRegistry.addWidgetExtension('Notebook', new CodeViewers());
    app.shell.add(state.callstackSidebar, 'left', {
      type: 'Debugger',
      rank: 400
    });

    app.started.then(() => {
      console.log('started');
      // disableKernelSwitching(sessionContextDialogs, toolbarRegistry);

      if (isActive) {
        checkKernelStatus();
        docManager.closeAll();
      }

      // state.callstackSidebar.activate()
      //TODO close all besides the ones we want to open?
    });
    app.restored.then(() => {
      if (isActive) {
        checkKernelStatus();
        state.activateSidebars();
        (state.callstackSidebar.content as AccordionPanel).expand(0);
      }
      sessionContextDialogs.restart = restart;
    });


    notebookTracker.widgetUpdated.connect((tracker, panel) => {
      panel.sessionContext.kernelPreference = {
        autoStartDefault: false,
        shutdownOnDispose: false
      };
    });


    notebookTracker.currentChanged.connect((tracker, panel) => {
      console.log('current Changed');
      if (panel) {
        if (panel.isRevealed) {
          onCurrentNotebookChanged(panel);
        } else {
          panel.revealed.then(() => onCurrentNotebookChanged(panel));
        }

        panel?.sessionContext.statusChanged.connect((context, status) => {
          console.log('STATUS CHANGED', status);
          console.log('Previous kernel', context.prevKernelName);
          // if (status === 'restarting') {
          //   {
          //   }
          // } else
          if ( //todo -- make this less temperamental
            [
              // 'unknown', 
              'dead'].includes(status) &&
            (context.session?.kernel?.name === 'nod')
          ) {
            console.log('status changed to dead');
            checkKernelStatus();
          }
        });
      }
    });

    app.serviceManager.kernels.runningChanged.connect((manager, model) => {
      console.log('running changed', model);
      if (state.status === 'active') {
        checkKernelStatus();
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
              // docManager.deleteFile(panel.context.path)
              // docManager.closeFile(panel.context.path)
              panel.dispose();
            }
          });
        }


        // const options = {
        //   ignoreAttributes: false,
        //   attributeNamePrefix: "@_",
        // };
        // const parser2 = new XMLParser(options);
        // const parsed = state.pythonInfo?.map((frame, index) => {
        //   return parser2.parse(frame.frame_xml);

        // })
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
        runningModel.selectedKernelKey = ""
      }
    });

    nodState.Instance().currentFrameChanged.connect((state, frameNum) => {
      callStackModel.frame = callStackModel.frames[frameNum];
      const notebookFile =
        nodState.Instance().currentFrame?.file_info?.notebook_file;
      notebookFile ? openNotebookWithNodKernel(notebookFile, docManager) : {};
      console.debug('Switching to frame ', frameNum);
      requestDebug('nod_switch', frameNum);
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
    nodState.Instance().pythonInfoChanged.connect((state, info) => {
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
        runningModel.selectedKernelKey = state.pythonInfo?.key ?? ""
      }
    });

    callStackModel.currentFrameChanged.connect((model, frame) => {
      if (frame?.id !== undefined) {
        nodState.Instance().currentFrameIndex = frame?.id;
      }
    });

    // if (settingRegistry) {
    //   Promise.all([app.restored, settingRegistry.load(plugin.id)])
    //     .then(([_, setting]) => {
    //       const onSettingsUpdate = () => {
    //         console.log("settings updated!")
    //       };
    //       onSettingsUpdate();
    //       setting.changed.connect(onSettingsUpdate);
    //     })
    //     .catch(error => {
    //       console.error(
    //         'Failed to load notebook table of content settings.',
    //         error
    //       );
    //     });
    // }

    // if (settingRegistry) {
    //   settingRegistry
    //     .load(plugin.id)
    //     .then(settings => {
    //       console.log('nod settings loaded:', settings.composite);
    //     })
    //     .catch(reason => {
    //       console.error('Failed to load settings for nod.', reason);
    //     });
    // }

    // https://github.com/fails-components/jupyterfails/blob/master/packages/interceptor/src/index.ts
  }
};

export default plugin;
