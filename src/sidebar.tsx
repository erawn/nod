import { ITranslator, nullTranslator } from '@jupyterlab/translation';
import { bugIcon, PanelWithToolbar, SidePanel } from '@jupyterlab/ui-components';
import { ReactWidget } from '@jupyterlab/ui-components';
import React from 'react';

// export function createNode(): HTMLElement {
//     const span = document.createElement('span');
//     span.textContent = 'My custom header';
//     return span;
// }

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

class frameStack extends PanelWithToolbar {
    private _tree: VariablesBodyTree;
    constructor() {
        super();
        const translator = nullTranslator;
        const trans = translator.load('jupyterlab');
        this.title.label = trans.__('NOD Callstack');
        this.toolbar.addClass('jp-DebuggerVariables-toolbar');
        this.toolbar.node.setAttribute('aria-label', trans.__('NOD Callstack toolbar'));
        this._tree = new VariablesBodyTree();

        this.addWidget(this._tree);
        this.addClass('jp-DebuggerVariables');
    }
}




export class VariablesBodyTree extends ReactWidget {
    /**
     * Instantiate a new Body for the tree of variables.
     *
     * @param options The instantiation options for a VariablesBodyTree.
     */
    constructor() {
        super();

        // const model = (this.model = options.model);
        // model.changed.connect(this._updateScopes, this);

        this.addClass('jp-DebuggerVariables-body');
    }

    /**
     * Render the VariablesBodyTree.
     */
    render(): JSX.Element {
        // const scope =
        //   this._scopes.find(scope => scope.name === this._scope) ?? this._scopes[0];

        // const handleSelectVariable = (variable: IDebugger.IVariable) => {
        //   this.model.selectedVariable = variable;
        // };

        // if (scope?.name !== 'Globals') {
        //   this.addClass('jp-debuggerVariables-local');
        // } else {
        //   this.removeClass('jp-debuggerVariables-local');
        // }

        return (<div></div>)
    }
}