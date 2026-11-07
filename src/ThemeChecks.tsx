import { useEffect, useState } from 'react';

export function ThemeChecks({ theme, account }: { theme: string; account: string }) {
  const storageKey = `weather-study-theme-checks:v1:${account}:${theme}`;
  function read(): boolean[] {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
      return [0, 1, 2].map(index => Array.isArray(saved) && saved[index] === true);
    } catch { return [false, false, false]; }
  }
  const [checks, setChecks] = useState(read);
  const [error, setError] = useState('');
  useEffect(() => {
    function sync(event: StorageEvent) {
      if (event.key === storageKey || event.key === null) setChecks(read());
    }
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [storageKey]);
  function toggle(index: number, checked: boolean) {
    const next = checks.map((value, i) => i === index ? checked : value);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      setChecks(next);
      setError('');
    } catch { setError('チェックを保存できませんでした。'); }
  }
  return <div className="theme-check-area"><div className="theme-checks" role="group" aria-label={`${theme}のチェック`}>
    {checks.map((checked, index) => <label key={index} className="theme-check"><input type="checkbox" checked={checked} aria-label={`${theme} チェック${index + 1}`} onChange={event => toggle(index, event.target.checked)}/></label>)}
  </div>{error && <span className="theme-check-error" role="alert">{error}</span>}</div>;
}
