// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import type { ISignal } from '@lumino/signaling';
import { Signal } from '@lumino/signaling';
import { DebuggerDisplayRegistry } from '@jupyterlab/debugger';
import type { IDebugger, IDebuggerDisplayRegistry } from '@jupyterlab/debugger';
import type { INotebookTracker } from '@jupyterlab/notebook';
import type { IConsoleTracker } from '@jupyterlab/console';
import { INodStackFrame, nodSchema } from './types';
import { IRunningSessions } from '@jupyterlab/running';
import { kernelIcon, LabIcon } from '@jupyterlab/ui-components';
import React, { ReactNode } from 'react';
import { NodSwitchSessions } from './kernelHelpers';
/**
 * A model for a callstack.
 */
export class CallstackModel implements IDebugger.Model.ICallstack {
  constructor(options: { displayRegistry?: IDebuggerDisplayRegistry }) {
    this._displayRegistry =
      options.displayRegistry ?? new DebuggerDisplayRegistry();
  }

  /**
   * Get all the frames.
   */

  get frames(): INodStackFrame[] {
    return this._state;
  }

  /**
   * Set the frames.
   */
  setFrames(
    newFrames: INodStackFrame[],
    currentFrameIndex: number,
    filters: string[]
  ) {
    this._state = newFrames;
    // const currentFrameId =
    //   this.frame !== null ? Private.getFrameId(this.frame) : '';
    // const frame = newFrames.find(
    //   frame => Private.getFrameId(frame) === currentFrameId
    // );
    // // Default to the first frame if the previous one can't be found.
    // // Otherwise keep the current frame selected.
    // if (!frame) {
    //   this.frame = newFrames[];
    // }

    this._filters = filters;
    console.log('Set Filters', this._filters);
    console.log(currentFrameIndex);
    console.log(newFrames);
    this.frame = newFrames[currentFrameIndex];
    console.log('newselectedframe', this.frame);
    this._framesChanged.emit(newFrames);
  }

  /**
   * Get the current frame.
   */
  get frame(): INodStackFrame | null {
    return this._currentFrame;
  }

  /**
   * Set the current frame.
   */
  set frame(frame: INodStackFrame | null) {
    this._currentFrame = frame;
    this._currentFrameChanged.emit(frame);
  }

  /**
   * Signal emitted when the frames have changed.
   */
  get framesChanged(): ISignal<this, INodStackFrame[]> {
    return this._framesChanged;
  }

  /**
   * Signal emitted when the current frame has changed.
   */
  get currentFrameChanged(): ISignal<this, INodStackFrame | null> {
    return this._currentFrameChanged;
  }

  get filters() {
    return this._filters;
  }
  set filters(newFilters: string[]) {
    this._filters = newFilters;
    this._filtersChanged.emit(newFilters);
    // console.log("set filters", newFilters)
  }

  get filtersChanged(): ISignal<this, string[]> {
    return this._filtersChanged;
  }
  get editedNotebookIndex(): number {
    return this._editedNotebookIndex;
  }
  set editedNotebookIndex(newIndex: number) {
    this._editedNotebookIndex = newIndex;
    this._editedNotebookIndexChanged.emit(newIndex);
  }
  get editedNotebookIndexChanged() {
    return this._editedNotebookIndexChanged;
  }
  /**
   * Returns a human-readable display for a frame.
   */
  getDisplayName(frame: INodStackFrame): string {
    let name = this._displayRegistry.getDisplayName(
      frame.source as IDebugger.Source
    );
    if (frame.line !== undefined) {
      name += `:${frame.line}`;
    }
    return name;
  }

  private _state: INodStackFrame[] = [];
  private _currentFrame: INodStackFrame | null = null;
  private _framesChanged = new Signal<this, INodStackFrame[]>(this);
  private _currentFrameChanged = new Signal<this, INodStackFrame | null>(this);
  private _filters: string[] = [];
  private _filtersChanged = new Signal<this, string[]>(this);
  private _displayRegistry: IDebuggerDisplayRegistry;
  private _editedNotebookIndex: number = -1;
  private _editedNotebookIndexChanged = new Signal<this, number>(this);
}

/**
 * A namespace for CallstackModel
 */
export namespace CallstackModel {
  /**
   * Instantiation options for CallstackModel
   */
  export interface IOptions {
    /**
     * Debugger configuration.
     */
    config: IDebugger.IConfig;

    /**
     * The notebook tracker.
     */
    notebookTracker: INotebookTracker | null;

    /**
     * The console tracker.
     */
    consoleTracker: IConsoleTracker | null;
  }
}

export namespace NodSessionItem {
  export interface IOptions {
    name: string;
    rel_path: string;
    full_path: string;
    nodSchema: nodSchema;
  }
}
const KERNEL_ITEM_LABEL_CLASS = 'jp-RunningSessions-itemLabel';
// const CONNECT_BUTTON_CLASS = 'jp-Nod-ConnectButton';
// const KERNEL_LABEL_ID = 'jp-RunningSessions-item-label-kernel-id';
// const KERNEL_ITEM_CLASS = 'jp-mod-kernel';
const KERNELSPEC_ITEM_CLASS = 'jp-mod-kernelspec';
export class NodSessionItem implements IRunningSessions.IRunningItem {
  constructor(options: NodSessionItem.IOptions) {
    this._name = options.name;
    this.rel_path = options.rel_path;
    this.full_path = options.full_path;
    this.className = KERNELSPEC_ITEM_CLASS;
    this.schema = options.nodSchema;
  }

  readonly className: string;
  public rel_path: string;
  public full_path: string;
  public schema: nodSchema;
  private _name: string;

  icon(): LabIcon | string {
    return kernelIcon;
  }
  open(): void {
    console.log('called open from model');
  }

  label(): ReactNode {
    // const { kernel } = this;
    // const kernelIdPrefix = kernel.id.split('-')[0];
    // {this._summary}{' '}
    return (
      <>
        <span className={KERNEL_ITEM_LABEL_CLASS}> {this._name} </span>
      </>
    );
  }
  async shutdown(): Promise<void> {
    console.log('opening ', this.schema);
    await NodSwitchSessions(this.schema);
  }
}
export class NodRunningModel {
  constructor() {}
  get items(): NodSessionItem[] {
    return this._items;
  }

  /**
   * Set the frames.
   */
  setItems(newItems: NodSessionItem[]) {
    this._items = newItems;
    this._itemsChanged.emit(newItems);
  }

  /**
   * Signal emitted when the frames have changed.
   */
  get itemsChanged(): ISignal<this, NodSessionItem[]> {
    return this._itemsChanged;
  }

  get selectedKernelKey(): string {
    return this._selectedKernelKey;
  }

  set selectedKernelKey(newKey: string) {
    this._selectedKernelKey = newKey;
    this._selectedChanged.emit(newKey);
  }

  get selectedChanged(): ISignal<this, string> {
    return this._selectedChanged;
  }

  private _selectedKernelKey: string = '';
  private _items: NodSessionItem[] = [];
  private _itemsChanged = new Signal<this, NodSessionItem[]>(this);
  private _selectedChanged = new Signal<this, string>(this);
}
