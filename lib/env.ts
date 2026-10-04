import { z } from 'zod';

import { AppError } from './errors';

const schema = z.object({
  EXPO_PUBLIC_SUPABASE_URL: z.url({ error: 'must be your Supabase project URL' }),
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string({ error: 'is missing' }).min(1, 'is missing'),
});

export type Env = {
  supabaseUrl: string;
  supabasePublishableKey: string;
};

type EnvResult = { ok: true; env: Env } | { ok: false; problems: string[] };

function readEnv(): EnvResult {
  // Expo only inlines EXPO_PUBLIC_* when each one is accessed literally.
  const parsed = schema.safeParse({
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });

  if (!parsed.success) {
    return {
      ok: false,
      problems: parsed.error.issues.map((issue) => `${issue.path.join('.')} ${issue.message}`),
    };
  }

  return {
    ok: true,
    env: {
      supabaseUrl: parsed.data.EXPO_PUBLIC_SUPABASE_URL,
      supabasePublishableKey: parsed.data.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
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
