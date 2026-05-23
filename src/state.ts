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
export type pluginStatus = 'active' | 'inactive' | 'unset';
export class nodState {

    private static _instance: nodState


    private constructor(tracker: INotebookTracker, app: JupyterFrontEnd<JupyterFrontEnd.IShell, "desktop" | "mobile">, contents: Contents.IManager, translator: ITranslator, connection_dir: string) {
        this._notebookTracker = tracker
        this._app = app
        this._contentsManager = contents
        this._translator = translator
        this._connection_dir = connection_dir
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
    private _currentFrame: number = 0
    private _connection_dir: string
    private _statusChanged = new Signal<this, pluginStatus>(this);
    private _currentFrameChanged = new Signal<this, number>(this);
    public isMainFile(panel: NotebookPanel) {
        return this.pythonInfo ? this.pythonInfo[this._currentFrame].notebook_file.includes(panel.context.path) : null
    }
    get currentFrame() {
        return this.pythonInfo![this._currentFrame]
    }
    set currentFrameIndex(currentFrame: number) {
        if (this._currentFrame !== currentFrame) {
            this._currentFrame = currentFrame
            this._currentFrameChanged.emit(currentFrame)
        }
        this._currentFrame = currentFrame
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