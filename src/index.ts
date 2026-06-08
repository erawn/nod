import {
  ILabShell,
  JupyterFrontEnd,
  JupyterFrontEndPlugin,
} from '@jupyterlab/application';
import { INotebookTracker } from '@jupyterlab/notebook';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { AccordionPanel } from '@lumino/widgets';
import {
  Contents,
  IContentsManager,
  ISessionManager,
  Session,
} from '@jupyterlab/services'
import { nodState } from './state';
import { addCommands } from './commands';
import { addToolbarButtons, disableKernelSwitching } from './buttons';
import { CodeViewers } from './codeViewers';
import { requestDebug } from './messaging';
import { PageConfig } from '@jupyterlab/coreutils';
import { IMainMenu } from '@jupyterlab/mainmenu';
import { ITranslator } from '@jupyterlab/translation';
import { XMLParser } from 'fast-xml-parser'
import { ICommandPalette, ISessionContext, ISessionContextDialogs, IToolbarWidgetRegistry, MainAreaWidget, SessionContext, SessionContextDialogs, showDialog, showErrorMessage } from '@jupyterlab/apputils';

import { IConsoleTracker } from '@jupyterlab/console';
import { INodStackFrame } from './types';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { IDebugger } from '@jupyterlab/debugger';
import { CallstackModel } from './callstack/model';
import { NodSidebar } from './callstack'
import { checkKernelStatus, onCurrentNotebookChanged } from './interfaceHelpers';
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
    ISessionManager
  ],
  optional: [ISettingRegistry],
  activate: (app: JupyterFrontEnd,
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
    sessionManager: Session.IManager
  ) => {
    const isActive = PageConfig.getOption('nod_active');
    console.log("nod_active", isActive)
    if (isActive !== 'true') {
      console.log("Nod extension loaded, but not called from a nod() call, deactivating")
      return
    }
    console.log('JupyterLab extension nod is activated!');
    const connection_dir = PageConfig.getOption('nod_connection_dir')
    console.log("connection_dir", connection_dir)
    const callStackModel = new CallstackModel({});
    const callstackSidebar = new NodSidebar({ translator, service: debuggerService, model: callStackModel })
    const state = nodState.Instance(notebookTracker, app, contentsManager, translator, connection_dir, callstackSidebar, settingRegistry, docManager) // initialize singleton with tracker
    app.docRegistry.addWidgetExtension('Notebook', new CodeViewers());
    disableKernelSwitching(sessionContextDialogs, toolbarRegistry)
    addCommands(mainMenu, translator, palette, consoleTracker)
    addToolbarButtons()
    notebookTracker.widgetUpdated.connect((tracker, panel) => {
      panel.sessionContext.kernelPreference = { autoStartDefault: false, shutdownOnDispose: false };
    })
    state.app.shell.add(state.callstackSidebar, 'left', { type: 'Debugger', rank: 400, });

    notebookTracker.activeCellChanged.connect(() => {
      console.log(Array.from(nodState.Instance().app.serviceManager.kernels.running()))
    })
    notebookTracker.currentChanged.connect((tracker, panel) => {
      console.log('current Changed')
      if (panel) {
        if (panel.isRevealed)
          onCurrentNotebookChanged(panel)
        else
          panel.revealed.then(() => onCurrentNotebookChanged(panel))

        panel?.sessionContext.statusChanged.connect((context, status) => {
          console.log("STATUS CHANGED", status)
          console.log("Previous kernel", context.prevKernelName)
          if (status === 'restarting') {

          }
        })
      }
    })

    app.serviceManager.kernels.runningChanged.connect((manager, model) => {
      console.log('running changed')
      if (state.status === "active") {
        checkKernelStatus.invoke()
        // getNodKernel()
      }
    })
    app.started.then(() => {
      console.log('started')
      checkKernelStatus.invoke()
      docManager.closeAll()
      // state.callstackSidebar.activate()
      //TODO close all besides the ones we want to open?
    })
    app.restored.then(() => {
      checkKernelStatus.invoke()
      state.activateSidebars();
      (state.callstackSidebar.content as AccordionPanel).expand(0)

      const sessionRestart = sessionContextDialogs.restart

      console.log(sessionRestart)

      async function myRestart(session: ISessionContext, restartOptions?: ISessionContext.IRestartOptions) {
        return await sessionRestart(session, restartOptions)
      }

      sessionContextDialogs.restart = restart
      // console.log(sessionRestart)
      // console.log(restart)
    })

    nodState.Instance().statusChanged.connect((state, status) => {
      if (status === 'active') {
        console.log("Nod ACTIVE")
        const currentNotebookPath = notebookTracker.currentWidget?.context.path ?? ""
        const selectedFrame = state.getFrameFromPath(currentNotebookPath)
        const selectedIndex = selectedFrame ? state.pythonInfo?.stack_info.indexOf(selectedFrame) : 0
        if (selectedIndex) {
          console.log("Setting index on active to", selectedIndex)
          state.currentFrameIndex = selectedIndex
        }
        const currentFrame = state.currentFrame
        if (currentFrame && currentFrame.fileInfo) {
          const openNotebook = notebookTracker.find((panel) => currentFrame && currentFrame.fileInfo !== undefined && currentFrame.fileInfo.notebook_file.includes(panel.context.path))
          if (openNotebook === undefined) {
            openNotebookWithNodKernel(currentFrame.fileInfo.notebook_file, docManager)
          }
          notebookTracker.forEach(panel => {
            const selectedFrame = state.getFrameFromPath(panel.context.path)
            if (selectedFrame === undefined) {
              docManager.closeFile(panel.context.path)
            }
          })
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
          return ({ id: index, name: frame.function_name, source: { path: frame.source_file, name: frame.relative_source_file }, scope: { name: frame.function_name, variables: [{ name: 'a', value: '10' }] } } as INodStackFrame)
        })
        if (frames) {
          console.log('setting frames', state.currentFrameIndex,)
          console.log('setting filters', state.pythonInfo?.module_filters ?? [""])
          callStackModel.setFrames(frames, state.currentFrameIndex, state.pythonInfo?.module_filters ?? [""])
        }
      }
    })

    nodState.Instance().currentFrameChanged.connect((state, frameNum) => {
      callStackModel.frame = callStackModel.frames[frameNum]
      const notebookFile = nodState.Instance().currentFrame?.fileInfo?.notebook_file
      notebookFile ? openNotebookWithNodKernel(notebookFile, docManager) : {}
      console.log("Switching to frame ", frameNum)
      requestDebug("nod_switch", frameNum)

    })
    nodState.Instance().lockChanged.connect((state, id) => {
      const path = notebookTracker.find(panel => panel.id === id)?.context.path
      if (path !== undefined) {
        const frame = state.getFrameFromPath(path)
        if (frame !== undefined) {
          callStackModel.editedNotebookIndex = frame.index
        }
        console.log("setting edited nb path", path)
      }
    })
    nodState.Instance().pythonInfoChanged.connect((state, info) => {
      const frames = state.pythonInfo?.stack_info.map((frame, index) => {
        return ({ id: index, name: frame.function_name, source: { path: frame.source_file, name: frame.relative_source_file }, scope: { name: frame.function_name, variables: [{ name: 'a', value: '10' }] } } as INodStackFrame)
      })
      if (frames) {
        console.log('setting frames', state.currentFrameIndex,)
        console.log('setting filters', state.pythonInfo?.module_filters ?? [""])
        callStackModel.setFrames(frames, state.currentFrameIndex, state.pythonInfo?.module_filters ?? [""])
      }
    })

    callStackModel.currentFrameChanged.connect((model, frame) => {
      if (frame?.id !== undefined) {
        nodState.Instance().currentFrameIndex = frame?.id
        console.log("CallSTackModelOPen")
      }
    })

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
  },

}

export default plugin;
