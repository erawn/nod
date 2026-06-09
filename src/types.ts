import { IDebugger } from '@jupyterlab/debugger';
import * as z from 'zod';
import { nodState } from './state';
const lineInfo = z.object({ line: z.number(), column: z.number() });
export const nodSchema = z.object({
  stack_info: z.array(
    z.object({
      index: z.number(),
      source_file: z.string(),
      relative_source_file: z.string(),
      connection_dir: z.string(),
      cli_arguments: z.string(),
      function_name: z.string(),
      frame_xml: z.array(z.string()),
      fmt: z.string(),
      fileInfo: z.optional(
        z.object({
          function_body_position: z.object({ start: lineInfo, end: lineInfo }),
          indent: z.number(),
          text_header: z.array(z.string()),
          text_body: z.array(z.string()),
          text_above: z.array(z.string()),
          text_below: z.array(z.string()),
          notebook_file: z.string(),
          notebook_content: z.string()
        })
      )
    })
  ),
  module_filters: z.array(z.string()),
  fmt: z.string(),
  how_restart: z.union([z.literal('continue'), z.int()]),
  dangerously_bypass_readonly: z.boolean()
});
export type nodSchema = z.infer<typeof nodSchema>;
export type stackInfo = nodSchema['stack_info'];
export const hasFileInfo = (
  frame: NonNullable<nodState['currentFrame']>
): frame is Required<NonNullable<nodState['currentFrame']>> => {
  return frame.fileInfo !== undefined;
};

export interface INodStackFrame extends IDebugger.IStackFrame {
  scope: IDebugger.IScope;
  className?: string;
}
