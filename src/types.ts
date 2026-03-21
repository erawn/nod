import * as z from "zod"
const lineInfo = z.object({ line: z.number(), column: z.number() })
export const nodSchema = z.object({
    function_body_position: z.object({ start: lineInfo, end: lineInfo }),
    indent: z.number(),
    text_header: z.array(z.string()),
    text_body: z.array(z.string()),
    text_above: z.array(z.string()),
    text_below: z.array(z.string()),
    file_name: z.string(),
    export_file: z.string(),
    connection_dir: z.string()
})
export type nodSchema = z.infer<typeof nodSchema>