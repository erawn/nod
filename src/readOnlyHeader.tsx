import { IDebugger } from '@jupyterlab/debugger';
import { bugIcon, ReactWidget } from '@jupyterlab/ui-components';
import React, { useEffect, useMemo } from 'react';
import { nodState } from './state';

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
          this notebook is readonly while another notebook has changes not
          pushed to source
        </span>
        <br></br>
        <span className="jp-nod-pluginstatus-bottomtext">
          Export and Restart the edited Nod Notebook to Continue
        </span>
      </>
    );
  }
}

export class debugHeader extends ReactWidget {
  constructor(service: IDebugger) {
    super();
    this.service = service;
    this.addClass('jp-nod-readOnly-header');
    this.id = 'nod-plugin-status-header';
  }

  service: IDebugger;
  render() {
    const state = nodState.Instance();
    const isDebuggerActive = useMemo(() => {
      console.log(state.debuggerService.session?.isStarted);
      return state.debuggerService.session?.isStarted;
    }, [this.service.model, state.debuggerService.session?.isStarted]);
    return <>{isDebuggerActive && <DebugComponent service={this.service} />}</>;
  }
}
interface DebugComponentProps {
  service: IDebugger;
}
const DebugComponent = (props: DebugComponentProps): JSX.Element => {
  // const isDebuggerActive = useMemo(() => {
  //   console.log('isdebuggeractive fired')
  //   return props.service.isStarted ?? false
  // }, [props.service.model])

  return (
    <>
      <div className="jp-nod-readOnly-header">
        <span className="jp-nod-pluginstatus-maintext">
          Activate Debugger to Use Nod Log!
        </span>
        <br></br>
        <span className="jp-nod-pluginstatus-bottomtext">
          Press the <bugIcon.react tag="span" verticalAlign="middle" /> icon
        </span>
      </div>
    </>
  );
};
