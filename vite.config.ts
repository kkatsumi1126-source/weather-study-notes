import { defineConfig, loadEnv } from 'vite';
import { validateConfig } from './src/configValidation';
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_');
  const error = validateConfig(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);
  // Reject secret keys before Vite can inline them into browser assets.
  if (error) throw new Error(error);
  return { base: './' };
});
