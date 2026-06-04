import { nodSchema } from "./types";
import {
    INotebookTracker,
    NotebookPanel,
} from '@jupyterlab/notebook';
import { JupyterFrontEnd } from "@jupyterlab/application";
import {
    Contents,
} from '@jupyterlab/services'
import { ITranslator } from '@jupyterlab/translation';
import type { ISignal } from '@lumino/signaling';
import { Signal } from '@lumino/signaling';
import { ReadOnlyHeader } from "./readOnlyHeader";
import { MainAreaWidget } from "@jupyterlab/apputils";
export type pluginStatus = 'active' | 'inactive' | 'unset';
export class nodState {


    private static _instance: nodState


    private constructor(tracker: INotebookTracker, app: JupyterFrontEnd<JupyterFrontEnd.IShell, "desktop" | "mobile">, contents: Contents.IManager, translator: ITranslator, connection_dir: string) {
        this._notebookTracker = tracker
        this._app = app
        this._contentsManager = contents
        this._translator = translator
        this._connection_dir = connection_dir
        this._readOnlyHeader = new ReadOnlyHeader()
    }

    public static Instance(tracker?: INotebookTracker, app?: JupyterFrontEnd<JupyterFrontEnd.IShell, "desktop" | "mobile">, contents?: Contents.IManager, translator?: ITranslator, connection_dir?: string): nodState {
        if (tracker && app && contents && translator && connection_dir) {
            this._instance = new this(tracker, app, contents, translator, connection_dir)
        }
        return this._instance;
    }
    private _notebookTracker: INotebookTracker;
    private _status: pluginStatus = 'unset'
    private _pythonInfo: nodSchema | null = null
    private _app: JupyterFrontEnd<JupyterFrontEnd.IShell, "desktop" | "mobile">
    private _contentsManager: Contents.IManager
    private _translator: ITranslator
    private _currentFrameIndex: number = 0
    private _connection_dir: string
    private _statusChanged = new Signal<this, pluginStatus>(this);
    private _currentFrameChanged = new Signal<this, number>(this);
    private _nodKernelId: string = ""
    private _lockNotebookId: string = ""
    private _readOnlyHeader: ReadOnlyHeader
    public isNodFile(panel: NotebookPanel) {
        const frame = this.getFrameFromPath(panel.context.path)
        console.log("Is Nod File frame:", frame)
        if (frame) {
            return true
        }
        return false //this.pythonInfo ? this.pythonInfo[this._currentFrame].notebook_file.includes(panel.context.path) : null
    }
    public getFrameFromPath(path: string) {
        return this.pythonInfo?.find((frame) => frame.notebook_file.includes(path))
    }
    public lock(lockPanel: NotebookPanel) {
        this._lockNotebookId = lockPanel.id
        this.tracker.forEach(panel => {
            if (panel.id !== lockPanel.id) {
                panel.content.widgets.forEach(cell => cell.model.setMetadata("editable", false))
                if (!panel.contentHeader.contains(this._readOnlyHeader)) {
                    console.log('adding widget')
                    this._readOnlyHeader.setHidden(false)
                    const widget = this._app.shell.currentWidget;
                    if (widget instanceof MainAreaWidget) {
                        widget.contentHeader.addWidget(this._readOnlyHeader)
                    }
                    panel.contentHeader.addWidget(this._readOnlyHeader);
                }
            }
        })
        this._readOnlyHeader.setHidden(false)

    }
    public unlock() {
        this._lockNotebookId = ""
        this._readOnlyHeader.setHidden(true)
        this.tracker.forEach(panel => {
            panel.content.widgets.forEach(cell => cell.model.setMetadata("editable", true))
            // if (panel.contentHeader.contains(this._readOnlyHeader)) {
            //     panel.contentHeader.widgets.find()
            // }


        })
    }
    get readOnlyHeader(): ReadOnlyHeader {
        return this._readOnlyHeader
    }
    get notebookLockId(): string {
        return this._lockNotebookId
    }
    get locked(): boolean {
        return this._lockNotebookId === ""
    }
    get currentFrameIndex() {
        return this._currentFrameIndex
    }

    set currentFrameIndex(currentFrameIndex: number) {
        if (this._currentFrameIndex !== currentFrameIndex) {
            this._currentFrameIndex = currentFrameIndex
            this._currentFrameChanged.emit(currentFrameIndex)
        }
    }
    get currentFrame() {
        if (this.pythonInfo)
            return this.pythonInfo[this._currentFrameIndex]
    }
    get currentFrameChanged(): ISignal<this, number> {
        return this._currentFrameChanged;
    }
    get statusChanged(): ISignal<this, pluginStatus> {
        return this._statusChanged;
    }
    set status(status: pluginStatus) {
        if (this._status !== status) {
            this._status = status
            this._statusChanged.emit(status)
        }
        this._status = status
    }
    get nodKernelId() {
        return this._nodKernelId
    }
    set nodKernelId(kernelId: string) {
        if (this._nodKernelId !== kernelId) {
            const panel = this._notebookTracker.currentWidget
            if (panel)
                panel.sessionContext.kernelPreference = { autoStartDefault: false, id: kernelId };

            this._app
        }
        this._nodKernelId = kernelId
    }
    get status() {
        return this._status
    }
    get translator() {
        return this._translator
    }
    set pythonInfo(pythonInfo: nodSchema) {
        this._pythonInfo = pythonInfo

    }
    get pythonInfo(): nodSchema | null {
        return this._pythonInfo
    }
    get app(): JupyterFrontEnd<JupyterFrontEnd.IShell, "desktop" | "mobile"> {
        return this._app
    }
    get tracker(): INotebookTracker {
        return this._notebookTracker
    }
    set tracker(tracker: INotebookTracker) {
        this._notebookTracker = tracker
    }
    get contentsManager(): Contents.IManager {
        return this._contentsManager
    }
    get connection_dir(): string {
        return this._connection_dir
    }

}