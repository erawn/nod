import type { ITranslator } from '@jupyterlab/translation';
import { nullTranslator } from '@jupyterlab/translation';
import { PanelWithToolbar } from '@jupyterlab/ui-components';
import { CommandRegistry } from '@lumino/commands';
import type { ISignal } from '@lumino/signaling';
import { Signal } from '@lumino/signaling';
import type { IDebugger } from '@jupyterlab/debugger';
import type { INotebookTracker } from '@jupyterlab/notebook';
import type { IConsoleTracker } from '@jupyterlab/console';
import { getDefinedVariables } from './messaging';
import { Panel, Widget } from '@lumino/widgets';
import { SidePanel } from '@jupyterlab/ui-components';
import { VariablesBodyTree } from './variablesTree';
import { Variables as VariablesPanel } from '@jupyterlab/debugger/lib/panels/variables';
export class NodLogSidebar extends SidePanel {
  constructor(options: {
    translator: ITranslator;
    service?: IDebugger;
    model: NodLogModel;
    commands: CommandRegistry;
    debuggerService: IDebugger;
  }) {
    const translator = options.translator || nullTranslator;
    const trans = (options.translator ?? nullTranslator).load('jupyterlab');
    super({ translator });
    this.id = 'jp-debugger-sidebar';
    // this.title.icon = bugIcon;
    this.title.label = trans.__('Nod Log');
    this.addClass('jp-DebuggerSidebar');
    this.addClass('jp-NodRightPanel');
    this.content.addClass('jp-DebuggerSidebar-body');

    const nodTitle = `<h3>${this._trans.__('NOD Log')}</h3>`;
    const titleWidget = new Widget();
    titleWidget.node.innerHTML = nodTitle;
    titleWidget.addClass('jp-ToolbarButton');
    titleWidget.addClass('jp-nod-label');
    this.toolbar.addItem('nod-label', titleWidget);
    const service = options.debuggerService;
    // this.debugHeader = new debugHeader(options.debuggerService)
    // this.header.addWidget(this.debugHeader)
    // if (service.isStarted) {
    //     header.show()
    // } else {
    //     header.hide()
    // }

    // options.debuggerService.sessionChanged.connect((service, session) => {

    // })
    this.variables = new VariablesPanel({
      model: service.model.variables,
      commands: options.commands,
      service: service,
      // themeManager,
      translator
    });
    this.variables.addClass('jp-NodLog-Variables');
    this.addWidget(this.variables);
    const model = options.model;
    const log = new NodLog({
      commands: options.commands,
      model: model,
      translator: translator,
      service: options.service
    });
    this.log = log;
    this.addWidget(this.log);
    this.log.activate();
    // if (!this.log.isHidden) {
    //     this.log.hide();
    //     this.log.update();
    //     this.log.show();
    // }
    model.changed.connect(model => {
      this.update();
    });
  }
  // debugHeader: debugHeader
  log: NodLog;
  readonly variables: VariablesPanel;
}
export namespace NodLog {
  export interface IOptions extends Panel.IOptions {
    commands: CommandRegistry;
    model: NodLogModel;
    translator?: ITranslator;
    service?: IDebugger;
  }
}
class NodLog extends PanelWithToolbar {
  constructor(options: NodLog.IOptions) {
    super(options);
    const { commands, model, translator, service } = options;
    this.model = model;
    this.translator = translator;
    this.commands = commands;
    this.service = service;
    const trans = (options.translator ?? nullTranslator).load('jupyterlab');
    this.title.label = trans.__('Log');
    const g = new VariablesBodyTree({
      commands,
      model,
      translator,
      service: options.service
    });
    this.addWidget(g);

    model.changed.connect(model => {
      this.update();
    });

    // widgets.map(widget => accordion.addWidget(widget))
    this.toolbar.node.setAttribute('aria-label', trans.__('Nod Log Viewer'));

    // this.addWidget(widget);
    this.addClass('jp-NodRightPanel-section');
    // this.addClass('jp-DebuggerCallstack');
  }

  async updateVariables(function_id: string) {
    // const trans = (this.translator ?? nullTranslator).load('jupyterlab');
    try {
      // console.log("updateVariables", this.model.scopes, function_id, this.model.scopes.findIndex(scope => { scope.name === function_id }))
      // console.log(this.model.scopes.some(scope => scope.name === function_id))
      if (!this.model.scopes.some(scope => scope.name === function_id)) {
        console.log('getting variables', function_id);
        const variables = (await getDefinedVariables(function_id));
        if (variables !== undefined && variables.length > 0) {
          console.log('update variables', variables);
          // variables.map(variable =>{
          //     variable.
          // })
          variables.sort((a, b) => { return parseInt(a.evaluateName?.split('_')[1] ?? "0") - parseInt(b.evaluateName?.split('_')[1] ?? "0") })
          const variableScopes = [
            {
              name: function_id,
              variables: variables
            }
          ];
          variableScopes
          this.model.scopes = variableScopes;
        }
      }
    } catch (e) {
      console.error((e as Error).message);
    }
  }
  model: NodLogModel;
  translator: ITranslator | undefined;
  commands: CommandRegistry;
  grids: VariablesBodyTree[] = [];
  service?: IDebugger;
}

export class NodLogModel implements IDebugger.Model.IVariables {
  /**
   * Get all the scopes.
   */
  get scopes(): IDebugger.IScope[] {
    return this._state;
  }

  /**
   * Set the scopes.
   */
  set scopes(scopes: IDebugger.IScope[]) {
    this._state = scopes;
    this._changed.emit();
  }

  /**
   * Signal emitted when the current variable has changed.
   */
  get changed(): ISignal<this, void> {
    return this._changed;
  }

  /**
   * Signal emitted when the current variable has been expanded.
   */
  get variableExpanded(): ISignal<this, IDebugger.IVariable> {
    return this._variableExpanded;
  }

  get selectedVariable(): IDebugger.IVariableSelection | null {
    return this._selectedVariable;
  }
  set selectedVariable(selection: IDebugger.IVariableSelection | null) {
    this._selectedVariable = selection;
  }

  /**
   * Expand a variable.
   *
   * @param variable The variable to expand.
   */
  expandVariable(variable: IDebugger.IVariable): void {
    this._variableExpanded.emit(variable);
  }

  private _selectedVariable: IDebugger.IVariableSelection | null = null;
  private _state: IDebugger.IScope[] = [];
  private _variableExpanded = new Signal<this, IDebugger.IVariable>(this);
  private _changed = new Signal<this, void>(this);
}

export namespace NodLogModel {
  export interface IOptions {
    config: IDebugger.IConfig;
    notebookTracker: INotebookTracker | null;
    consoleTracker: IConsoleTracker | null;
  }
}