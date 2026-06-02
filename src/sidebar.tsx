import { IDebugger } from "@jupyterlab/debugger";
import { ITranslator, nullTranslator } from "@jupyterlab/translation";
import { bugIcon, SidePanel } from "@jupyterlab/ui-components";
import { Callstack } from "./callstack";
import { CallstackModel } from "./callstack/model";
import { AccordionPanel } from '@lumino/widgets';
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
            translator
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