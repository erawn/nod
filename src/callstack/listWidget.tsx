import { IRunningSessions } from "@jupyterlab/running";
import { ITranslator } from "@jupyterlab/translation";
import { classes, closeIcon, getTreeItemElement, LabIcon, ReactWidget, stopIcon, UseSignal } from "@jupyterlab/ui-components";
import { Signal, type ISignal } from '@lumino/signaling';
import type { Message } from '@lumino/messaging';
import React, { useCallback, useRef } from "react";
import { Button, TreeItem, TreeView } from '@jupyter/react-components';
import { nullTranslator } from '@jupyterlab/translation';
import { NodSidebar } from "./index";
import { IRenderMime } from '@jupyterlab/rendermime-interfaces';
import { NodRunningModel, NodSessionItem } from "./model";
// type nodInstanceType = nodState

const CONTAINER_CLASS = 'jp-RunningSessions-sectionContainer';
export class ListWidget extends ReactWidget {
    private _mode: 'list' | 'tree' = 'list';
    constructor(
        private _options: {
            model: NodRunningModel
            translator?: ITranslator;
            collapseToggled: ISignal<NodSidebar, boolean>;
        }
    ) {
        super();

        _options.model.itemsChanged.connect(this._emitUpdate, this)
        _options.model.selectedChanged.connect(this._emitUpdate, this)
        // _options.state.app .runningChanged.connect(this._emitUpdate, this);
        // if (_options.filterProvider) {
        //   _options.filterProvider.filterChanged.connect(this._emitUpdate, this);
        // }
    }

    /**
     * Whether the items are displayed as a tree view
     * or a flat list.
     */
    get mode(): 'tree' | 'list' {
        return this._mode;
    }
    set mode(v: 'tree' | 'list') {
        if (this._mode !== v) {
            this._mode = v;
            this._update.emit();
        }
    }

    dispose() {
        Signal.clearData(this);
        super.dispose();
    }

    protected onBeforeShow(msg: Message): void {
        super.onBeforeShow(msg);
        this._update.emit();
    }

    render(): JSX.Element {
        const options = this._options;
        let cached = true;
        return (
            <UseSignal signal={this._update}>
                {() => {
                    // Cache the running items for the initial load and request from
                    // the service every subsequent load.
                    if (cached) {
                        cached = false;
                    } else {
                        // options.runningItems = options.nodState;
                    }
                    const classes = ['jp-TreeView'];
                    if (this.mode === 'list') {
                        classes.push('jp-mod-flat');
                    }
                    return (
                        <div className={CONTAINER_CLASS}>
                            <TreeView className={classes.join(' ')}>
                                <List
                                    runningItems={options.model.items}
                                    shutdownItemIcon={stopIcon}
                                    selectedKey={options.model.selectedKernelKey}
                                    translator={options.translator}
                                    collapseToggled={options.collapseToggled}
                                />
                            </TreeView>
                        </div>
                    );
                }}
            </UseSignal>
        );
    }

    private _emitUpdate() {
        if (!this.isVisible) {
            return;
        }
        this._update.emit();
    }

    private _update: Signal<ListWidget, void> = new Signal(this);
}
function List(props: {
    child?: boolean;
    runningItems: NodSessionItem[];
    selectedKey: string;
    shutdownItemIcon?: LabIcon;

    // filter?: (item: IRunningSessions.IRunningItem) => Partial<IScore> | null;
    translator?: ITranslator;
    collapseToggled: ISignal<NodSidebar, boolean>;
}) {
    // const filter = props.filter;
    const items = props.runningItems;
    return (
        <>
            {items.map((item, i) => (
                <Item
                    child={props.child}
                    key={i}
                    selectedKey={props.selectedKey}
                    runningItem={item}
                    shutdownItemIcon={props.shutdownItemIcon}
                    translator={props.translator}
                    collapseToggled={props.collapseToggled}
                />
            ))}
        </>
    );
}
const ITEM_ICON_CLASS = 'jp-RunningSessions-icon';
const ITEM_CLASS = 'jp-RunningSessions-item';
const ITEM_LABEL_CLASS = 'jp-NodRunningSessions-itemLabel';
const ITEM_DETAIL_CLASS = 'jp-NodRunningSessions-itemDetail';
const SHUTDOWN_BUTTON_CLASS = 'jp-RunningSessions-itemShutdown';
const NOD_CONNECT_CLASS = 'jp-NodRunningSessions-itemShutdown';
function Item(props: {
    child?: boolean;
    runningItem: NodSessionItem;
    selectedKey: string;
    shutdownItemIcon?: LabIcon;
    translator?: ITranslator;
    collapseToggled: ISignal<NodSidebar, boolean>;
}) {
    const { runningItem } = props;
    const [collapsed, setCollapsed] = React.useState(false);
    // Use a ref instead of a state because the state does not have the time
    // to update in the callbacks
    const shuttingDown = useRef(false);
    const classList = [ITEM_CLASS];
    // const detail = runningItem.detail?.();
    const icon = runningItem.icon();
    // const title = runningItem.labelTitle ? runningItem.labelTitle() : '';
    const translator = props.translator || nullTranslator;
    const trans = translator.load('jupyterlab');

    // Handle shutdown requests.
    const shutdownItemIcon = props.shutdownItemIcon || closeIcon;
    const shutdownLabel = trans.__('Connect');
    const connectedLabel = trans.__('Connected');
    const shutdown = useCallback(
        (event: React.MouseEvent) => {
            // shuttingDown.current = true;
            event.preventDefault();
            // console.log("call shutdown")
            runningItem.shutdown?.();
        },
        [runningItem, shuttingDown]
    );

    // Materialise getter to avoid triggering it repeatedly
    // const children = runningItem.children;

    // Manage collapsed state. Use the shutdown flag in lieu of `stopPropagation`.
    const collapsible = false;
    const onClick = useCallback(
        (event: React.MouseEvent) => {
            if (shuttingDown.current) {
                return;
            }
            const item = getTreeItemElement(event.target as HTMLElement);
            if (event.currentTarget !== item) {
                return;
            }
            if (collapsible) {
                setCollapsed(!collapsed);
            }
        },
        [collapsible, collapsed, shuttingDown]
    );

    // Listen to signal to collapse from outside
    props.collapseToggled.connect((_emitter, newCollapseState) =>
        setCollapsed(newCollapseState)
    );

    if (runningItem.className) {
        classList.push(runningItem.className);
    }

    return (
        <>
            <TreeItem
                className={`${classList.join(' ')} jp-TreeItem nested jp-NodItem`}
                onClick={onClick}
                // data-context={runningItem.context || ''}
                expanded={!collapsed}
            >
                {icon ? (
                    typeof icon === 'string' ? (
                        <img src={icon} className={ITEM_ICON_CLASS} slot="start" />
                    ) : (
                        <icon.react slot="start" tag="span" className={ITEM_ICON_CLASS} />
                    )
                ) : undefined}
                <span
                    className={ITEM_LABEL_CLASS}
                    // title={runningItem.}
                    onClick={runningItem.open && (() => runningItem.open!())}
                >
                    {runningItem.label()}
                </span>
                <span
                    className={ITEM_DETAIL_CLASS}
                    title={runningItem.full_path}
                >
                    {runningItem.rel_path}
                </span>
                {/* {detail && <span className={ITEM_DETAIL_CLASS}>{detail}</span>} */}
                {runningItem.schema.key === props.selectedKey ? (
                    <Button
                        appearance='accent'
                        className={classes(NOD_CONNECT_CLASS)}
                        // onClick={shutdown}
                        title={connectedLabel}
                        label={connectedLabel}

                        slot="end"
                    >
                        {/* <shutdownItemIcon.react tag={null} /> */}
                        <span title={connectedLabel} className="jp-Nod-ConnectLabel-Span">{connectedLabel}</span>
                    </Button>
                ) : (
                    <Button
                        appearance="outline"
                        className={classes(NOD_CONNECT_CLASS)}
                        onClick={shutdown}
                        title={shutdownLabel}
                        label={shutdownLabel}
                        slot="end"
                    >
                        {/* <shutdownItemIcon.react tag={null} /> */}
                        <span title={shutdownLabel} className="jp-Nod-ConnectLabel-Span">{shutdownLabel}</span>
                    </Button>
                )}
                {/* {children && (
                    <List
                        runningItems={children!}
                        shutdownItemIcon={shutdownItemIcon}
                        translator={translator}
                        collapseToggled={props.collapseToggled}
                    />
                )} */}
            </TreeItem >
        </>
    );
}