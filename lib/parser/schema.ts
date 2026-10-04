import { z } from 'zod';

import { ENTRY_TYPES } from '../entryTypes';

// The structured result of a note. Same shape in three places:
// the n8n response (docs/n8n-contract.md), the review screen, and entries.parsed.

export const parsedItemSchema = z.object({
  name: z.string().trim().min(1).max(100),
  value: z.union([z.number(), z.string().trim().min(1).max(200)]),
  unit: z.string().trim().max(30).nullable(),
});

export const parsedEntrySchema = z.object({
  tank_name: z.string().trim().min(1).max(100).nullable(),
  type: z.enum(ENTRY_TYPES),
  items: z.array(parsedItemSchema).max(50),
  note: z.string().trim().max(5000).nullable(),
});

/** What the parser (mock or n8n) returns: the parsed entry plus what was heard/typed. */
export const parseResultSchema = parsedEntrySchema.extend({
  transcript: z.string().trim().min(1).max(5000),
});

export type ParsedItem = z.infer<typeof parsedItemSchema>;
export type ParsedEntry = z.infer<typeof parsedEntrySchema>;
export type ParseResult = z.infer<typeof parseResultSchema>;
