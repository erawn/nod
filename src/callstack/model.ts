// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import type { ISignal } from '@lumino/signaling';
import { Signal } from '@lumino/signaling';

import { DebuggerDisplayRegistry } from '@jupyterlab/debugger';
import type { IDebugger, IDebuggerDisplayRegistry } from '@jupyterlab/debugger';
import type { INotebookTracker } from '@jupyterlab/notebook';
import type { IConsoleTracker } from '@jupyterlab/console';
import { INodStackFrame } from '../types';
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

/**
 * A namespace for private data.
 */
// namespace Private {
//   /**
//    * Construct an id for the given frame.
//    *
//    * @param frame The frame.
//    */
//   export function getFrameId(frame: IDebugger.IStackFrame): string {
//     return `${frame?.source?.path}-${frame?.id}`;
//   }
// }
