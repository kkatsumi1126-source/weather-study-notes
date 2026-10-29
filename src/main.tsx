import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useStudy } from './useStudy';
import { AccountPanel } from './AccountPanel';
import { supabase } from './supabase';
import './style.css';
import { QuestionContent } from './QuestionContent';
import { emptyProgress, summarize, type AnswerEvent, type Status } from './study';

const labels = { unanswered: '未回答', correct: '正解', review: '間違い・復習対象', mastered: '習得済み' };
const date = (value: string | null) => value ? new Date(value).toLocaleString('ja-JP') : '未回答';

function App() {
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [search, setSearch] = useState('');
  const [field, setField] = useState('すべて');
  const [exam, setExam] = useState('すべて');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const study = useStudy();
  const {events,ready,questions} = study;
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const pending = useRef<AnswerEvent | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [view, setView] = useState<'all' | Status>('all');
  const [sort, setSort] = useState('number');
  const progress = useMemo(() => summarize(events), [events]);
  const getProgress = (id: string) => progress[id] ?? emptyProgress();
  useEffect(()=>{pending.current=null;setMessage('');setError('');},[study.session?.user.id]);
  const topicName = (q: typeof questions[number]) => q.theme?.trim() || q.field || 'その他';
  const themes = useMemo(() => {
    const grouped = new Map<string, typeof questions>();
    for (const question of questions) {
      const name = topicName(question);
      grouped.set(name, [...(grouped.get(name) ?? []), question]);
    }
    return [...grouped].map(([name, items]) => ({ name, items })).sort((a,b) => a.name.localeCompare(b.name, 'ja', { numeric: true }));
  }, [questions]);
  const scopedQuestions = useMemo(() => selectedTheme === null ? questions : questions.filter(q => topicName(q) === selectedTheme), [questions, selectedTheme]);
  const inLibrary = showAll || selectedTheme !== null;
  function resetList() { setSearch(''); setField('すべて'); setExam('すべて'); setView('all'); setSort('number'); setPage(1); setOpen(new Set()); }
  function enterTheme(name: string | null, targetView: 'all' | Status = 'all') {
    resetList(); setSelectedTheme(name); setShowAll(name === null); setView(targetView);
  }
  function returnToThemes() { resetList(); setSelectedTheme(null); setShowAll(false); }
  const refresh = study.retry;
  async function record(questionId: string, correct: boolean) {
    if (lock.current || !ready) return;
    lock.current = true; setBusy(true); setMessage(''); setError('');
    const event = pending.current ?? { id: crypto.randomUUID(), questionId, correct, answeredAt: new Date().toISOString() };
    pending.current = event;
    try {
      await study.save(event);
      pending.current = null;
      setMessage(`問題 ${questions.find(q => q.id === event.questionId)?.number}：${event.correct ? '正解' : '間違い'}を保存しました。`);
      const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('weather-study-notes') : null;
      channel?.postMessage('updated'); channel?.close();
    } catch { setError('保存または再読み込みに失敗しました。再試行してください。保存が完了するまでこのページを閉じないでください。'); }
    finally { lock.current = false; setBusy(false); }
  }
  const filtered = useMemo(() => {
    const result = scopedQuestions.filter(q => (view === 'all' || (progress[q.id]?.status ?? 'unanswered') === view) && (field === 'すべて' || q.field === field) && (exam === 'すべて' || q.examType === exam) && [q.question,q.answer,...Object.values(q.explanation),q.memorize,q.field,q.theme,q.originalExplanation].join(' ').includes(search.trim()));
    return result.sort((a,b) => sort === 'wrong' ? (progress[b.id]?.wrong ?? 0) - (progress[a.id]?.wrong ?? 0) || a.number-b.number : sort === 'oldest' || sort === 'latest' ? ((Date.parse(progress[a.id]?.lastAnsweredAt ?? '') || 0) - (Date.parse(progress[b.id]?.lastAnsweredAt ?? '') || 0)) * (sort === 'latest' ? -1 : 1) || a.number-b.number : a.number-b.number);
  }, [search,field,exam,view,sort,progress,scopedQuestions]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / 20));
  const currentPage = Math.min(page, pageCount);
  const shown = filtered.slice((currentPage-1)*20,currentPage*20);
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page,pageCount]);
  const allOpen = shown.length > 0 && shown.every(q => open.has(q.id));
  function toggle(id: string) { setOpen(old => {const next = new Set(old); next.has(id) ? next.delete(id) : next.add(id); return next;}); }
  function changeFilter(fn: () => void) {fn();setPage(1);}
  function expandAll() {setOpen(old => {const next = new Set(old); shown.forEach(q => allOpen ? next.delete(q.id) : next.add(q.id));return next;});}
  return <><header><div className="header-inner"><a className="brand" href="#" onClick={returnToThemes}><span className="logo" aria-hidden="true">☁</span><span>気象予報士<span className="brand-sub">AI問題・解説集</span></span></a><span className="version">試作版 04</span></div></header>
  <main><section className="intro"><p className="eyebrow">WEATHER STUDY NOTE</p><h1>ひとつずつ、<br className="mobile-break"/>理解を確かに。</h1><p className="lead">問題を読んで、答えを考えてから解説へ。<br/>自分のペースで積み重ねる、気象の学習ノート。</p><div className="notice"><span aria-hidden="true">ⓘ</span><span>ログインすると履歴をクラウドへ同期します。通信障害時は端末内に保存し、復帰時に再送します。未送信のままサイトデータを削除しないでください。</span></div></section>
  <AccountPanel session={study.session} authReady={study.authReady} pending={study.pending} syncing={study.syncing} error={study.error} retry={study.retry} importLocal={study.importLocal}/>
  {!inLibrary ? <section className="workspace" aria-label="テーマ一覧">
    <div className="section-title"><div><p className="eyebrow">STUDY THEMES</p><h2>テーマから学ぶ <span className="count">{themes.length}テーマ</span></h2></div></div>
    <p className="theme-lead">学びたいテーマを選んで、問題へ進みましょう。</p>
    <div className="theme-shortcuts"><button onClick={() => enterTheme(null)}>全テーマの問題を見る（{questions.length}問）</button><button onClick={() => enterTheme(null, 'review')}>全テーマの間違い復習（{questions.filter(q => getProgress(q.id).status === 'review').length}問）</button></div>
    <div className="theme-grid">{themes.map(({name,items}) => <button className="theme-card" key={name} onClick={() => enterTheme(name)}><span className="theme-card-title">{name}<span aria-hidden="true">→</span></span><span className="theme-total">{items.length}問</span><span className="theme-progress">未回答 {items.filter(q => getProgress(q.id).status === 'unanswered').length} ／ 復習 {items.filter(q => getProgress(q.id).status === 'review').length} ／ 習得 {items.filter(q => getProgress(q.id).status === 'mastered').length}</span><span className="theme-enter">このテーマの問題へ</span></button>)}</div>
    {!themes.length && <p>登録されているテーマはありません。</p>}
  </section> : <section className="workspace" aria-label="問題一覧"><button className="back-to-themes" onClick={returnToThemes}>← テーマ一覧に戻る</button><div className="section-title"><div><p className="eyebrow">QUESTION LIBRARY</p><h2>{selectedTheme ?? '全テーマの問題'} <span className="count">{scopedQuestions.length}問</span></h2></div></div>
  <div className="study-tabs" aria-label="学習対象">{([['all','全問題'],['unanswered','未回答'],['review','間違い復習'],['mastered','習得済み']] as const).map(([key,label])=><button key={key} aria-pressed={view===key} onClick={()=>changeFilter(()=>setView(key))}>{label} <strong>{scopedQuestions.filter(q=>key==='all'||getProgress(q.id).status===key).length}</strong></button>)}</div>
  <p className="study-rule">復習対象は2回連続正解で習得済み。途中で間違えると連続正解は0に戻ります。</p>
  <div role="status" className="save-status">{!ready && !error ? (supabase && !study.session ? '記録するにはログインしてください。' : '履歴を読み込み中…') : busy ? '保存中…' : message}</div>
  {error && <div role="alert" className="save-error">{error}<button disabled={busy} onClick={()=>pending.current ? void record(pending.current.questionId,pending.current.correct) : void refresh()}>再試行</button></div>}
  <div className="filters"><label className="search-label"><span>キーワード検索</span><input type="search" value={search} placeholder="例：500hPa、暖気移流" onChange={e=>changeFilter(()=>setSearch(e.target.value))}/></label><label><span>気象分野</span><select value={field} onChange={e=>changeFilter(()=>setField(e.target.value))}><option>すべて</option>{Array.from(new Set(scopedQuestions.map(q=>q.field))).map(f=><option key={f}>{f}</option>)}</select></label><label><span>試験区分</span><select value={exam} onChange={e=>changeFilter(()=>setExam(e.target.value))}>{['すべて','学科一般','学科専門','実技'].map(x=><option key={x}>{x}</option>)}</select></label></div>
  <label className="sort-label">並び順 <select value={sort} onChange={e=>changeFilter(()=>setSort(e.target.value))}><option value="number">問題番号順</option><option value="wrong">間違い回数が多い順</option><option value="oldest">最終回答が古い順（未回答が先）</option><option value="latest">最終回答が新しい順</option></select></label>
  <div className="list-toolbar"><span>該当 <strong>{filtered.length}</strong> 問 <span className="muted">／ 1ページ20問</span></span><button onClick={expandAll} disabled={!shown.length} className="text-button">{allOpen?'このページをすべて閉じる −':'このページをすべて開く ＋'}</button></div>
  {shown.length === 0 && <div className="empty"><h3>条件に合う問題はありません</h3><p>キーワードや絞り込み条件を変更してください。</p><button onClick={()=>{setSearch('');setField('すべて');setExam('すべて');setView('all');setPage(1);}}>絞り込みを解除</button></div>}
  <div className="question-list">{shown.map(q=><article key={q.id} className={open.has(q.id)?'question-card expanded':'question-card'}><div className="metadata"><span className="question-number">問題 {String(q.number).padStart(3,'0')}</span><span className="tag">{q.examType}</span><span>{q.field}</span>{q.importance==='最重要' && <span className="important-tag">最重要</span>}<span className={`study-state ${getProgress(q.id).status}`}>{labels[getProgress(q.id).status]}</span></div><h3>{q.question}</h3><button className="disclosure" aria-expanded={open.has(q.id)} aria-controls={`answer-${q.id}`} onClick={()=>toggle(q.id)}>{open.has(q.id)?'回答・解説を閉じる':'回答・解説を見る'}<span aria-hidden="true">{open.has(q.id)?'−':'＋'}</span></button>
  {open.has(q.id)&&<div className="answer-panel" id={`answer-${q.id}`}><QuestionContent question={q}/><div className="answer-actions"><button className="correct-button" disabled={!ready||busy||!!pending.current} onClick={()=>void record(q.id,true)}>正解</button><button className="wrong-button" disabled={!ready||busy||!!pending.current} onClick={()=>void record(q.id,false)}>間違い</button></div><p className="progress-detail">回答 {getProgress(q.id).answers}回 ／ 間違い {getProgress(q.id).wrong}回 ／ 連続正解 {getProgress(q.id).streak}回<br/>最終回答：{date(getProgress(q.id).lastAnsweredAt)}</p><details className="history"><summary>回答履歴を見る</summary>{events.filter(e=>e.questionId===q.id).length ? <ol>{events.filter(e=>e.questionId===q.id).slice().reverse().map(e=><li key={e.id}>{date(e.answeredAt)} · {e.correct?'正解':'間違い'}</li>)}</ol> : <p>まだ回答していません。</p>}</details></div>}</article>)}</div>
  <nav className="pagination" aria-label="ページ切り替え"><button disabled={currentPage===1} onClick={()=>{setPage(p=>p-1);setOpen(new Set());}}>前へ</button><span>{currentPage} / {pageCount} ページ</span><button disabled={currentPage>=pageCount} onClick={()=>{setPage(p=>p+1);setOpen(new Set());}}>次へ</button></nav></section>}<footer>気象予報士 AI問題・解説集<span>{supabase ? '試作版 · ログインでクラウド同期' : '試作版 · このブラウザに履歴を保存'}</span></footer></main></>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
