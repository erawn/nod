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
      function_name: z.string(),
      function_id: z.string(),
      frame_xml: z.array(z.string()),
      fmt: z.string(),
      file_info: z.optional(
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
  dangerously_bypass_readonly: z.boolean(),
  nod_info_local_path: z.string(),
  cli_args: z.string(),
  python_pid: z.number(),
  nod_info_rel_path: z.optional(z.string()),
  key: z.string()
  // nod_log: z.object({
  //   entries: z.array(
  //     z.object({
  //       function_id: z.string(),
  //       entry_id: z.string(),
  //       vars: z.array(
  //         z.object({ id: z.string(), name: z.string(), val: z.string(), type: z.string() })
  //       )
  //     })
  //   )
  // })
});
export type nodSchema = z.infer<typeof nodSchema>;

export const nodSchemas = z.array(nodSchema);
export type nodSchemas = z.infer<typeof nodSchemas>;
export type stackInfo = nodSchema['stack_info'];
export const nodStudyLogRequest = z.object({
  kind: z.literal([
    'notebook_start',
    'write_request',
    'execute_cell',
    'navigate_stackframe',
    'edit_notebook',
    'restart',
    'nod_log_inject_state'
  ]),
  key: z.string(),
  nodInfo: z.optional(nodSchema),
  function_id: z.optional(z.string()),
  cell: z.optional(z.string()),
  cellChangeArgs: z.optional(z.string()),
  varname: z.optional(z.string()),
  restartSave: z.optional(z.boolean()),
  var_string: z.optional(z.string())
});
export type nodStudyLogRequest = z.infer<typeof nodStudyLogRequest>;

export const hasFileInfo = (
  frame: NonNullable<nodState['currentFrame']>
): frame is Required<NonNullable<nodState['currentFrame']>> => {
  return frame.file_info !== undefined;
};

export interface INodStackFrame extends IDebugger.IStackFrame {
  scope: IDebugger.IScope;
  className?: string;
}
