import {
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
  ],
  optional: [ISettingRegistry],
  activate: (app: JupyterFrontEnd, settingRegistry: ISettingRegistry | null,
    notebookTracker: INotebookTracker,
    contentsManager: Contents.IManager,) => {
    console.log('JupyterLab extension nod is activated!');

    // const contentsManager = new ContentsManager();
    contentsManager.get('.nod/test11.py', { type: "file", content: true }).then(val => {
      console.log("CONTENT", typeof (val.content))
      console.log(val.content)
      console.log(val)

      const newModel = {
        ...val,
        content: "tests"
      } as Contents.IModel;

      contentsManager.save('.nod/test11.py', newModel).catch(error => console.log(error))
      return null
    })



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
  }
}

export default plugin;
