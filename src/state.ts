import { nodSchema } from "./types";
import {
    INotebookTracker,
    NotebookPanel,
} from '@jupyterlab/notebook';
import { JupyterFrontEnd, LabShell } from "@jupyterlab/application";
import {
    Contents,
} from '@jupyterlab/services'
import { ITranslator } from '@jupyterlab/translation';
import type { ISignal } from '@lumino/signaling';
import { Signal } from '@lumino/signaling';
import { ReadOnlyHeader } from "./readOnlyHeader";
import { MainAreaWidget } from "@jupyterlab/apputils";
import { NodSidebar } from "./callstack";
import { ISettingRegistry } from "@jupyterlab/settingregistry";
import { IDocumentManager } from "@jupyterlab/docmanager";
export type pluginStatus = 'active' | 'inactive' | 'unset';
export class nodState {


    private static _instance: nodState


    private constructor(tracker: INotebookTracker, app: JupyterFrontEnd<JupyterFrontEnd.IShell, "desktop" | "mobile">, contents: Contents.IManager, translator: ITranslator, connection_dir: string, callstackSidebar: NodSidebar, settingRegistry: ISettingRegistry, docManager: IDocumentManager) {
        this._notebookTracker = tracker
        this._app = app
        this._contentsManager = contents
        this._translator = translator
        this._connection_dir = connection_dir
        this._readOnlyHeader = new ReadOnlyHeader()
        this._readOnlyHeader.setHidden(true)
        this.callstackSidebar = callstackSidebar
        this.settingRegistry = settingRegistry
        this.docManager = docManager
    }

    public static Instance(tracker?: INotebookTracker, app?: JupyterFrontEnd<JupyterFrontEnd.IShell, "desktop" | "mobile">, contents?: Contents.IManager, translator?: ITranslator, connection_dir?: string, callstackSidebar?: NodSidebar, settingRegistry?: ISettingRegistry, docManager?: IDocumentManager): nodState {
        if (tracker && app && contents && translator && connection_dir && callstackSidebar && settingRegistry && docManager) {
            this._instance = new this(tracker, app, contents, translator, connection_dir, callstackSidebar, settingRegistry, docManager)
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
    private _pythonInfoChanged = new Signal<this, nodSchema | null>(this);
    private _lockChanged = new Signal<this, string>(this);
    private _nodKernelId: string = ""
    private _lockNotebookId: string = ""
    private _readOnlyHeader: ReadOnlyHeader
    docManager: IDocumentManager
    settingRegistry: ISettingRegistry
    callstackSidebar: NodSidebar
    dialogID = ""

    public isNodFile(panel: NotebookPanel) {
        const frame = this.getFrameFromPath(panel.context.path)
        // console.log("Is Nod File frame:", frame)
        if (frame) {
            return true
        }
        return false //this.pythonInfo ? this.pythonInfo[this._currentFrame].notebook_file.includes(panel.context.path) : null
    }
    public getFrameFromPath(path: string) {
        return this.pythonInfo?.stack_info.find((frame) => frame.fileInfo && frame.fileInfo.notebook_file.includes(path))
    }

    public lock(lockPanel: NotebookPanel) {
        this._lockNotebookId = lockPanel.id
        // this.tracker.forEach(panel => {
        //     if (panel.id !== lockPanel.id) {
        //         panel.content.widgets.forEach(cell => cell.model.setMetadata("editable", false))
        //         if (!panel.contentHeader.contains(this._readOnlyHeader)) {
        //             console.log('adding widget')
        //             this._readOnlyHeader.setHidden(false)
        //             const widget = this._app.shell.currentWidget;
        //             if (widget instanceof MainAreaWidget) {
        //                 widget.contentHeader.addWidget(this._readOnlyHeader)
        //             }
        //             panel.contentHeader.addWidget(this._readOnlyHeader);
        //         }
        //     }
        // })
        // this._readOnlyHeader.setHidden(false)
        this._lockChanged.emit(this._lockNotebookId)
    }
    public unlock() {
        this._lockNotebookId = ""
        this._readOnlyHeader.setHidden(true)
        // this.tracker.forEach(panel => {
        //     panel.content.widgets.forEach(cell => cell.model.setMetadata("editable", true))
        // })
        this._lockChanged.emit(this._lockNotebookId)
    }
    get lockChanged(): Signal<this, string> {
        return this._lockChanged
    }
    get pythonInfoChanged(): Signal<this, nodSchema | null> {
        return this._pythonInfoChanged
    }
    get readOnlyHeader(): ReadOnlyHeader {
        return this._readOnlyHeader
    }
    get notebookLockId(): string {
        return this._lockNotebookId
    }
    get locked(): boolean {
        return this._lockNotebookId !== ""
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
            return this.pythonInfo.stack_info[this._currentFrameIndex]
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
        this._pythonInfoChanged.emit(pythonInfo)
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

    public activateSidebars() {
        (this._app.shell as LabShell).activateById(this.callstackSidebar.id);
    }

}