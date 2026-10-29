import { createClient } from '@supabase/supabase-js';
import { validateConfig } from './configValidation';
const env = (import.meta as ImportMeta & { env: Record<string, string | undefined> }).env;
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const configError = validateConfig(url, key);
const timedFetch: typeof fetch = async (input, init) => {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (init?.signal?.aborted) controller.abort();
  init?.signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 15000);
  try { return await fetch(input, { ...init, signal: controller.signal }); }
  finally { clearTimeout(timer); init?.signal?.removeEventListener('abort', abort); }
};
export const supabase = url && key && !configError ? createClient(url, key, {
  global: { fetch: timedFetch },
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
}) : null;
// Capture the token so switching accounts during an in-flight request cannot send another account's queue.
export function forToken(token: string) {
  return createClient(url!, key!, { global: { fetch: timedFetch }, accessToken: async () => token });
}
export function errorMessage(error: unknown): string {
  return typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : String(error);
}
