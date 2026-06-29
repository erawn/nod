import type { ITranslator } from '@jupyterlab/translation';
import { nullTranslator } from '@jupyterlab/translation';
import {
  bugIcon,
  PanelWithToolbar,
  ReactWidget
} from '@jupyterlab/ui-components';
import { CommandRegistry } from '@lumino/commands';
import type { ISignal } from '@lumino/signaling';
import { Signal } from '@lumino/signaling';
import type { IDebugger, IDebuggerDisplayRegistry } from '@jupyterlab/debugger';
import type { INotebookTracker } from '@jupyterlab/notebook';
import type { IConsoleTracker } from '@jupyterlab/console';
import { getDefinedVariables } from '../messaging';
import { AccordionPanel, BoxPanel, Panel, Widget } from '@lumino/widgets';
import { SidePanel } from '@jupyterlab/ui-components';
import { nodState } from '../state';
import { VariablesBodyTree } from './variablesTree';
import { Variables as VariablesPanel } from '@jupyterlab/debugger/lib/panels/variables';
import React, { useEffect } from 'react';
import { debugHeader } from '../readOnlyHeader';
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
    // const widget = new NodLogBody(model);
    // commands: CommandRegistry
    // model: IDebugger.Model.IVariables;
    // service: IDebugger;
    // translator?: ITranslator;
    // this.grids = model.entries.map(entry => {

    //     return g
    // })
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
  // updateGrids(newId: string) {
  //     this.grids.map(g => g.dispose())
  //     console.log("currentID updategrids", newId)
  //     console.log(this.model.entries.filter(entry => entry.function_id === newId))
  //     this.grids = this.model.entries.filter(entry => entry.function_id === newId)
  //         .map(entry => {
  //             const g = new VariablesBodyTree({ commands: this.commands, model: this.model, translator: this.translator, entry, service: this.service })
  //             this.addWidget(g)
  //             return g
  //         })
  //     console.log("hidden?", this.isHidden)
  //     if (!this.isHidden) {
  //         this.hide();
  //         this.update();
  //         this.show();
  //     }
  // }
  async updateVariables(function_id: string) {
    const trans = (this.translator ?? nullTranslator).load('jupyterlab');
    try {
      console.log('getting variables', function_id);
      const variables = (await getDefinedVariables(function_id)) ?? [];

      console.log('update variables', variables);
      // variables.map(variable =>{
      //     variable.
      // })
      const variableScopes = [
        {
          name: trans.__('Globals'),
          variables: variables
        }
      ];
      this.model.scopes = variableScopes;
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

/**
 * A model for a callstack.
 */
// export class NodLogVariable {
//     constructor(name: string, value: string, type: string, id?: string, variablesReference?: number) {
//         this.name = name;
//         this.value = value;
//         this.id = id ?? "";
//         this.type = type;
//         this.variablesReference = variablesReference;
//     }
//     name: string;
//     value: string;
//     id: string;
//     type: string;
//     variablesReference: number | undefined;
// }
// export class nodLogEntry {
//     constructor(entry_id: string, function_id: string, variables: NodLogVariable[]) {
//         this.entry_id = entry_id
//         this.function_id = function_id
//         this.variables = variables

//     }
//     entry_id: string;
//     function_id: string;
//     variables: NodLogVariable[];
//     selectedVariable: NodLogVariable | null = null
// }
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
// export namespace VariablesBodyGrid {
//     export interface IOptions {
//         model: NodLogModel;
//         entry: nodLogEntry;
//         commands: CommandRegistry;
//         scopes?: IDebugger.IScope[];
//         themeManager?: IThemeManager | null;
//         translator?: ITranslator;
//     }
// }
// export class VariablesBodyGrid extends Panel {
//     /**
//      * Instantiate a new VariablesBodyGrid.
//      *
//      * @param options The instantiation options for a VariablesBodyGrid.
//      */
//     constructor(options: VariablesBodyGrid.IOptions) {
//         super();
//         this.commands = options.commands;
//         this.model = options.model;
//         this.themeManager = options.themeManager;
//         this.translator = options.translator;
//         this.model.changed.connect(() => this.update(), this);
//         this.addClass('jp-NodDebuggerVariables-body');
//         this.entry = options.entry
//     }

//     // /**
//     //  * The variable filter list.
//     //  */
//     // get filter(): Set<string> {
//     //     return this._filter;
//     // }
//     // set filter(filter: Set<string>) {
//     //     this._filter = filter;
//     //     this.update();
//     // }

//     /**
//      * The current scope of the variables.
//      */
//     // get scope(): string {
//     //     return this._scope;
//     // }
//     // set scope(scope: string) {
//     //     this._scope = scope;
//     //     if (scope !== 'Globals') {
//     //         this.addClass('jp-debuggerVariables-local');
//     //     } else {
//     //         this.removeClass('jp-debuggerVariables-local');
//     //     }
//     //     this.update();
//     // }

//     protected commands: CommandRegistry;
//     protected entry: nodLogEntry;
//     protected model: NodLogModel;
//     protected themeManager: IThemeManager | null | undefined;
//     protected translator: ITranslator | undefined;

//     /**
//      * Load the grid panel implementation and instantiate a grid.
//      */
//     protected async initialize(): Promise<void> {
//         if (this._grid || this._pending) {
//             return;
//         }

//         // Lazily load the datagrid module when the first grid is requested.
//         const { Grid } = await (this._pending = import('./gridpanel'));
//         const { commands, entry, themeManager, translator } = this;

//         this._grid = new Grid({ commands, entry, themeManager, translator });
//         this._grid.addClass('jp-DebuggerVariables-grid');
//         this._pending = null;
//         this.addWidget(this._grid);
//         this.update();
//         this.model.changed.connect(model => {
//             console.log("grid model changed")
//             if (this._grid) {
//                 const { dataModel } = this._grid;
//                 // dataModel.filter = this._filter;
//                 // dataModel.scope = this._scope;
//                 dataModel.setData(this.entry ?? []);
//             }
//             super.update()
//             // super.onUpdateRequest(msg);
//         })
//     }

//     /**
//      * Wait until actually displaying the grid to trigger initialization.
//      */
//     protected onBeforeShow(msg: Message): void {
//         if (!this._grid && !this._pending) {
//             void this.initialize();
//         }
//         super.onBeforeShow(msg);
//     }

//     /**
//      * Handle `update-request` messages.
//      */
//     protected onUpdateRequest(msg: Message): void {
//         if (this._grid) {
//             const { dataModel } = this._grid;
//             // dataModel.filter = this._filter;
//             // dataModel.scope = this._scope;
//             dataModel.setData(this.entry ?? []);
//         }
//         super.onUpdateRequest(msg);
//     }

//     private _filter: Set<string> = new Set();
//     private _grid: GridPanelModule.Grid | null = null;
//     private _pending: Promise<unknown> | null = null;
//     // private _scope: string;
// }

// export class NodLogBody extends ReactWidget {
//     constructor(model: NodLogModel) {
//         super();
//         this._model = model;
//         this.addClass('jp-DebuggerCallstack-body');
//     }
//     private _model: NodLogModel;
//     render(): JSX.Element {
//         // return (
//         //     <>
//         //         {this._model.scopes.map(scope => (<VariablesBodyTree>))
//         //         </>
//         //         );
//         return (
//             <>
//                 {this._model.scopes.map((scope, i) => (
//                     <VariablesBodyTree
//                         child={props.child}
//                         key={i}
//                         selectedKey={props.selectedKey}
//                         runningItem={item}
//                         shutdownItemIcon={props.shutdownItemIcon}
//                         translator={props.translator}
//                         collapseToggled={props.collapseToggled}
//                     />
//                 ))}
//             </>
//         );
//     }
//     // private _searchInputRef: React.RefObject<HTMLInputElement>;

// }

// namespace VariablesBodyTree {
//     /**
//                     * Instantiation options for `VariablesBodyTree`.
//                     */
//     export interface IOptions {
//         commands: CommandRegistry
//         model: NodLogModel;
//         service: IDebugger;
//         translator?: ITranslator;
//         entry: nodLogEntry;
//     }
// }
// export class VariablesBodyTree extends ReactWidget {
//     constructor(options: VariablesBodyTree.IOptions) {
//         super();
//         this._service = options.service;
//         this._translator = options.translator;
//         this._commands = options.commands;
//         this.entry = options.entry;
//         this.model = options.model;
//         this.model.changed.connect(this._update, this);

//         this.addClass('jp-DebuggerVariables-body');
//     }
//     render(): JSX.Element {

//         const handleSelectVariable = (variable: IDebugger.IVariable) => {
//             // this.model.selectedVariable = variable;
//         };
//         const handleSelectEntry = () => {
//             console.log("selectEntry")
//         }
//         return (
//             <>
//                 <TreeView className="jp-TreeView">
//                     <VariablesBranch
//                         key={this.entry.entry_id}
//                         commands={this._commands}
//                         service={this._service}
//                         data={this.entry}
//                         translator={this._translator}
//                         // handleSelectVariable={handleSelectVariable}
//                         handleSelectEntry={handleSelectEntry}
//                     />
//                 </TreeView>
//             </>
//         )
//     }
//     private _update(model: NodLogModel): void {
//         // if (ArrayExt.shallowEqual(this._scopes, model.scopes)) {
//         //     return;
//         // }
//         // this._scopes = model.scopes;
//         this.update();
//     }

//     protected model: NodLogModel;
//     private entry: nodLogEntry;
//     private _commands: CommandRegistry;
//     private _scope = '';
//     private _scopes: IDebugger.IScope[] = [];
//     // private _filter = new Set<string>();
//     private _service: IDebugger;
//     private _translator: ITranslator | undefined;
// }
// interface IVariablesBranchProps {
//     commands: CommandRegistry;
//     data: nodLogEntry;
//     service: IDebugger;
//     filter?: Set<string>;
//     translator?: ITranslator;
//     handleSelectEntry?: (variable: IDebugger.IVariable) => void;
//     handleSelectVariable?: (variable: IDebugger.IVariable) => void;

// }
// const VariablesBranch = (props: IVariablesBranchProps): JSX.Element => {
//     const { commands, data, service, filter, translator, handleSelectEntry, handleSelectVariable } =
//         props;
//     const [entry, setEntry] = useState(data);

//     useEffect(() => {
//         setEntry(data);
//     }, [data]);

//     return (
//         <>
//             {entry.variables.map(variable => {
//                 const key = `${variable.name}-${variable.evaluateName}-${variable.type}-${variable.value}-${variable.variablesReference}`;
//                 return (
//                     <VariableComponent
//                         key={key}
//                         commands={commands}
//                         data={variable}
//                         service={service}
//                         filter={filter}
//                         translator={translator}
//                         onSelect={handleSelectVariable}
//                     />
//                 );
//             })}
//         </>
//     );
// };

// interface IVariableComponentProps {
//     commands: CommandRegistry;
//     data: IDebugger.IVariable;
//     filter?: Set<string>;
//     service: IDebugger;
//     translator?: ITranslator;
//     onSelect?: (variable: IDebugger.IVariable) => void;
// }

// function _prepareDetail(variable: IDebugger.IVariable) {
//     if (
//         variable.type === 'float' &&
//         (variable.value == 'inf' || variable.value == '-inf')
//     ) {
//         return variable.value;
//     }
//     const detail = convertType(variable);
//     if (variable.type === 'float' && isNaN(detail as number)) {
//         // silence React warning:
//         // `Received NaN for the `children` attribute. If this is expected, cast the value to a string`
//         return 'NaN';
//     }
//     return detail;
// }

// /**
//  * A React component to display one node variable in tree.
//  *
//  * @param {object} props The component props.
//                                 * @param props.data An array of variables.
//                                 * @param props.service The debugger service.
//                                 * @param props.filter Optional variable filter list.
//                                 */
// const VariableComponent = (props: IVariableComponentProps): JSX.Element => {
//     const { commands, data, service, filter, translator, onSelect } = props;
//     const [variable] = useState(data);
//     const [showDetailsButton, setShowDetailsButton] = useState<boolean>(false);
//     const [expanded, setExpanded] = useState<boolean>(false);
//     const [variables, setVariables] = useState<DebugProtocol.Variable[] | null>(
//         null
//     );

//     const trans = useMemo(
//         () => (translator ?? nullTranslator).load('jupyterlab'),
//         [translator]
//     );
//     const onSelection = onSelect ?? (() => void 0);

//     const expandable = useMemo(
//         () => variable.variablesReference !== 0 || variable.type === 'function',
//         [variable.variablesReference, variable.type]
//     );

//     const details = useMemo(() => _prepareDetail(variable), [variable]);

//     const hasMimeRenderer = useMemo(
//         () =>
//             ![
//                 'special variables',
//                 'protected variables',
//                 'function variables',
//                 'class variables'
//             ].includes(variable.name),
//         [variable.name]
//     );

//     const disableMimeRenderer = useMemo(
//         () =>
//             !service.model.hasRichVariableRendering ||
//             !commands.isEnabled(Debugger.CommandIDs.renderMimeVariable, {
//                 name: variable.name,
//                 frameID: service.model.callstack.frame?.id
//             } as any),
//         [
//             service.model.hasRichVariableRendering,
//             variable.name,
//             service.model.callstack.frame?.id
//         ]
//     );

//     const fetchChildren = useCallback(async () => {
//         if (expandable && !variables) {
//             setVariables(await service.inspectVariable(variable.variablesReference));
//         }
//     }, [expandable, service, variable.variablesReference, variables]);

//     const onVariableClicked = useCallback(
//         async (event: React.MouseEvent): Promise<void> => {
//             const item = getTreeItemElement(event.target as HTMLElement);
//             if (event.currentTarget !== item) {
//                 return;
//             }

//             if (!expandable) {
//                 return;
//             }
//             setExpanded(!expanded);
//         },
//         [expandable, expanded]
//     );

//     const onSelectChange = useCallback(
//         (event: CustomEvent) => {
//             if (event.currentTarget === event.detail && event.detail.selected) {
//                 onSelection(variable);
//             }
//         },
//         [variable]
//     );

//     const renderVariable = useCallback(() => {
//         commands
//             .execute(Debugger.CommandIDs.renderMimeVariable, {
//                 name: variable.name,
//                 frameID: service.model.callstack.frame?.id
//             } as any)
//             .catch((reason: any) => {
//                 console.error(`Failed to render variable ${variable?.name}`, reason);
//             });
//     }, [commands, variable.name, service.model.callstack.frame?.id]);

//     const onContextMenu = useCallback(
//         (event: React.MouseEvent<HTMLElement, MouseEvent>): void => {
//             const item = getTreeItemElement(event.target as HTMLElement);
//             if (event.currentTarget !== item) {
//                 return;
//             }

//             onSelection(variable);
//         },
//         [variable]
//     );

//     return (
//         <TreeItem
//             className="jp-TreeItem nested"
//             expanded={expanded}
//             onSelect={onSelectChange}
//             onExpand={fetchChildren}
//             onClick={(e): Promise<void> => onVariableClicked(e)}
//             onContextMenu={onContextMenu}
//             onKeyDown={event => {
//                 if (event.key == 'Enter') {
//                     if (hasMimeRenderer && showDetailsButton) {
//                         onSelection(variable);
//                         renderVariable();
//                     }
//                 }
//             }}
//             onFocus={event => {
//                 setShowDetailsButton(!event.defaultPrevented);
//                 event.preventDefault();
//             }}
//             onBlur={event => {
//                 setShowDetailsButton(false);
//             }}
//             onMouseOver={(event: React.MouseEvent<HTMLElement, MouseEvent>) => {
//                 setShowDetailsButton(!event.defaultPrevented);
//                 event.preventDefault();
//             }}
//             onMouseLeave={(event: React.MouseEvent<HTMLElement, MouseEvent>) => {
//                 setShowDetailsButton(false);
//             }}
//         >
//             <span className="jp-DebuggerVariables-name">{variable.name}</span>
//             {details != null && (
//                 <span className="jp-DebuggerVariables-detail">{details}</span>
//             )}
//             {hasMimeRenderer && showDetailsButton && (
//                 <Button
//                     className="jp-DebuggerVariables-renderVariable"
//                     appearance="stealth"
//                     slot="end"
//                     disabled={disableMimeRenderer}
//                     onClick={e => {
//                         e.stopPropagation();
//                         renderVariable();
//                     }}
//                     title={trans.__('Render variable: %1', variable?.name)}
//                 >
//                     <searchIcon.react tag={null} />
//                 </Button>
//             )}
//             {variables ? (
//                 <VariablesBranch
//                     key={variable.name}
//                     commands={commands}
//                     data={variables}
//                     service={service}
//                     filter={filter}
//                     translator={translator}
//                     handleSelectVariable={onSelect}
//                 />
//             ) : (
//                 /* Trick to ensure collapse button is displayed
//                    when variables are not loaded yet */
//                 expandable && <TreeItem />
//             )}
//         </TreeItem>
//     );
// };
