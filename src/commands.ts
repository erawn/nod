import { IMainMenu } from "@jupyterlab/mainmenu";
import { ITranslator } from "@jupyterlab/translation";
import { nodState } from "./state";
import { exitSession, requestDebug, writeChange } from "./messaging";
import { ICommandPalette, showDialog, Dialog, } from "@jupyterlab/apputils";
import {
    IConsoleTracker,
} from '@jupyterlab/console';
import { checkIcon } from "@jupyterlab/ui-components";
import { requestAPI } from "./request";
export namespace nodCommands {
    export const changeKernel = 'nod:changeKernel';
    export const clearAllOutputs = 'nod:clearAllOutputs';
    export const interrupt = 'nod:interrupt';
    export const reconnectToKernel = 'nod:reconnectToKernel';
    export const restart = 'nod:restart';
    export const shutdown = 'nod:shutdown';
    export const exportNotebook = 'nod:export'
    export const exitNotebook = 'nod:exitNotebook'
    export const toggleForExport = "nod:toggle-for-export"
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
export function addCommands(mainMenu: IMainMenu, translator: ITranslator, palette: ICommandPalette, consoleTracker: IConsoleTracker) {

    const { commands } = nodState.Instance().app
    const tracker = nodState.Instance().tracker
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
        return nodState.Instance().status === 'active'
    };
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
            tracker.activeCell?.toggleClass('nod-export')
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
            writeChange()
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
            console.log("dialog")
            return showDialog({
                title: trans.__('Shut Down Nod Session?'),
                body: trans.__(
                    'Are you sure you want to close the Nod Session?'
                ),
                buttons: [
                    Dialog.cancelButton({
                        ariaLabel: trans.__('Cancel console Shut Down'),
                    }),
                    Dialog.warnButton({
                        ariaLabel: trans.__('Exit Without Saving'),
                        label: 'Shut Down Without Saving'
                    }),
                    Dialog.okButton({
                        ariaLabel: trans.__('Export and Shut Down'),
                        label: 'Export and Shut Down'
                    })
                ]
            }).then(result => {
                console.log(result)
                if (result.button.accept) {
                    if (result.button.label === 'Export and Shut Down') {
                        writeChange()
                    }
                    exitSession()
                    return commands
                        .execute('console:shutdown', { activate: false })
                        .then(() => {
                            nodState.Instance().tracker.currentWidget?.dispose()
                            return true;
                        });
                } else {
                    return false;
                }
            });
        },
        isEnabled
    });
    //     commands.addCommand(nodCommands.restart, {
    //         label: trans.__('Restart Kernel'),
    //         describedBy: {
    //             args: {
    //                 type: 'object',
    //                 properties: {
    //                     activate: {
    //                         type: 'boolean',
    //                         description: trans.__('Restart Kernel')
    //                     }
    //                 }
    //             }
    //         },
    //         execute: args => {
    //             // console.log("Restarting Notebook")
    //             // requestAPI<any>('hello', app.serviceManager.serverSettings)
    //             //     .then(data => {
    //             //         // console.log(data);
    //             //     })
    //             //     .catch(reason => {
    //             //         console.error(
    //             //             `The jupyterlab_examples_server server extension appears to be missing.\n${reason}`
    //             //         );
    //             //     });
    //             // const future = requestDebug('nod_info')
    //             // console.log('updated')
    //             // if (future) {
    //             //     future.onReply = async msg => {
    //             //         // const jsonObj = JSON.parse(atob(msg.content.body))
    //             //         // console.log(jsonObj)
    //             //     }
    //             // }
    //         })
    //     return showDialog({
    //         title: trans.__('Shut Down Nod Session?'),
    //         body: trans.__(
    //             'Are you sure you want to close the Nod Session?'
    //         ),
    //         buttons: [
    //             Dialog.cancelButton({
    //                 ariaLabel: trans.__('Cancel console Shut Down'),
    //             }),
    //             Dialog.warnButton({
    //                 ariaLabel: trans.__('Exit Without Saving'),
    //                 label: 'Shut Down Without Saving'
    //             }),
    //             Dialog.okButton({
    //                 ariaLabel: trans.__('Export and Shut Down'),
    //                 label: 'Export and Shut Down'
    //             })
    //         ]
    //     }).then(result => {
    //         console.log(result)
    //         if (result.button.accept) {
    //             if (result.button.label === 'Export and Shut Down') {
    //                 writeChange()
    //             }
    //             exitSession()
    //             return commands
    //                 .execute('console:shutdown', { activate: false })
    //                 .then(() => {
    //                     nodState.Instance().tracker.currentWidget?.dispose()
    //                     return true;
    //                 });
    //         } else {
    //             return false;
    //         }
    //     });
    // },
    // isEnabled
    //     });


    const category = "Nod";
    [nodCommands.exitNotebook, nodCommands.exportNotebook].forEach((cmd: string) => palette.addItem({ command: cmd, category }))


    mainMenu.kernelMenu.kernelUsers.changeKernel.add({
        id: nodCommands.changeKernel,
        isEnabled,
        rank: -1,
    });
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
    mainMenu.kernelMenu.kernelUsers.restartKernel.add({
        id: nodCommands.restart,
        isEnabled,
        rank: 0,
    });
    // mainMenu.kernelMenu.kernelUsers.shutdownKernel.add({
    //     id: CommandIDs.shutdown,
    //     isEnabled,
    //     rank: 0,
    // });
}
