// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { FilterBox, ReactWidget } from '@jupyterlab/ui-components';
import React, { useEffect, useState } from 'react';
import { CallstackModel } from './model';
import { INodStackFrame } from '../types';
import multimatch from 'multimatch';
/**
 * The body for a Callstack Panel.
 */
export class CallstackBody extends ReactWidget {
  /**
   * Instantiate a new Body for the Callstack Panel.
   *
   * @param model The model for the callstack.
   */
  constructor(model: CallstackModel) {
    super();
    this._model = model;
    this.addClass('jp-DebuggerCallstack-body');
    this._searchInputRef = React.createRef<HTMLInputElement>();
  }

  /**
   * Render the FramesComponent.
   */
  render(): JSX.Element {
    // console.log("current filers", this._model.filters)
    return (
      <>
        <FramesComponent
          model={this._model}
          searchInputRef={this._searchInputRef}
        />
      </>
    );
  }
  private _searchInputRef: React.RefObject<HTMLInputElement>;
  private _model: CallstackModel;
}

/**
 * A React component to display a list of frames in a callstack.
 *
 * @param {object} props The component props.
 * @param props.model The model for the callstack.
 * @returns A JSX element.
 */
const FramesComponent = ({
  model,
  searchInputRef
}: {
  model: CallstackModel;
  searchInputRef: React.RefObject<HTMLInputElement>;
}): JSX.Element => {
  const [frames, setFrames] = useState<INodStackFrame[]>(model.frames);
  const [selected, setSelected] = useState(model.frame);
  const [filters, setFilters] = useState(model.filters);
  const [editedNotebookIndex, setEditedNotebookIndex] = useState(
    model.editedNotebookIndex
  );
  const onSelected = (frame: any): void => {
    setSelected(frame);
    model.frame = frame;
  };

  useEffect(() => {
    const updateFrames = (): void => {
      setSelected(model.frame);
      setFrames(model.frames);
      setFilters(model.filters);
      setEditedNotebookIndex(model.editedNotebookIndex);
    };
    model.framesChanged.connect(updateFrames);
    model.currentFrameChanged.connect(updateFrames);
    model.filtersChanged.connect(updateFrames);
    model.editedNotebookIndexChanged.connect(updateFrames);
    return (): void => {
      model.framesChanged.disconnect(updateFrames);
      model.currentFrameChanged.disconnect(updateFrames);
      model.filtersChanged.disconnect(updateFrames);
      model.editedNotebookIndexChanged.disconnect(updateFrames);
    };
  }, [model]);

  return (
    <ul>
      <div className={'jp-Nod-CallStack-SearchBox'}>
        <FilterBox
          initialQuery={model.filters.join(',')}
          placeholder={'**/modA.py, **/modB.py'}
          disabled={false}
          updateFilter={(fn, query) => {
            model.filters = query?.split(',').map(entry => entry.trim()) ?? [
              ''
            ];
          }}
          useFuzzyFilter={false}
          // inputRef={searchInputRef}
        />
      </div>

      {frames
        .filter((frame: INodStackFrame) => {
          if (frame.source !== undefined && frame.source.path !== undefined) {
            // console.log(frame, filters, multimatch([frame.source.path], filters))

            console.log(
              frame.source?.path,
              editedNotebookIndex,
              frame.id === editedNotebookIndex
            );
          }
          if (frame.source === undefined || frame.source.path === undefined) {
            return false;
          } else if (
            multimatch([frame.source.path], filters).indexOf(
              frame.source.path
            ) >= 0
          ) {
            return true;
          }
          return false;
        })
        .map((frame: INodStackFrame) => {
          const edited =
            frame.id === editedNotebookIndex ? 'jp-NodFileEdited' : '';
          const select = selected?.id === frame.id ? 'selected' : '';
          frame.className =
            select + ' ' + edited + ' ' + 'jp-DebuggerCallstackFrame';
          return frame;
        })
        .map((frame: INodStackFrame) => (
          <li
            key={frame.id}
            onClick={(): void => onSelected(frame)}
            className={frame.className}
          >
            <span className={'jp-DebuggerCallstackFrame-name'}>
              {frame.name}
            </span>
            <span
              className={'jp-DebuggerCallstackFrame-location'}
              title={frame.source?.path}
            >
              {frame.source?.name}
            </span>
            {/* <VariablesBranch
              key={ele.name}
              data={ele.scope.variables}
              frame={ele}
            // handleSelectVariable={handleSelectVariable}
            /> */}
          </li>
        ))}
      {/* <TreeView className="jp-TreeView">

      </TreeView> */}
    </ul>
  );
};
