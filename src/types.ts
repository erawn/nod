import { IDebugger } from "@jupyterlab/debugger"
import * as z from "zod"
const lineInfo = z.object({ line: z.number(), column: z.number() })
export const nodSchema = z.array(z.object({
    function_body_position: z.object({ start: lineInfo, end: lineInfo }),
    indent: z.number(),
    text_header: z.array(z.string()),
    text_body: z.array(z.string()),
    text_above: z.array(z.string()),
    text_below: z.array(z.string()),
    notebook_file: z.string(),
    source_file: z.string(),
    relative_source_file: z.string(),
    connection_dir: z.string(),
    notebook_content: z.string(),
    cli_arguments: z.string(),
    function_name: z.string(),
    frame_xml: z.string()
}))
export type nodSchema = z.infer<typeof nodSchema>


export interface INodStackFrame extends IDebugger.IStackFrame {

    scope: IDebugger.IScope
}