import {
  ILabShell,
  JupyterFrontEnd,
  JupyterFrontEndPlugin,
  LabShell
} from '@jupyterlab/application';

import {
  INotebookTracker,
} from '@jupyterlab/notebook';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { AccordionPanel } from '@lumino/widgets';
import {
  Contents,
  IContentsManager,
  IManager,
  ISessionManager,
  KernelManager,
  KernelMessage,
  Session,
} from '@jupyterlab/services'
import { nodState } from './state';
import { addCommands } from './commands';
import { addToolbarButtons, disableKernelSwitching } from './buttons';
import { CodeViewers } from './codeViewers';
import { getNodInfo, getNodKernel, openNotebookWithNodKernel, requestDebug } from './messaging';
import { requestAPI } from './request';
// import { createCallstackSidebar, NodSidebar } from './sidebar';
import { PageConfig } from '@jupyterlab/coreutils';
import { IMainMenu } from '@jupyterlab/mainmenu';
import { ITranslator, nullTranslator } from '@jupyterlab/translation';
import { XMLParser } from 'fast-xml-parser'
import { Dialog, ICommandPalette, ISessionContextDialogs, IToolbarWidgetRegistry, SessionContext, SessionContextDialogs, showDialog, showErrorMessage } from '@jupyterlab/apputils';

import {
  IConsoleTracker
} from '@jupyterlab/console';
import { INodStackFrame, nodSchema } from './types';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { IDebugger } from '@jupyterlab/debugger';
import { check } from 'zod';
import { bugIcon, buildIcon, SidePanel } from '@jupyterlab/ui-components';
import { Callstack } from './callstack'
import { CallstackModel } from './callstack/model';
import { ca } from 'zod/v4/locales';
import { IDebugReplyMsg } from '@jupyterlab/services/lib/kernel/messages';
import { stat } from 'node:fs';
import { NodSidebar } from './sidebar'
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
    settingRegistry: ISettingRegistry | null,
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
    nodState.Instance(notebookTracker, app, contentsManager, translator, connection_dir) // initialize singleton with tracker
    app.docRegistry.addWidgetExtension('Notebook', new CodeViewers());
    // disableKernelSwitching(sessionContextDialogs, toolbarRegistry)
    addCommands(mainMenu, translator, palette, consoleTracker)
    addToolbarButtons()

    var dialogID = ""


    notebookTracker.activeCellChanged.connect(() => {
      console.log(Array.from(nodState.Instance().app.serviceManager.kernels.running()))
    })
    const callStackModel = new CallstackModel({});
    const sidebar = new NodSidebar({ translator, service: debuggerService, model: callStackModel })
    nodState.Instance().app.shell.add(sidebar, 'left', { type: 'Debugger', rank: 400, });

    notebookTracker.currentChanged.connect((tracker, notebookPanel) => {
      console.log("CURRENT CHANGED")
      if (notebookPanel) {
        console.log("kernel statuses", Array.from(app.serviceManager.kernels.running()).map(kernel => console.log(kernel.execution_state)))
        notebookPanel.sessionContext.kernelPreference = { autoStartDefault: false, id: nodState.Instance().nodKernelId, shutdownOnDispose: false };
        const frame = nodState.Instance().getFrameFromPath(notebookPanel.context.path)
        if (frame) {
          const newIndex = nodState.Instance().pythonInfo?.indexOf(frame)
          console.log("new index", newIndex)
          if (newIndex !== undefined)
            nodState.Instance().currentFrameIndex = newIndex
        }
      }

      notebookPanel?.sessionContext.statusChanged.connect((context, status) => {
        console.log("STATUS CHANGED", status)
        if (status == 'restarting') {
          // const sessionManager = context.sessionManager
          // console.log("RESTARTING ALL")
          // await sessionManager.refreshRunning();
          // const content: KernelMessage.IExecuteRequestMsg['content'] = {
          //   code: 'quit',
          //   silent: true,
          //   store_history: false
          // };
          // await Promise.resolve(context.session?.kernel?.requestExecute(content));
          // await Promise.all(
          //   [...sessionManager.running()].filter(model => model.name === 'nod').map(model => sessionManager.shutdown(model.id))
          // );
          // await sessionManager.refreshRunning();
          // Array.from(app.serviceManager).forEach(session => {
          //   session.
          // })

          nodState.Instance().status == 'inactive'
          checkKernelStatus()
        }
      })
    })

    nodState.Instance().currentFrameChanged.connect((state, frameNum) => {
      callStackModel.frame = callStackModel.frames[frameNum]
      const notebookFile = nodState.Instance().currentFrame?.notebook_file
      notebookFile ? openNotebookWithNodKernel(notebookFile, docManager) : {}
      console.log("Switching to frame ", frameNum)
      const future = requestDebug("nod_switch", frameNum
      )
      if (future !== null) {
        future.onReply = async msg => {
          console.log("DEBUG RESPONSE", msg)
        }
      }
    })

    callStackModel.currentFrameChanged.connect((model, frame) => {
      if (frame?.id !== undefined) {
        nodState.Instance().currentFrameIndex = frame?.id
        console.log("CallSTackModelOPen")
      }
    })

    function kernelWaitDialog() {
      if (nodState.Instance().status == 'active') {
        return
      }
      if (dialogID === "") {
        const dialog = new Dialog({
          title: "Waiting for Nod Kernel...",
          body: "Call notebook() from a Python file in the same directory",
          buttons: [Dialog.okButton({ label: "Refresh" })]
        });
        dialogID = dialog.id
        dialog.launch().then(() => {
          checkKernelStatus()
        });
      }
    }

    function checkKernelStatus() {
      console.log("Check Kernel Status")

      const manager = nodState.Instance().app.serviceManager.kernels
      manager.refreshRunning().then(() => {
        const nodKernel = Array.from(manager.running())
          .find(val =>
            val.name === "nod" &&
            val.execution_state &&
            (['idle', 'busy'].includes(val.execution_state)))
        if (nodKernel !== undefined) {
          console.log("REFRESHING NOD STATE Found Nod Kernel")
          const idSearch = Dialog.tracker.find(dialog => dialog.id === dialogID)
          if (idSearch !== undefined) {
            idSearch.resolve()
          }
          dialogID = ""
          // docManager.closeAll()
          sidebar.activate()
          getNodInfo()
        } else {
          console.log("setting to inactive")
          nodState.Instance().status = 'inactive'
          getNodKernel().then((id) => kernelWaitDialog())
        }
      })
    }


    app.serviceManager.kernels.runningChanged.connect((manager, model) => {
      console.log('running changed')
      checkKernelStatus()
      // console.log(nodKernel)

      if (app.serviceManager.kernels.running()) {

      }
      // docManager.registry.getKernelPreference
      getNodKernel()

    })
    app.started.then(() => {
      console.log('started')
      docManager.closeAll()
      sidebar.activate()
      //TODO close all besides the ones we want to open?
    })
    app.restored.then(() => {
      // console.log('restored')
      // (app.shell as LabShell).updateConfig({ hiddenMode: 'display' })
      // if (app.serviceManager.kernelspecs.specs?.default) {
      //   app.serviceManager.kernelspecs.specs.default = 'nod'
      // }

      // const manager = app.serviceManager.kernels
      // for (const kernel of Array.from(manager.running())) {
      //   if (kernel.name !== 'nod') {
      //     manager.shutdown(kernel.id)
      //   }
      // }
      checkKernelStatus();
      (app.shell as LabShell).activateById(sidebar.id);
      (sidebar.content as AccordionPanel).expand(0)
    })

    nodState.Instance().statusChanged.connect((state, status) => {
      if (status === 'active') {
        console.log("Nod ACTIVE")
        const currentNotebookPath = notebookTracker.currentWidget?.context.path ?? ""
        const selectedFrame = state.getFrameFromPath(currentNotebookPath)
        const selectedIndex = selectedFrame ? state.pythonInfo?.indexOf(selectedFrame) : 0
        if (selectedIndex) {
          console.log("Setting index on active to", selectedIndex)
          state.currentFrameIndex = selectedIndex
        }
        const currentFrame = state.currentFrame
        if (currentFrame) {
          const openNotebook = notebookTracker.find((panel) => currentFrame.notebook_file.includes(panel.context.path))
          if (openNotebook === undefined) {
            openNotebookWithNodKernel(currentFrame.notebook_file, docManager)
          }
        }

        // const options = {
        //   ignoreAttributes: false,
        //   attributeNamePrefix: "@_",
        // };
        // const parser2 = new XMLParser(options);
        // const parsed = state.pythonInfo?.map((frame, index) => {
        //   return parser2.parse(frame.frame_xml);

        // })
        const frames = state.pythonInfo?.map((frame, index) => {
          return ({ id: index, name: frame.function_name, source: { path: frame.source_file, name: frame.relative_source_file }, scope: { name: frame.function_name, variables: [{ name: 'a', value: '10' }] } } as INodStackFrame)
        })
        if (frames) {
          console.log('setting frames', state.currentFrameIndex)
          callStackModel.setFrames(frames, state.currentFrameIndex)
        }
      }
    })




    console.log(Array.from(app.serviceManager.kernels.running()))
    console.log(app.serviceManager.kernelspecs.specs?.kernelspecs)





    // console.log("INFO")
    // console.log(info)
    // console.log(atob(info))





    // notebookTracker.activeCellChanged.connect((tracker, panel) => {

    // console.log(nodState.Instance().currentFrame)



    // END CURRENT

    // notebookTracker.widgetAdded.connect((tracker, panel) => {
    //   console.log(panel.sessionContext.kernelPreference)
    //   console.log(panel.sessionContext.specsManager.specs)
    //   // for (let kernel in panel.sessionContext.kernelManager?.running()) {
    //   //   console.log("KERNEL", kernel)
    //   //   console.log(panel.sessionContext.kernelManager.findById(kernel).then((k) => {
    //   //     console.log(k)
    //   //   }))
    //   // }
    //   // console.log("PREVIOUS KERNEL NAME", panel.sessionContext.prevKernelName)
    //   // panel.sessionContext.kernelManager?.ready.then(() => {
    //   //   panel.sessionContext.kernelManager?.findById(panel.sessionContext.prevKernelName).then((model) => {
    //   //     console.log(model)
    //   //   })
    //   // })
    //   const specsManager = panel.sessionContext.specsManager

    //   const defaultSpec = specsManager.specs?.kernelspecs[specsManager.specs?.default ?? ""]
    //   if (defaultSpec?.language === "python") {
    //     panel.sessionContext.kernelPreference.id

    //   }

    // })
    // console.log("Kernelspecs", kernelSpec.specs?.kernelspecs)

    // const languageInfo = {
    //   name: "python",
    //   version: "3.14.3",
    //   mimetype: "text/x-python",
    //   codemirror_mode: {
    //     name: "ipython",
    //     version: 3
    //   },
    //   pygments_lexer: "ipython3",
    //   nbconvert_exporter: "python",
    //   file_extension: ".py"
    // }
    // notebookTracker.currentChanged.connect((tracker, panel) => {
    //   const model = panel?.model
    //   if (model) {
    //     console.log("setMetadatainChanged")
    //     model.sharedModel.setMetadata('language_info', languageInfo)
    //     model.setMetadata('language_info', languageInfo)
    //     console.log(model.sharedModel.getSource())
    //     model.sharedModel.setSource(model.sharedModel.getSource())
    //   }
    // })
    // notebookTracker.currentWidget..then(() => {
    //   console.log("revealed")

    // })
    // notebookTracker.restored.then(() => {
    //   console.log("setMetadata")

    //   notebookTracker.currentWidget?.model?.setMetadata('language_info', languageInfo)
    // })
    // notebookTracker.currentWidget?.model?.setMetadata('language_info', languageInfo)
    // const kernel = notebookTracker.currentWidget?.sessionContext.session?.kernel;
    // console.log(kernel?.spec)
    // console.log(kernel?.info)

    // Promise.all([app.restored])
    //   .then(() => {
    //     console.log("PROMISE RESOLVED")
    //     notebookTracker.currentWidget?.context.sessionContext.ready.then(() => {
    //       console.log("SESSION CONTEXT READY")
    //       notebookTracker.currentWidget?.context.sessionContext.session?.kernel?.info.then((info) => {
    //         console.log("SETTING LANGUAGE INFO", info.language_info)

    //       })
    //       notebookTracker.currentWidget?.context.sessionContext.session?.kernel?.spec.then((spec) => {
    //         notebookTracker.currentWidget?.model?.setMetadata('kernelspec', {
    //           name: spec?.name,
    //           display_name: spec?.display_name,
    //           language: spec?.language
    //         });
    //       })

    //     })

    //     // ?.session?.kernel?.info.then(info => {

    //     // })

    //     // this.model!.setMetadata('language_info', language)


    //     // const notebook = nodState.Instance().tracker.currentWidget?.content
    //     // if (notebook?.activeCell && !notebook?.activeCell.inViewport) {
    //     //   notebook?.scrollToCell(notebook.activeCell)
    //     // }
    //   })
    // notebookTracker.widgetAdded.connect(
    //   (sender: INotebookTracker, panel: NotebookPanel) => {
    //     console.log("WidgetAdded")
    //     const model = panel.model
    //     if (model) {
    //       console.log("setMetadataInAdded")
    //       model.sharedModel.setMetadata('language_info', languageInfo)
    //       model.setMetadata('language_info', languageInfo)
    //       panel.update()
    //     }
    //     if (panel.sessionContext.session?.kernel) {
    //       // insertCodeViewers(panel)
    //     }
    //   }
    // )

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



    // const mimeService = new CodeMirrorMimeTypeService(languages);
    // const editorFactory =
    //   editorServices.factoryService.newInlineEditor.bind(
    //     editorServices.factoryService
    //   );
    // const rendermime = new RenderMimeRegistry({ initialFactories });


    // const cellWidget = new CodeCell({
    //   contentFactory: new Cell.ContentFactory({
    //     editorFactory: factoryService.newInlineEditor.bind(factoryService)
    //   }),
    //   rendermime,
    //   model: model,
    // }).initializeState();


    // const pythonInfo = nodState.Instance().pythonInfo
    // if (pythonInfo) {
    //   const sourceHeader = pythonInfo?.text_above.join('').split('\\n').join('\n')
    //   console.log("SOURCEHEADER", sourceHeader, typeof (sourceHeader))
    //   model.sharedModel.setSource(sourceHeader)


    // }



    // notebookTracker.currentChanged.connect((tracker, notebook) => {
    //   console.log("currentChanged")
    //   // nodState.Instance().tracker = tracker


    //   tracker?.currentWidget?.sessionContext?.connectionStatusChanged.connect((sessioncontext, status) => {
    //     console.log("connectionStatusChanged")

    //     for (let kernel in sessioncontext.kernelManager?.running()) {
    //       console.log("KERNEL", kernel)
    //       console.log("session", sessioncontext.session)
    //       console.log(sessioncontext.kernelManager.findById(kernel).then((k) => {
    //         console.log(k)
    //       }))
    //     }
    //   });
    // });
    // https://github.com/fails-components/jupyterfails/blob/master/packages/interceptor/src/index.ts



    // contentsManager.save(".nod/test11", { content: 'bar' }).then()

    // ServerConnection.makeRequest(url, init, settings);

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

    // notebookTracker.currentChanged.connect(() => {

    // })
    //   notebookTracker.currentWidget?.revealed.then(() => {
    //     notebook = notebookTracker.current
    //     notebookTracker.currentWidget?.contentHeader.addWidget
    //     // notebook.contentHeader.addWidget(state.headerWidget);
    //   });
  },

}

export default plugin;
