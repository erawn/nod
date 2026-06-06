import { ReactWidget } from '@jupyterlab/ui-components';
import React from 'react';

export class ReadOnlyHeader extends ReactWidget {
    constructor() {
        super();
        this.addClass('jp-nod-readOnly-header');
        this.id = 'nod-plugin-status-header';
    }
    render() {
        return (
            <>
                <span className="jp-nod-pluginstatus-maintext">
                    Notebook is Readonly while another notebook has unsaved changes
                </span>
                <br></br>
                <span className="jp-nod-pluginstatus-bottomtext">
                    Restart or Export the edited Nod Notebook to Continue
                </span>
            </>
        );
    }
}