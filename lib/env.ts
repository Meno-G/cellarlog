import { z } from 'zod';

import { AppError } from './errors';

// `KEY=` in .env arrives as an empty string; treat it as missing.
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema.optional());

const schema = z
  .object({
    EXPO_PUBLIC_SUPABASE_URL: z.url({ error: 'must be your Supabase project URL' }),
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string({ error: 'is missing' }).min(1, 'is missing'),
    EXPO_PUBLIC_PARSER_MODE: optional(z.enum(['mock', 'n8n'], { error: 'must be "mock" or "n8n"' })),
    EXPO_PUBLIC_N8N_WEBHOOK_URL: optional(z.url({ error: 'must be a full https:// URL' })),
  })
  .refine(
    (env) => env.EXPO_PUBLIC_PARSER_MODE !== 'n8n' || env.EXPO_PUBLIC_N8N_WEBHOOK_URL !== undefined,
    {
      path: ['EXPO_PUBLIC_N8N_WEBHOOK_URL'],
      message: 'is required when EXPO_PUBLIC_PARSER_MODE=n8n',
    },
  );

export type Env = {
  supabaseUrl: string;
  supabasePublishableKey: string;
  parserMode: 'mock' | 'n8n';
  n8nWebhookUrl: string | undefined;
};

type EnvResult = { ok: true; env: Env } | { ok: false; problems: string[] };

function readEnv(): EnvResult {
  // Expo only inlines EXPO_PUBLIC_* when each one is accessed literally.
  const parsed = schema.safeParse({
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    EXPO_PUBLIC_PARSER_MODE: process.env.EXPO_PUBLIC_PARSER_MODE,
    EXPO_PUBLIC_N8N_WEBHOOK_URL: process.env.EXPO_PUBLIC_N8N_WEBHOOK_URL,
  });

  if (!parsed.success) {
    return {
      ok: false,
      problems: parsed.error.issues.map((issue) => `${issue.path.join('.')} ${issue.message}`),
    };
  }

  const data = parsed.data;
  return {
    ok: true,
    env: {
      supabaseUrl: data.EXPO_PUBLIC_SUPABASE_URL,
      supabasePublishableKey: data.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      parserMode: data.EXPO_PUBLIC_PARSER_MODE ?? 'mock',
      n8nWebhookUrl: data.EXPO_PUBLIC_N8N_WEBHOOK_URL,
    },
  };
}

const result = readEnv();

/** Human-readable problems with .env, or null when the config is valid. */
export function getConfigProblems(): string[] | null {
  return result.ok ? null : result.problems;
}

export function getEnv(): Env {
  if (!result.ok) {
    throw new AppError('config', `App configuration is incomplete: ${result.problems.join('; ')}`);
  }
  return result.env;
}
