// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.
/* eslint-disable @typescript-eslint/no-explicit-any */

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
// /**
//  * A React component to display a list of variables.
//  *
//  * @param {object} props The component props.
//  * @param props.data An array of variables.
//  * @param props.service The debugger service.
//  * @param props.filter Optional variable filter list.
//  */
// const VariablesBranch = (props: { data: IDebugger.IVariable[], frame?: INodStackFrame }): JSX.Element => {
//   const { data, frame
//     //  handleSelectVariable
//   } =
//     props;
//   const [variables, setVariables] = useState(data);

//   useEffect(() => {
//     setVariables(data);
//   }, [data]);

//   return (
//     <>
//       {frame ? (

//         <><span className={'jp-DebuggerCallstackFrame-name'}>{frame.name}</span><span
//           className={'jp-DebuggerCallstackFrame-location'}
//           title={frame.source?.name}
//         >
//           {frame.source?.name}
//         </span></>
//       ) : (<></>)
//       }
//       {variables
//         // .filter(
//         //   variable => !(filter || new Set()).has(variable.evaluateName || '')
//         // )
//         .map(variable => {
//           const key = `${variable.name}-${variable.evaluateName}-${variable.type}-${variable.value}-${variable.variablesReference}`;
//           return (
//             <VariableComponent
//               key={key}
//               data={variable}
//             // onSelect={handleSelectVariable}
//             />
//           );
//         })}
//     </>
//   );
// };

// // function _prepareDetail(variable: IDebugger.IVariable) {
// //   if (
// //     variable.type === 'float' &&
// //     (variable.value == 'inf' || variable.value == '-inf')
// //   ) {
// //     return variable.value;
// //   }
// //   const detail = convertType(variable);
// //   if (variable.type === 'float' && isNaN(detail as number)) {
// //     // silence React warning:
// //     // `Received NaN for the `children` attribute. If this is expected, cast the value to a string`
// //     return 'NaN';
// //   }
// //   return detail;
// // }
// /**
//  * A React component to display one node variable in tree.
//  *
//  * @param {object} props The component props.
//  * @param props.data An array of variables.
//  * @param props.service The debugger service.
//  * @param props.filter Optional variable filter list.
//  */
// const VariableComponent = (props: { data: IDebugger.IVariable }): JSX.Element => {
//   const { data } = props;
//   const [variable] = useState(data);
//   const [showDetailsButton, setShowDetailsButton] = useState<boolean>(false);
//   const [expanded, setExpanded] = useState<boolean>(false);
//   const [variables, setVariables] = useState<DebugProtocol.Variable[] | null>(
//     null
//   );

//   // const trans = useMemo(
//   //   () => (translator ?? nullTranslator).load('jupyterlab'),
//   //   [translator]
//   // );
//   // const onSelection = onSelect ?? (() => void 0);

//   const expandable = useMemo(
//     () => variable.variablesReference !== 0 || variable.type === 'function',
//     [variable.variablesReference, variable.type]
//   );

//   // const details = useMemo(() => _prepareDetail(variable), [variable]);

//   const hasMimeRenderer = useMemo(
//     () =>
//       ![
//         'special variables',
//         'protected variables',
//         'function variables',
//         'class variables'
//       ].includes(variable.name),
//     [variable.name]
//   );

//   // const disableMimeRenderer = useMemo(
//   //   () =>
//   //     !service.model.hasRichVariableRendering ||
//   //     !commands.isEnabled(Debugger.CommandIDs.renderMimeVariable, {
//   //       name: variable.name,
//   //       frameID: service.model.callstack.frame?.id
//   //     } as any),
//   //   [
//   //     service.model.hasRichVariableRendering,
//   //     variable.name,
//   //     service.model.callstack.frame?.id
//   //   ]
//   // );

//   // const fetchChildren = useCallback(async () => {
//   //   if (expandable && !variables) {
//   //     setVariables(await service.inspectVariable(variable.variablesReference));
//   //   }
//   // }, [expandable, service, variable.variablesReference, variables]);

//   const onVariableClicked = useCallback(
//     async (event: React.MouseEvent): Promise<void> => {
//       const item = getTreeItemElement(event.target as HTMLElement);
//       if (event.currentTarget !== item) {
//         return;
//       }

//       if (!expandable) {
//         return;
//       }
//       setExpanded(!expanded);
//     },
//     [expandable, expanded]
//   );

//   // const onSelectChange = useCallback(
//   //   (event: CustomEvent) => {
//   //     if (event.currentTarget === event.detail && event.detail.selected) {
//   //       onSelection(variable);
//   //     }
//   //   },
//   //   [variable]
//   // );

//   // const renderVariable = useCallback(() => {
//   //   commands
//   //     .execute(Debugger.CommandIDs.renderMimeVariable, {
//   //       name: variable.name,
//   //       frameID: service.model.callstack.frame?.id
//   //     } as any)
//   //     .catch(reason => {
//   //       console.error(`Failed to render variable ${variable?.name}`, reason);
//   //     });
//   // }, [commands, variable.name, service.model.callstack.frame?.id]);

//   // const onContextMenu = useCallback(
//   //   (event: React.MouseEvent<HTMLElement, MouseEvent>): void => {
//   //     const item = getTreeItemElement(event.target as HTMLElement);
//   //     if (event.currentTarget !== item) {
//   //       return;
//   //     }

//   //     onSelection(variable);
//   //   },
//   //   [variable]
//   // );

//   return (
//     <TreeItem
//       className="jp-TreeItem nested"
//       expanded={expanded}
//       // onSelect={onSelectChange}
//       // onExpand={fetchChildren}
//       onClick={(e): Promise<void> => onVariableClicked(e)}
//       // onContextMenu={onContextMenu}
//       // onKeyDown={event => {
//       //   if (event.key == 'Enter') {
//       //     if (hasMimeRenderer && showDetailsButton) {
//       //       onSelection(variable);
//       //       renderVariable();
//       //     }
//       //   }
//       // }}
//       onFocus={event => {
//         setShowDetailsButton(!event.defaultPrevented);
//         event.preventDefault();
//       }}
//       onBlur={event => {
//         setShowDetailsButton(false);
//       }}
//       onMouseOver={(event: React.MouseEvent<HTMLElement, MouseEvent>) => {
//         setShowDetailsButton(!event.defaultPrevented);
//         event.preventDefault();
//       }}
//       onMouseLeave={(event: React.MouseEvent<HTMLElement, MouseEvent>) => {
//         setShowDetailsButton(false);
//       }}
//     >
//       <span className="jp-DebuggerVariables-name">{variable.name}</span>
//       {/* {details != null && (
//         <span className="jp-DebuggerVariables-detail">{details}</span>
//       )} */}
//       {/* {hasMimeRenderer && showDetailsButton && (
//         <Button
//           className="jp-DebuggerVariables-renderVariable"
//           appearance="stealth"
//           slot="end"
//           disabled={disableMimeRenderer}
//           onClick={e => {
//             e.stopPropagation();
//             renderVariable();
//           }}
//           title={trans.__('Render variable: %1', variable?.name)}
//         >
//           <searchIcon.react tag={null} />
//         </Button>
//       )} */}
//       {variables ? (
//         <VariablesBranch
//           key={variable.name}
//           // commands={commands}
//           data={variables}
//         // service={service}
//         // filter={filter}
//         // translator={translator}
//         // handleSelectVariable={onSelect}
//         />
//       ) : (
//         /* Trick to ensure collapse button is displayed
//            when variables are not loaded yet */
//         expandable && <TreeItem />
//       )}

//     </TreeItem>
//   );
// };
