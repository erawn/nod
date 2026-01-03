import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import {
  INotebookTracker,
} from '@jupyterlab/notebook';

import { ISettingRegistry } from '@jupyterlab/settingregistry';

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
  ],
  optional: [ISettingRegistry],
  activate: (app: JupyterFrontEnd, settingRegistry: ISettingRegistry | null, notebookTracker: INotebookTracker) => {
    console.log('JupyterLab extension nod is activated!');

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

    notebookTracker.currentChanged.connect(() => {

    })
    //   notebookTracker.currentWidget?.revealed.then(() => {
    //     notebook = notebookTracker.current
    //     notebookTracker.currentWidget?.contentHeader.addWidget
    //     // notebook.contentHeader.addWidget(state.headerWidget);
    //   });
  }
}

export default plugin;
