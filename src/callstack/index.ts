// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import type { ITranslator } from '@jupyterlab/translation';
import { nullTranslator } from '@jupyterlab/translation';
import {
  CommandToolbarButton,
  AccordionToolbar,
  PanelWithToolbar,
  ToolbarButton
} from '@jupyterlab/ui-components';

import type { CommandRegistry } from '@lumino/commands';
import { AccordionPanel, type Panel } from '@lumino/widgets';
import type { IDebugger } from '@jupyterlab/debugger'
import { CallstackBody } from './body';
import { CallstackModel } from './model';
import { bugIcon, SidePanel } from "@jupyterlab/ui-components";
import { nodState } from '../state';
import { nodCommands } from '../commands';
export class NodSidebar extends SidePanel {
  /**
   * Instantiate a new Debugger.Sidebar
   *
   * @param options The instantiation options for a Debugger.Sidebar
   */
  constructor(options: { translator: ITranslator, service: IDebugger, model: CallstackModel }) {
    const translator = options.translator || nullTranslator;
    super({ translator });
    this.id = 'jp-debugger-sidebar';
    this.title.icon = bugIcon;
    this.addClass('jp-DebuggerSidebar');

    this.content.addClass('jp-DebuggerSidebar-body');
    (this.content as AccordionPanel).expand(0)
    const model = options.model
    const callstack = new Callstack({
      // commands: callstackCommands,
      model: model,
      translator: translator,
    });
    // const tree = new VariablesBodyTree({
    //   model,
    //   service,
    //   commands,
    //   translator
    // });
    this.addWidget(callstack);
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
    this.title.label = 'Nod Callstack';
    const widget = new CallstackBody(model)
    // widgets.map(widget => accordion.addWidget(widget))
    this.toolbar.node.setAttribute(
      'aria-label',
      trans.__('Breakpoints panel toolbar')
    );

    this.toolbar.addItem(
      'nod-exit',
      new ToolbarButton({
        className: 'nod-Close',
        onClick: (): void => {
          nodState.Instance().app.commands.execute(nodCommands.exitNotebook)
        },
        tooltip: 'Exit',
        label: 'Exit',
      })
    );


    this.toolbar.addItem(
      'nod-export',
      new ToolbarButton({
        className: 'nod-export',
        iconClass: 'fas fa-download ',
        onClick: (): void => {
          nodState.Instance().app.commands.execute(nodCommands.exportNotebook)
        },
        tooltip: 'Export',
        label: 'Export',
      })
    );
    this.addWidget(widget)
    this.addClass('jp-DebuggerCallstack');
  }
}

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
