

import { ISessionContextDialogs, IToolbarWidgetRegistry } from "@jupyterlab/apputils";
import { IDisposable, DisposableDelegate } from '@lumino/disposable';

import {
    ToolbarButton,
} from '@jupyterlab/apputils';
import { DocumentRegistry } from '@jupyterlab/docregistry';
// import {
//   Toolbar as AppToolbar,
// } from '@jupyterlab/apputils';

import { NotebookPanel, INotebookModel } from '@jupyterlab/notebook';
import { nodState } from "./state";
import { nodCommands } from "./commands";
export class NodExportButton
    implements DocumentRegistry.IWidgetExtension<NotebookPanel, INotebookModel> {
    /**
     * Create a new extension object.
     */
    createNew(
        panel: NotebookPanel,
        context: DocumentRegistry.IContext<INotebookModel>,
    ): IDisposable {

        const button = new ToolbarButton({
            className: 'nod-export',
            iconClass: 'fas fa-download ',
            onClick: (): void => {
                nodState.Instance().app.commands.execute(nodCommands.exportNotebook)
            },
            tooltip: 'Export Code',
            label: 'Export Code',
        })
        if (nodState.Instance().isMainFile(panel)) {
            panel.toolbar.insertItem(9, 'export', button);
        }
        return new DisposableDelegate(() => {
            button.dispose
        });
    }
}
export class NodQuitButton
    implements DocumentRegistry.IWidgetExtension<NotebookPanel, INotebookModel> {
    /**
     * Create a new extension object.
     */
    createNew(
        panel: NotebookPanel,
        context: DocumentRegistry.IContext<INotebookModel>,
    ): IDisposable {

        const button = new ToolbarButton({
            className: 'nod-Close',
            onClick: (): void => {
                nodState.Instance().app.commands.execute(nodCommands.exitNotebook)
            },
            tooltip: 'Exit Nod Session',
            label: 'Exit Nod Session',
        })
        if (nodState.Instance().isMainFile(panel)) {
            panel.toolbar.insertItem(9, 'exit', button);
        }
        return new DisposableDelegate(() => {
            button.dispose
        });
    }
}

export function addToolbarButtons() {
    nodState.Instance().app.docRegistry.addWidgetExtension('Notebook', new NodExportButton());
    nodState.Instance().app.docRegistry.addWidgetExtension('Notebook', new NodQuitButton());
}
export function disableKernelSwitching(sessionContextDialogs: ISessionContextDialogs, toolbarRegistry: IToolbarWidgetRegistry) {
    sessionContextDialogs.selectKernel = () => { return Promise.resolve() }
    toolbarRegistry.addFactory<NotebookPanel>('Notebook', 'kernelName', panel => {
        return new ToolbarButton({
            className: 'nod-kernelName',
            onClick: (): void => {
            },
            tooltip: 'Cannot Switch Kernel In Embedded Mode',
            label: 'Nod Kernel',
        })
    }
    );
}
