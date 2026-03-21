import {
  ILabShell,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import {
  INotebookTracker,
} from '@jupyterlab/notebook';

import { ISettingRegistry } from '@jupyterlab/settingregistry';
import {
  Contents,
  IContentsManager,
} from '@jupyterlab/services'
import { nodState } from './state';
import { PageConfig } from '@jupyterlab/coreutils';
import { IMainMenu } from '@jupyterlab/mainmenu';
import { ITranslator, nullTranslator } from '@jupyterlab/translation';
import { addCommands } from './commands';
import { ICommandPalette, ISessionContextDialogs, IToolbarWidgetRegistry } from '@jupyterlab/apputils';
import { addToolbarButtons, VariablesBodyTree } from './buttons';
import {
  IConsoleTracker
} from '@jupyterlab/console';
import { nodSchema } from './types';
import { CodeViewers } from './codeViewers';
import { bugIcon, buildIcon, PanelWithToolbar, SidePanel } from '@jupyterlab/ui-components';
import { IDebugger } from '@jupyterlab/debugger';
import { requestDebug } from './messaging';
import { requestAPI } from './request';
/**
 * Initialization data for the nod extension.
 */
export function createNode(): HTMLElement {
  const span = document.createElement('span');
  span.textContent = 'My custom header';
  return span;
}



class frameStack extends PanelWithToolbar {
  private _tree: VariablesBodyTree;
  constructor() {
    super();
    const translator = nullTranslator;
    const trans = translator.load('jupyterlab');
    this.title.label = trans.__('Variables');
    this.toolbar.addClass('jp-DebuggerVariables-toolbar');
    this.toolbar.node.setAttribute('aria-label', trans.__('Variables toolbar'));
    this._tree = new VariablesBodyTree();

    this.addWidget(this._tree);
    this.addClass('jp-DebuggerVariables');
  }
}


export class NodSidebar extends SidePanel {
  /**
   * Instantiate a new Debugger.Sidebar
   *
   * @param options The instantiation options for a Debugger.Sidebar
   */
  constructor(options: { translator: ITranslator }) {
    const translator = options.translator || nullTranslator;
    super({ translator });
    this.id = 'jp-debugger-sidebar';
    this.title.icon = bugIcon;
    this.addClass('jp-DebuggerSidebar');

    this.content.addClass('jp-DebuggerSidebar-body');

    const widget = new frameStack()

    this.addWidget(widget);
  }
}

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
    IDebugger
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
    debug: IDebugger,
  ) => {
    const isActive = PageConfig.getOption('nod_active');
    console.log("nod_active", isActive)
    if (isActive !== 'true') {
      console.log("Nod extension loaded, but not called from a nod() call, deactivating")
      return
    }

    console.log('JupyterLab extension nod is activated!');


    const info = PageConfig.getOption('nod_info') //.slice(1); //Bytestring has "b" in front of it
    console.log("INFO")
    console.log(info)
    console.log(atob(info))
    const jsonObj = JSON.parse(atob(info))
    const schema = nodSchema.parse(jsonObj)
    // nodState.Instance().pythonInfo = schema

    nodState.Instance(notebookTracker, app, contentsManager, schema, translator) // initialize singleton with tracker
    nodState.Instance().status = 'active'
    const widget = new NodSidebar({ translator });
    widget.title.icon = buildIcon;
    widget.title.caption = 'Nod Stack';
    widget.id = 'jp-nod-inspector';
    app.shell.add(widget, 'right', { type: 'Debugger' });
    widget.show() //TODO 
    notebookTracker.activeCellChanged.connect((tracker, panel) => {
      requestAPI<any>('hello', app.serviceManager.serverSettings)
        .then(data => {
          console.log(data);
        })
        .catch(reason => {
          console.error(
            `The jupyterlab_examples_server server extension appears to be missing.\n${reason}`
          );
        });
      const future = requestDebug('nod_info')
      console.log('updated')
      if (future) {
        future.onReply = async msg => {
          const jsonObj = JSON.parse(atob(msg.content.body))
          console.log(jsonObj)
        }
      }
    })

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
    addToolbarButtons(sessionContextDialogs, toolbarRegistry)
    addCommands(mainMenu, translator, palette, consoleTracker)
    app.docRegistry.addWidgetExtension('Notebook', new CodeViewers());
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

