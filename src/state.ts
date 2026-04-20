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
export type pluginStatus = 'active' | 'inactive' | 'unset';
export class nodState {

    private static _instance: nodState


    private constructor(tracker: INotebookTracker, app: JupyterFrontEnd<JupyterFrontEnd.IShell, "desktop" | "mobile">, contents: Contents.IManager, schema: nodSchema, translator: ITranslator) {
        this._notebookTracker = tracker
        this._app = app
        this._contentsManager = contents
        this._pythonInfo = schema
        this._translator = translator
    }

    public static Instance(tracker?: INotebookTracker, app?: JupyterFrontEnd<JupyterFrontEnd.IShell, "desktop" | "mobile">, contents?: Contents.IManager, schema?: nodSchema, translator?: ITranslator): nodState {
        if (tracker && app && contents && schema && translator) {
            this._instance = new this(tracker, app, contents, schema, translator)
        }
        return this._instance;
    }
    private _notebookTracker: INotebookTracker;
    private _status: pluginStatus = 'unset'
    private _pythonInfo: nodSchema
    private _app: JupyterFrontEnd<JupyterFrontEnd.IShell, "desktop" | "mobile">
    private _contentsManager: Contents.IManager
    private _translator: ITranslator
    private _currentFrame: number = 0

    public isMainFile(panel: NotebookPanel) {
        return this.pythonInfo[this._currentFrame].notebook_file.includes(panel.context.path)
    }
    get currentFrame() {
        return this.pythonInfo[this._currentFrame]
    }
    set status(status: pluginStatus) {
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
    get pythonInfo(): nodSchema {
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

}