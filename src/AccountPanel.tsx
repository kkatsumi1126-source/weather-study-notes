import { useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, configError, errorMessage } from './supabase';
export function AccountPanel({session,authReady,pending,syncing,error,retry,importLocal}:{session:Session|null;authReady:boolean;pending:number;syncing:boolean;error:string;retry:()=>Promise<void>;importLocal:()=>Promise<void>}){
  const [email,setEmail]=useState('');const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);
  async function login(e:React.FormEvent){
    e.preventDefault();if(!supabase)return;setBusy(true);setMessage('');
    try{const {error}=await supabase.auth.signInWithOtp({email,options:{emailRedirectTo:new URL('./',window.location.href).href}});if(error)throw error;setMessage('ログイン用メールを送りました。この端末のブラウザでリンクを開いてください。');}
    catch(e){setMessage(`ログインできませんでした：${errorMessage(e)}`);}finally{setBusy(false);}
  }
  async function logout(){setBusy(true);try{const {error}=await supabase!.auth.signOut({scope:'local'});if(error)throw error;setMessage('ログアウトしました。未送信分は同じアカウントへの再ログイン時に再送します。');}catch(e){setMessage(errorMessage(e));}finally{setBusy(false);}}
  return <section className="account-panel" aria-label="アカウントと同期"><h2>ログイン・同期</h2>{!supabase?<p>{configError || 'Supabase未設定：現在は端末内保存モードです。設定手順書に従って接続先と公開用キーを設定してください。'}</p>:!authReady?<p>ログイン状態を確認中…</p>:session?<><p>{session.user.email}</p><p role="status">{syncing?'同期中…':error?'同期の確認が必要です':pending?'端末内保存済み・送信待ち':'クラウドと同期済み'} ／ 未送信 {pending}件</p><p>未送信分を含む進捗は暫定です。クラウドの受付順で確定します。</p><div className="account-actions"><button onClick={()=>void retry()} disabled={syncing}>同期を再試行</button><button onClick={()=>void importLocal()} disabled={busy||syncing}>以前の端末内履歴をこのアカウントへ引き継ぐ</button><button onClick={()=>void logout()} disabled={busy}>ログアウト</button></div></>:<form onSubmit={login}><label>メールアドレス<input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label><button disabled={busy}>ログイン用メールを送る</button><p>同じメールアドレスでiPhone・Macそれぞれからログインしてください。</p></form>}{message&&<p role="status">{message}</p>}{error&&<p role="alert" className="save-error">{error}</p>}</section>;
}
