import {
    INotebookTracker,
} from '@jupyterlab/notebook';

import { Cell } from '@jupyterlab/cells';

export function addStyling(notebookTracker: INotebookTracker) {
    // console.log(notebookTracker.currentWidget?.content.node)
    const content = notebookTracker?.currentWidget?.content
    if (content) {
        for (const widget of content.children()) {
            return widget instanceof Cell
        }
    }

}