export function isPublicKey(value: string) {
  if (value.startsWith('sb_publishable_')) return true;
  try {
    return JSON.parse(atob(value.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role === 'anon';
  } catch { return false; }
}
export function validateConfig(url?: string, key?: string) {
  if (!url && !key) return '';
  return !url || !key || !/^https:\/\/[^/]+\/?$/.test(url) || !isPublicKey(key)
    ? 'Supabase設定が不正です。HTTPSのProject URLとpublishable（またはanon）キーを設定してください。secret・service_roleキーは使用できません。'
    : '';
}
