import { z } from 'zod';

export const SalesforceCreateResponseSchema = z.object({
  id: z.string(),
  success: z.boolean(),
  errors: z.array(z.unknown()).default([]),
});

export const SalesforceQueryResponseSchema = z.object({
  totalSize: z.number(),
  done: z.boolean(),
  records: z.array(
    z
      .object({
        attributes: z.object({
          type: z.string(),
          url: z.string(),
        }),
      })
      .passthrough()
  ),
  nextRecordsUrl: z.string().optional(),
});

export const SalesforceDescribeResponseSchema = z.object({
  name: z.string(),
  label: z.string(),
  labelPlural: z.string(),
  fields: z.array(
    z.object({
      name: z.string(),
      label: z.string(),
      type: z.string(),
      length: z.number().optional(),
      unique: z.boolean(),
      nillable: z.boolean(),
      createable: z.boolean(),
      updateable: z.boolean(),
    })
  ),
});

export type SalesforceCreateResponse = z.infer<typeof SalesforceCreateResponseSchema>;
export type SalesforceQueryResponse = z.infer<typeof SalesforceQueryResponseSchema>;
export type SalesforceDescribeResponse = z.infer<typeof SalesforceDescribeResponseSchema>;
