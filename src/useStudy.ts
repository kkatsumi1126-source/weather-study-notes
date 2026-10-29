import { useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import sampleQuestions from './questions.json';
import { supabase, forToken, errorMessage } from './supabase';
import { loadEvents, saveEvent } from './studyStorage';
import { editCache, enqueue, readCache, reconcile, visibleEvents, type CloudCache } from './cloudStorage';
import type { AnswerEvent } from './study';
import type { Question } from './question';
export function useStudy() {
  const [session,setSession]=useState<Session|null>(null);
  const [authReady,setAuthReady]=useState(!supabase);
  const [state,setState]=useState({owner:'',events:[] as AnswerEvent[],pending:0,ready:false});
  const [questions,setQuestions]=useState<Question[]>(sampleQuestions);
  const [error,setError]=useState('');
  const [syncing,setSyncing]=useState(false);
  const syncRef=useRef<()=>Promise<void>>(async()=>{});
  const userId=session?.user.id;
  const owner=supabase ? userId ?? 'signed-out' : 'local';
  const currentOwner=useRef(owner);currentOwner.current=owner;
  useEffect(()=>{
    if (!supabase) return;
    let active=true;
    const {data}=supabase.auth.onAuthStateChange((_event,next)=>{setSession(next);setAuthReady(true);});
    void supabase.auth.getSession().then(({data,error})=>{if(active){if(error)setError(error.message);setSession(data.session);setAuthReady(true);}});
    return ()=>{active=false;data.subscription.unsubscribe();};
  },[]);
  useEffect(()=>{
    let active=true;
    let running=false;
    let again=false;
    setError('');setSyncing(false);setQuestions(sampleQuestions);
    const publish=(cache:CloudCache)=>{if(active){setState({owner,events:visibleEvents(cache),pending:cache.pending.length,ready:!!cache.questions});if(cache.questions)setQuestions(cache.questions);}};
    const client=supabase;
    const sync=async()=>{
      if(running){again=true;return;}
      running=true;
      try {
        if (!client) {
          const events=await loadEvents();if(active)setState({owner,events,pending:0,ready:true});return;
        }
        if (!userId) {if(active)setState({owner,events:[],pending:0,ready:false});return;}
        publish(await readCache(userId));
        if(active)setSyncing(true);
        // Do not send a previous account's queue under a different authenticated session.
        const {data:auth,error:authError}=await client.auth.getSession();
        if(authError)throw authError;
        if(auth.session?.user.id!==userId || !active)return;
        const api=forToken(auth.session.access_token);
        const catalog=await api.from('questions').select('id,content').order('id').limit(1000);
        if(catalog.error)throw catalog.error;
        const cloudQuestions=(catalog.data ?? []).map(row=>({...row.content,id:row.id})) as Question[];
        if(!cloudQuestions.length)throw new Error('問題が未登録です。サンプル登録SQLを実行してください');
        publish(await editCache(userId,old=>({...old,questions:cloudQuestions}))); 
        const cache=await readCache(userId);
        for(const event of cache.pending){
          if(!active)return;
          const {data:current}=await client.auth.getSession();
          if(current.session?.user.id!==userId)return;
          const {error}=await api.rpc('record_answer',{p_id:event.id,p_question_id:event.questionId,p_correct:event.correct,p_answered_at:event.answeredAt});
          if(error)throw error;
        }
        const confirmed:AnswerEvent[]=[];
        for(let offset=0;;offset+=1000){
          const {data,error}=await api.from('answer_events').select('id,question_id,correct,answered_at,server_order').eq('user_id',userId).order('server_order').range(offset,offset+999);
          if(error)throw error;
          confirmed.push(...(data ?? []).map(row=>({id:row.id,questionId:row.question_id,correct:row.correct,answeredAt:row.answered_at,serverOrder:row.server_order})));
          if((data?.length ?? 0)<1000)break;
        }
        if(!active)return;
        publish(await editCache(userId,old=>reconcile(old,confirmed)));
        if(active)setError('');
      } catch(e) {if(active)setError(`同期・読み込みに失敗しました：${errorMessage(e)}。未送信の回答は端末内に保持されます。`);}
      finally {running=false;if(active){setSyncing(false);if(again){again=false;void sync();}}}
    };
    syncRef.current=sync;
    void sync();
    const reload=()=>{void sync();};
    const visible=()=>{if(document.visibilityState==='visible')reload();};
    const channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('weather-study-notes'):null;
    channel?.addEventListener('message',reload);
    window.addEventListener('focus',reload);window.addEventListener('online',reload);document.addEventListener('visibilitychange',visible);
    const timer=setInterval(reload,30000);
    const realtime=client && userId ? client.channel(`answers-${userId}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'answer_events',filter:`user_id=eq.${userId}`},reload).subscribe(status=>{
      if(active && (status==='CHANNEL_ERROR'||status==='TIMED_OUT'))setError('リアルタイム接続に失敗しました。30秒ごとの再取得と「同期を再試行」を利用できます。');
    }) : null;
    return ()=>{active=false;clearInterval(timer);channel?.close();window.removeEventListener('focus',reload);window.removeEventListener('online',reload);document.removeEventListener('visibilitychange',visible);if(realtime)void client!.removeChannel(realtime);};
  },[owner,userId,session?.access_token]);
  async function save(event:AnswerEvent){
    if(supabase){
      if(!userId)throw new Error('ログインしてください');
      const cache=await editCache(userId,old=>enqueue(old,event));
      if(currentOwner.current===owner)setState({owner,events:visibleEvents(cache),pending:cache.pending.length,ready:true});
    }else{await saveEvent(event);setState({owner,events:await loadEvents(),pending:0,ready:true});}
    const channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('weather-study-notes'):null;channel?.postMessage('updated');channel?.close();
    void syncRef.current();
  }
  async function importLocal(){
    if(!userId)return;
    try{
      const local=await loadEvents();
      const cache=await editCache(userId,old=>local.reduce(enqueue,old));
      setState({owner,events:visibleEvents(cache),pending:cache.pending.length,ready:true});
      void syncRef.current();
    }catch(e){setError(`端末履歴を引き継げませんでした：${String(e)}`);}
  }
  return { session,authReady,questions,events:state.owner===owner?state.events:[],ready:authReady && state.owner===owner && state.ready,pending:state.owner===owner?state.pending:0,error,syncing,save,retry:()=>syncRef.current(),importLocal };
}
