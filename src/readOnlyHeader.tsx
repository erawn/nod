import { IDebugger } from '@jupyterlab/debugger';
import { bugIcon, ReactWidget } from '@jupyterlab/ui-components';
import React, { useMemo } from 'react';
import { nodState } from './state';

export class ReadOnlyHeader extends ReactWidget {
  constructor() {
    super();
    this.addClass('jp-nod-readOnly-header');
    this.id = 'nod-plugin-status-header';
  }
  render() {
    const trans = nodState.Instance().translator.load('jupyterlab');
    return (
      <>
        <span className="jp-nod-pluginstatus-maintext">
          {trans.__('Notebook is Readonly After Edits To Another Notebook')}
        </span>
        <br></br>
        <span className="jp-nod-pluginstatus-bottomtext">
          {trans.__('Restart the edited Nod Notebook to Edit Other Notebooks')}
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
interface IDebugComponentProps {
  service: IDebugger;
}
const DebugComponent = (props: IDebugComponentProps): JSX.Element => {
  // const isDebuggerActive = useMemo(() => {
  //   console.log('isdebuggeractive fired')
  //   return props.service.isStarted ?? false
  // }, [props.service.model])
  const trans = nodState.Instance().translator.load('jupyterlab');
  return (
    <>
      <div className="jp-nod-readOnly-header">
        <span className="jp-nod-pluginstatus-maintext">
          {trans.__('Activate Debugger to Use Nod Log!')}
        </span>
        <br></br>
        <span className="jp-nod-pluginstatus-bottomtext">
          {trans.__('Press the')}{' '}
          <bugIcon.react tag="span" verticalAlign="middle" /> {trans.__('icon')}
        </span>
      </div>
    </>
  );
};
