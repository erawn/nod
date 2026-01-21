import * as z from "zod"
export const nodSchema = z.object({
    sourceFile: z.string(),
    line: z.number(),
    textAbove: z.array(z.string()),
    textBelow: z.array(z.string()),
    functionHeader: z.array(z.string()),
    funcBodyPosition: z.array(z.number()),
    indent: z.number()
})
export type nodSchema = z.infer<typeof nodSchema>