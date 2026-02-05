

// import {
//     ReactWidget,
//     ToolbarButtonComponent,
//     ToolbarButton,
//     UseSignal
// } from '@jupyterlab/ui-components';
// import React from 'react';
// import { nodState } from './state';
// import {
//     INotebookTracker,
// } from '@jupyterlab/notebook';
// import { find } from '@lumino/algorithm';
// import { Widget } from '@lumino/widgets';
// import { writeChange } from './messaging';
// interface IExportButtonProps {
//     tracker: INotebookTracker;
//     state: nodState;
// }

// export function tryAddExportButton(notebookTracker: INotebookTracker, state: nodState) {
//     const namesIterator = notebookTracker?.currentWidget?.toolbar.names();
//     const existing = namesIterator
//         ? find(namesIterator, value => value === 'exportButton')
//         : false;
//     if (existing) {
//         return false;
//     }

//     notebookTracker?.currentWidget?.toolbar.insertBefore(
//         'spacer',
//         'exportButton',
//         ExportButtonComponent(notebookTracker, state)
//     );
// }
// function ExportButtonComponent(notebookTracker: INotebookTracker,
//     state: nodState): Widget {
//     return ReactWidget.create(
//         <ExportButton tracker={notebookTracker} state={state} />
//     ) as Widget;
// }

// class ExportButton extends ReactWidget (props: IExportButtonProps): JSX.Element {
//     // const translator = props.translator || nullTranslator;
//     // const trans = translator.load('jupyterlab');
//     function handleClick() {
//         console.log("clicked!")
//         writeChange()
//     }

//     render (
//         <UseSignal signal={props.tracker.currentChanged}>
//             {() => (
//                 <ToolbarButtonComponent
//                     onClick={handleClick}
//                     // tooltip={trans.__('Switch kernel')}
//                     label={"Export and Close"}
//                 />
//             )}
//         </UseSignal>
//     );
// }