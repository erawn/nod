import { IMainMenu } from '@jupyterlab/mainmenu';
import { ITranslator } from '@jupyterlab/translation';
import { nodState } from './state';
import { exitSession, writeChange } from './messaging';
import { ICommandPalette, showDialog, Dialog } from '@jupyterlab/apputils';
import { IConsoleTracker } from '@jupyterlab/console';
import { checkIcon } from '@jupyterlab/ui-components';
import { CommandRegistry } from '@lumino/commands';
import { INotebookTracker } from '@jupyterlab/notebook';
import { NodRestart } from './kernelHelpers';
export namespace nodCommands {
  export const changeKernel = 'nod:changeKernel';
  export const clearAllOutputs = 'nod:clearAllOutputs';
  export const interrupt = 'nod:interrupt';
  export const reconnectToKernel = 'nod:reconnectToKernel';
  export const restart = 'nod:restart';
  export const shutdown = 'nod:shutdown';
  export const exportNotebook = 'nod:export';
  export const exitNotebook = 'nod:exitNotebook';
  export const toggleForExport = 'nod:toggle-for-export';
  export const pullSourceChanges = 'nod:pullSourceChanges'
}

// namespace NotebookCommands {
//     export const interrupt = 'notebook:interrupt-kernel';

//     export const restart = 'notebook:restart-kernel';

//     export const restartClear = 'notebook:restart-clear-output';

//     export const restartAndRunToSelected = 'notebook:restart-and-run-to-selected';

//     export const restartRunAll = 'notebook:restart-run-all';

//     export const reconnectToKernel = 'notebook:reconnect-to-kernel';

//     export const changeKernel = 'notebook:change-kernel';
//     export const shutdown = 'notebook:shutdown-kernel';
//     export const closeAndShutdown = 'notebook:close-and-shutdown';
// }
// function getCurrent(args: ReadonlyPartialJSONObject, tracker: IConsoleTracker): ConsolePanel | null {
//     const widget = args[SemanticCommand.WIDGET]
//         ? (tracker.find(panel => panel.id === args[SemanticCommand.WIDGET]) ??
//             null)
//         : tracker.currentWidget;
//     const activate = args['activate'] !== false;
//     if (activate && widget) {
//         nodState.Instance().app.shell.activateById(widget.id);
//     }
//     return widget;
// }
export function addCommands(
  commands: CommandRegistry,
  mainMenu: IMainMenu,
  translator: ITranslator,
  palette: ICommandPalette,
  consoleTracker: IConsoleTracker,
  tracker: INotebookTracker
) {
  const trans = translator.load('jupyterlab');
  // commands.addCommand(nodCommands.changeKernel, {
  //     label: trans.__('Cannot Change Kernel In Nod Notebook'),
  //     describedBy: {
  //         args: {
  //             type: 'object',
  //             properties: {
  //                 activate: {
  //                     type: 'boolean',
  //                     description: trans.__('Whether to activate the widget')
  //                 }
  //             }
  //         }
  //     },
  //     execute: args => {
  //         console.log("CHANGE KERNEL FIRE")
  //         // const current = getCurrent(args);
  //         // if (!current) {
  //         //   return;
  //         // }
  //         // return sessionDialogs.selectKernel(current.console.sessionContext);
  //     },
  //     isEnabled: args => {
  //         return false
  //     }

  // });
  function isEnabled(): boolean {
    return tracker.currentWidget?.sessionContext.kernelDisplayName === 'nod';
    return true;
  }
  commands.addCommand(nodCommands.toggleForExport, {
    icon: checkIcon,
    label: trans.__('Toggle Cell for Nod Export'),
    describedBy: {
      args: {
        type: 'object',
        properties: {
          activate: {
            type: 'boolean',
            description: trans.__('Toggle Cell for Nod Export')
          }
        }
      }
    },
    execute: args => {
      tracker.activeCell?.toggleClass('nod-export');
    },
    isVisible: () => tracker.activeCell?.model.type === 'code',
    isEnabled
  });
  commands.addCommand(nodCommands.exportNotebook, {
    label: trans.__('Export Code'),
    describedBy: {
      args: {
        type: 'object',
        properties: {
          activate: {
            type: 'boolean',
            description: trans.__('Export Code')
          }
        }
      }
    },
    execute: args => {
      //TODO--check if this is the locked nb
      const frame = nodState.Instance().currentFrame;
      const panel = nodState.Instance().tracker.currentWidget;
      if (frame !== undefined && panel !== null) {
        writeChange(panel, frame).then(() => { });
      }
    },
    isEnabled
  });
  commands.addCommand(nodCommands.pullSourceChanges, {
    label: trans.__('Pull Source Changes'),
    describedBy: {
      args: {
        type: 'object',
        properties: {
          activate: {
            type: 'boolean',
            description: trans.__('Pull Source Changes')
          }
        }
      }
    },
    execute: args => {
      //TODO--check if this is the locked nb
      const frame = nodState.Instance().currentFrame;
      const panel = nodState.Instance().tracker.currentWidget;
      if (frame !== undefined && panel !== null) {
        writeChange(panel, frame).then(() => { });
      }
    },
    isEnabled
  });
  commands.addCommand(nodCommands.restart, {
    label: trans.__('Restart'),
    describedBy: {
      args: {
        type: 'object',
        properties: {
          activate: {
            type: 'boolean',
            description: trans.__('Restart')
          }
        }
      }
    },
    execute: args => {
      NodRestart();
    },
    isEnabled
  });
  commands.addCommand(nodCommands.exitNotebook, {
    label: trans.__('Exit Nod Session'),
    describedBy: {
      args: {
        type: 'object',
        properties: {
          activate: {
            type: 'boolean',
            description: trans.__('Exit Nod Session')
          }
        }
      }
    },
    execute: args => {
      console.log('dialog');
      return showDialog({
        title: trans.__('Shut Down Nod Session?'),
        body: trans.__('Are you sure you want to close the Nod Session?'),
        buttons: [
          Dialog.cancelButton({
            ariaLabel: trans.__('Cancel console Shut Down')
          }),
          Dialog.warnButton({
            ariaLabel: trans.__('Exit Without Saving'),
            label: trans.__('Shut Down Without Saving'),
            accept: true
          }),
          Dialog.okButton({
            ariaLabel: trans.__('Export and Shut Down'),
            label: trans.__('Export and Shut Down')
          })
        ]
      }).then(result => {
        console.log(result);
        if (result.button.accept) {
          const frame = nodState.Instance().currentFrame;
          const panel = nodState.Instance().tracker.currentWidget;
          const state = nodState.Instance();
          state.unlock();
          if (result.button.label === 'Export and Shut Down') {
            state.unlock();
            if (frame !== undefined && panel !== null) {
              writeChange(panel, frame).then(() => {
                console.log('Exiting Nod Session');
                exitSession(state.nodKernelId);
              });
            } else {
              console.log('Exiting Nod Session');
              exitSession(state.nodKernelId);
            }
            // return commands
            //     .execute('console:shutdown', { activate: false })
            //     .then(() => {
            //         nodState.Instance().tracker.currentWidget?.dispose()
            //         return true;
            //     });
          } else {
            console.log('Exiting Nod Session');
            exitSession(state.nodKernelId);
          }
        }
      });
    },
    isEnabled
  });
  // commands.addCommand(nodCommands.restart, {
  //     label: trans.__('Restart Kernel'),
  //     describedBy: {
  //         args: {
  //             type: 'object',
  //             properties: {
  //                 activate: {
  //                     type: 'boolean',
  //                     description: trans.__('Restart Kernel')
  //                 }
  //             }
  //         }
  //     },
  //     execute: args => {
  //         console.log("Restarting Notebook")
  //         // requestAPI<any>('hello', app.serviceManager.serverSettings)
  //         //     .then(data => {
  //         //         // console.log(data);
  //         //     })
  //         //     .catch(reason => {
  //         //         console.error(
  //         //             `The jupyterlab_examples_server server extension appears to be missing.\n${reason}`
  //         //         );
  //         //     });
  //         const content: KernelMessage.IExecuteRequestMsg['content'] = {
  //             code: 'quit',
  //             silent: true,
  //             store_history: false
  //         };
  //         // const future = requestDebug('nod_info')
  //         // console.log('updated')
  //         // if (future) {
  //         //     future.onReply = async msg => {
  //         //         // const jsonObj = JSON.parse(atob(msg.content.body))
  //         //         // console.log(jsonObj)
  //         //     }
  //         // }
  //         return showDialog({
  //             title: trans.__('Shut Down Nod Session?'),
  //             body: trans.__(
  //                 'Are you sure you want to restart the Nod Session?'
  //             ),
  //             buttons: [
  //                 Dialog.cancelButton({
  //                     ariaLabel: trans.__('Cancel Restart'),
  //                 }),
  //                 Dialog.okButton({
  //                     ariaLabel: trans.__('Restart Notebook'),
  //                     label: 'Restart Nod Session'
  //                 })
  //             ]
  //         }).then(async result => {
  //             console.log(result)

  //             if (result.button.accept) {
  //                 try {
  //                     await Promise.all([
  //                         nodState.Instance().app.serviceManager.sessions.shutdownAll(),
  //                         nodState.Instance().app.serviceManager.terminals.shutdownAll()
  //                     ]);
  //                 } catch (e) {
  //                     // Do nothing
  //                     console.log(`Failed to shutdown sessions and terminals: ${e}`);
  //                 }
  //                 await Promise.resolve(nodState.Instance().tracker.currentWidget?.sessionContext.session?.kernel?.requestExecute(content));
  //             }
  //         });
  //     },
  //     isEnabled
  // });

  const category = 'Nod';
  [
    nodCommands.exitNotebook,
    nodCommands.exportNotebook,
    nodCommands.restart
  ].forEach((cmd: string) => palette.addItem({ command: cmd, category }));

  // mainMenu.kernelMenu.kernelUsers.changeKernel.add({
  //   id: nodCommands.changeKernel,
  //   isEnabled,
  //   rank: -1
  // });
  // mainMenu.kernelMenu.kernelUsers.clearWidget.add({
  //     id: CommandIDs.clearAllOutputs,
  //     isEnabled,
  //     rank: 0,
  // });
  // mainMenu.kernelMenu.kernelUsers.interruptKernel.add({
  //     id: CommandIDs.interrupt,
  //     isEnabled,
  //     rank: 0,
  // });
  // mainMenu.kernelMenu.kernelUsers.reconnectToKernel.add({
  //     id: CommandIDs.reconnectToKernel,
  //     isEnabled,
  //     rank: 0,
  // });
  // mainMenu.kernelMenu.kernelUsers.restartKernel.add({
  //     id: nodCommands.restart,
  //     isEnabled,
  //     rank: 0,
  // });
  // mainMenu.kernelMenu.kernelUsers.shutdownKernel.add({
  //     id: CommandIDs.shutdown,
  //     isEnabled,
  //     rank: 0,
  // });
}
