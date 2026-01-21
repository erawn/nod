import { nodSchema } from "./types";
import {
    INotebookTracker,
} from '@jupyterlab/notebook';
import { tryAddExportButton } from "./exportButton";
import { JupyterFrontEnd } from "@jupyterlab/application";
import {
    Contents,
} from '@jupyterlab/services'
export type pluginStatus = 'active' | 'inactive' | 'unset';
export class nodState {

    private static _instance: nodState


    private constructor(tracker: INotebookTracker, app: JupyterFrontEnd<JupyterFrontEnd.IShell, "desktop" | "mobile">, contents: Contents.IManager) {
        this._notebookTracker = tracker
        this._app = app
        this._contentsManager = contents
    }

    public static Instance(tracker?: INotebookTracker, app?: JupyterFrontEnd<JupyterFrontEnd.IShell, "desktop" | "mobile">, contents?: Contents.IManager): nodState {
        if (tracker && app && contents) {
            this._instance = new this(tracker, app, contents)
        }
        return this._instance;
    }
    private _notebookTracker!: INotebookTracker;
    private _status: pluginStatus = 'unset'
    private _pythonInfo: nodSchema | null = null
    private _app: JupyterFrontEnd<JupyterFrontEnd.IShell, "desktop" | "mobile">
    private _contentsManager: Contents.IManager

    set status(status: pluginStatus) {
        this._status = status
        if (this._status === 'active') {
            tryAddExportButton(this._notebookTracker, this)
        }
    }
    get status() {
        return this._status
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
    get contentsManager(): Contents.IManager {
        return this._contentsManager
    }

}