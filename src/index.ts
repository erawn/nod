import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import {
  INotebookTracker,
} from '@jupyterlab/notebook';

import {
  checkIcon
} from '@jupyterlab/ui-components'

import { ISettingRegistry } from '@jupyterlab/settingregistry';
import {
  Contents,
  IContentsManager,
} from '@jupyterlab/services'
import { checkNodInfo } from './messaging';
import { nodState } from './state';
// import { addStyling } from './addStyling';
import { PageConfig } from '@jupyterlab/coreutils';
// import { nodState } from './state';
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
  activate: (app: JupyterFrontEnd,
    notebookTracker: INotebookTracker,
    settingRegistry: ISettingRegistry | null,
    contentsManager: Contents.IManager,) => {

    const isActive = PageConfig.getOption('nod_active');
    console.log("nod_active", isActive)
    if (isActive !== 'true') {
      console.log("Nod extension loaded, but not called from a nod() call, deactivating")
      return
    }

    nodState.Instance(notebookTracker, app, contentsManager) // initialize singleton with tracker
    console.log('JupyterLab extension nod is activated!');

    if (settingRegistry) {
      Promise.all([app.restored, settingRegistry.load(plugin.id)])
        .then(([_, setting]) => {
          const onSettingsUpdate = () => {
            console.log("settings updated!")
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

    // const contentsManager = new ContentsManager();
    // console.log('update!')
    // notebookTracker.activeCellChanged.connect(() => {
    //   addStyling(notebookTracker)
    //   const panel = notebookTracker.currentWidget
    //   if (panel?.sessionContext.session?.kernel) {
    //     panel.sessionContext.session.model
    //     panel.sessionContext.session?.kernel.anyMessage.connect((sender, args) => {
    //       console.log("MSG")
    //       const { direction, msg } = args
    //       if (direction === 'send') {
    //         msg.header.msg_type ==
    //           console.log("MESSAGE")
    //         console.log(msg)
    //       }
    //     })
    //   }
    // })

    // notebookTracker.currentWidget?.sessionContext.connectionStatusChanged.connect(() => {
    //   const panel = notebookTracker.currentWidget
    //   if (panel?.sessionContext.session?.kernel) {
    //     panel.sessionContext.
    //       panel.sessionContext.session?.kernel.anyMessage.connect((sender, args) => {
    //         const { direction, msg } = args
    //         if (direction === 'send') {
    //           console.log("MESSAGE")
    //           console.log(msg)
    //         }
    //       })
    //   }
    // })

    notebookTracker.currentChanged.connect((tracker, notebook) => {
      console.log("currentChanged")
      nodState.Instance().tracker = tracker
      checkNodInfo()


      tracker?.currentWidget?.sessionContext?.connectionStatusChanged.connect(() => {
        console.log("connectionStatusChanged")
        checkNodInfo()
      });
    });
    // https://github.com/fails-components/jupyterfails/blob/master/packages/interceptor/src/index.ts
    // notebookTracker.widgetAdded.connect(

    // )

    app.commands.addCommand('toolbar-button:add-pagebreak', {
      icon: checkIcon,
      caption: 'Mark This Cell To Export',
      execute: () => {

        const cell = notebookTracker.activeCell
        cell?.toggleClass('nod-export')
      },
      isVisible: () => {
        return nodState.Instance().status === 'active'
      },
      isToggleable: true,

    });


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

