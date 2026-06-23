// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import type { ITranslator } from '@jupyterlab/translation';
import { nullTranslator } from '@jupyterlab/translation';
import {
  closeIcon,
  downloadIcon,
  fileUploadIcon,
  PanelWithToolbar,
  refreshIcon,
  stopIcon,
  ToolbarButton
} from '@jupyterlab/ui-components';

import { AccordionPanel, Widget, type Panel } from '@lumino/widgets';
import type { IDebugger } from '@jupyterlab/debugger';
import { CallstackBody } from './body';
import { CallstackModel, NodRunningModel, NodSessionItem } from './model';
import { bugIcon, SidePanel } from '@jupyterlab/ui-components';
import { nodState } from '../state';
import { nodCommands } from '../commands';
import { Signal } from '@lumino/signaling';
import Section from '@jupyterlab/running';
import { ListWidget } from './listWidget';
import { getKernels } from '../messaging';
import { run } from 'node:test';
// import { Section } from "@jupyterlab/running"

export class NodSidebar extends SidePanel {
  /**
   * Instantiate a new Debugger.Sidebar
   *
   * @param options The instantiation options for a Debugger.Sidebar
   */
  constructor(options: {
    translator: ITranslator;
    service?: IDebugger;
    model: CallstackModel;
    runningModel: NodRunningModel;
  }) {
    const translator = options.translator || nullTranslator;
    const trans = (options.translator ?? nullTranslator).load('jupyterlab');
    super({ translator });
    this.id = 'jp-debugger-sidebar';
    this.title.icon = bugIcon;
    this.runningModel = options.runningModel;
    this.addClass('jp-DebuggerSidebar');
    this.addClass('jp-NodLeftPanel');
    this.content.addClass('jp-DebuggerSidebar-body');
    (this.content as AccordionPanel).expand(0);

    const nodTitle = `<h3>${this._trans.__('NOD')}</h3>`;
    const titleWidget = new Widget();
    titleWidget.node.innerHTML = nodTitle;
    titleWidget.addClass('jp-ToolbarButton');
    titleWidget.addClass('jp-nod-label');
    this.toolbar.addItem('nod-label', titleWidget);
    // this.toolbar.title.label = trans.__('Nod')
    // this.toolbar.title.className = 'jp-nod-label'
    // this.toolbar.title = titleWidget
    this.toolbar.addItem(
      'nod-export',
      new ToolbarButton({
        className: 'nod-export',
        icon: downloadIcon,
        onClick: (): void => {
          nodState.Instance().app.commands.execute(nodCommands.exportNotebook);
        },
        tooltip: trans.__('Export Nod Program Back to Source')
        // label: trans.__('Export')
      })
    );
    this.toolbar.addItem(
      'nod-restart',
      new ToolbarButton({
        className: 'nod-restart',
        icon: refreshIcon,
        onClick: (): void => {
          nodState.Instance().app.commands.execute(nodCommands.restart);
        },
        tooltip: trans.__('Restart Nod Program and Pull Source Changes')
        // label: trans.__('Restart')
      })
    );
    this.toolbar.addItem(
      'nod-close',
      new ToolbarButton({
        className: 'nod-Close',
        icon: closeIcon,
        onClick: (): void => {
          nodState.Instance().app.commands.execute(nodCommands.exitNotebook);
        },
        tooltip: trans.__('Exit Nod Session')
        // label: trans.__('Exit')
      })
    );

    const model = options.model;
    const callstack = new Callstack({
      // commands: callstackCommands,
      model: model,
      translator: translator
    });
    this.addWidget(callstack);
    const runningTab = new ListWidget({
      model: options.runningModel,
      collapseToggled: this._collapseToggled,
      translator
    });
    runningTab.mode = 'list';

    const runningKernelsTab = new PanelWithToolbar();
    runningKernelsTab.addClass('jp-NodLeftPanel-section');
    runningKernelsTab.title.label = trans.__('Sessions');
    runningKernelsTab.toolbar.addItem(
      'nod-refresh-sessions',
      new ToolbarButton({
        className: 'nod-refresh-sessions',
        icon: refreshIcon,
        onClick: (): void => {
          this.refreshKernels();
        },
        tooltip: trans.__('Refresh Sessions')
      })
    );
    runningKernelsTab.addWidget(runningTab);
    this.addWidget(runningKernelsTab);

    // const buttonPanel = buttonTab(translator)
    // this.addWidget(buttonPanel)
  }
  refreshKernels() {
    getKernels().then(reply => {
      // console.log(reply)
      if (reply === undefined) {
        nodState.Instance().callstackSidebar.runningModel.setItems([]);
      }
      if (reply !== undefined && reply.length > 0) {
        nodState.Instance().callstackSidebar.runningModel.setItems(
          reply.map(info => {
            const frame = info.stack_info[0];
            return new NodSessionItem({
              name: frame.function_name,
              rel_path: frame.relative_source_file,
              full_path: frame.source_file,
              nodSchema: info
            });
          })
        );
      }
    });
  }
  activate(): void {
    console.log('activating sidebar');
    nodState.Instance().callstackSidebar.interval = setInterval(
      nodState.Instance().callstackSidebar.refreshKernels,
      1000
    );
    // (function loop() {
    //   setTimeout(() => {
    //     this.callstackSidebar.interval = setInterval(this.callstackSidebar.refreshKernels, 1000)

    //     loop();
    //   }, delay);
    // })();
  }
  runningModel: NodRunningModel;
  interval: NodeJS.Timeout | undefined;
  private _collapseToggled = new Signal<NodSidebar, boolean>(this);
  dispose(): void {
    if (this.interval !== undefined) clearInterval(this.interval);
  }
}
/**
 * A Panel to show a callstack.
 */
class Callstack extends PanelWithToolbar {
  /**
   * Instantiate a new Callstack Panel.
   *
   * @param options The instantiation options for a Callstack Panel.
   */
  constructor(options: Callstack.IOptions) {
    super(options);
    const { model } = options;
    const trans = (options.translator ?? nullTranslator).load('jupyterlab');
    this.title.label = trans.__('Callstack');
    const widget = new CallstackBody(model);
    // widgets.map(widget => accordion.addWidget(widget))
    this.toolbar.node.setAttribute('aria-label', trans.__('Callstack Viewer'));

    this.addWidget(widget);
    this.addClass('jp-NodLeftPanel-section');
    this.addClass('jp-DebuggerCallstack');
  }
}
// function buttonTab(translator: ITranslator) {
//   const buttonTab = new PanelWithToolbar();
//   const trans = translator.load('jupyterlab');
//   buttonTab.addClass('jp-NodLeftPanel-section');
//   buttonTab.title.label = trans.__('Nod Actions');

//   buttonTab.addWidget(
//     new ToolbarButton({
//       className: 'nod-export',
//       icon: downloadIcon,
//       onClick: (): void => {
//         nodState.Instance().app.commands.execute(nodCommands.exportNotebook);
//       },
//       tooltip: trans.__('Export Nod Program Back to Source'),
//       label: trans.__('Export Nod Program to Source File')
//     })
//   );
//   buttonTab.addWidget(
//     new ToolbarButton({
//       className: 'nod-restart',
//       icon: refreshIcon,
//       onClick: (): void => {
//         nodState.Instance().app.commands.execute(nodCommands.restart);
//       },
//       tooltip: trans.__('Restart Nod Program and Pull Source Changes'),
//       label: trans.__('Restart Nod Program and Pull Source Changes')
//     })
//   );
//   buttonTab.addWidget(
//     new ToolbarButton({
//       className: 'nod-Close',
//       icon: closeIcon,
//       onClick: (): void => {
//         nodState.Instance().app.commands.execute(nodCommands.exitNotebook);
//       },
//       tooltip: trans.__('Exit Nod Session'),
//       label: trans.__('Exit Nod Session')
//     })
//   );
//   return buttonTab;
// }
/**
 * A namespace for Callstack `statics`.
 */
export namespace Callstack {
  /**
   * The toolbar commands and registry for the callstack.
   */
  // export interface ICommands {
  //   /**
  //    * The command registry.
  //    */
  //   registry: CommandRegistry;

  //   /**
  //    * The pause/continue command ID.
  //    */
  //   continue: string;

  //   /**
  //    * The terminate command ID.
  //    */
  //   terminate: string;

  //   /**
  //    * The next / stepOver command ID.
  //    */
  //   next: string;

  //   /**
  //    * The stepIn command ID.
  //    */
  //   stepIn: string;

  //   /**
  //    * The stepOut command ID.
  //    */
  //   stepOut: string;

  //   /**
  //    * The evaluate command ID.
  //    */
  //   evaluate: string;
  // }

  /**
   * Instantiation options for `Callstack`.
   */
  export interface IOptions extends Panel.IOptions {
    /**
     * The toolbar commands interface for the callstack.
     */
    // commands: ICommands;

    /**
     * The model for the callstack.
     */
    model: CallstackModel;

    /**
     * The application language translator
     */
    translator?: ITranslator;
  }
}
