-- 新規の専用Supabaseプロジェクトで一度実行する。既存テーブルの削除・置換は行わない。
begin;
create table public.questions (
  id text primary key,
  version integer not null default 1 check (version > 0),
  content jsonb not null,
  created_at timestamptz not null default now()
);
create table public.study_progress (
  user_id uuid not null references auth.users(id),
  question_id text not null references public.questions(id),
  status text not null default 'unanswered' check(status in ('unanswered','correct','review','mastered')),
  streak integer not null default 0,
  answers integer not null default 0,
  wrong integer not null default 0,
  last_answered_at timestamptz,
  primary key(user_id, question_id)
);
create table public.answer_events (
  user_id uuid not null references auth.users(id),
  id uuid not null,
  question_id text not null references public.questions(id),
  question_version integer not null,
  correct boolean not null,
  answered_at timestamptz not null,
  received_at timestamptz not null default now(),
  server_order bigint generated always as identity unique,
  question_sequence integer not null,
  primary key(user_id,id),
  unique(user_id,question_id,question_sequence)
);
create index answer_events_user_order on public.answer_events(user_id,server_order);
alter table public.questions enable row level security;
alter table public.study_progress enable row level security;
alter table public.answer_events enable row level security;
-- 現段階の20問は全ログイン利用者共通のサンプル教材。変更権限はブラウザに付与しない。
create policy questions_read on public.questions for select to authenticated using (true);
create policy own_progress on public.study_progress for select to authenticated using ((select auth.uid())=user_id);
create policy own_events on public.answer_events for select to authenticated using ((select auth.uid())=user_id);
revoke all on public.questions, public.study_progress, public.answer_events from anon, authenticated;
grant select on public.questions, public.study_progress, public.answer_events to authenticated;
create function public.record_answer(p_id uuid, p_question_id text, p_correct boolean, p_answered_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  prior public.study_progress%rowtype;
  existing public.answer_events%rowtype;
  ver integer;
  next_streak integer;
  next_status text;
begin
  if uid is null then raise exception 'ログインが必要です'; end if;
  if p_correct is null or p_answered_at is null or p_id is null then raise exception '回答データが不正です'; end if;
  -- 同一UUIDへの異なる内容の再利用も拒否する。同一ユーザーのイベントIDを直列化。
  perform pg_advisory_xact_lock(hashtextextended(uid::text || p_id::text, 0));
  select * into existing from public.answer_events where user_id=uid and id=p_id;
  if found then
    if existing.question_id<>p_question_id or existing.correct<>p_correct or existing.answered_at<>p_answered_at then
      raise exception '回答IDが別の内容に使われています';
    end if;
    return;
  end if;
  select version into ver from public.questions where id=p_question_id;
  if not found then raise exception '問題がクラウドに登録されていません'; end if;
  insert into public.study_progress(user_id,question_id) values(uid,p_question_id) on conflict do nothing;
  select * into prior from public.study_progress where user_id=uid and question_id=p_question_id for update;
  next_streak := case when p_correct then prior.streak+1 else 0 end;
  next_status := case when not p_correct then 'review'
    when prior.status='review' then case when next_streak>=2 then 'mastered' else 'review' end
    when prior.status='mastered' then 'mastered' else 'correct' end;
  insert into public.answer_events(user_id,id,question_id,question_version,correct,answered_at,question_sequence)
    values(uid,p_id,p_question_id,ver,p_correct,p_answered_at,prior.answers+1);
  update public.study_progress set status=next_status, streak=next_streak, answers=prior.answers+1,
    wrong=prior.wrong+case when p_correct then 0 else 1 end, last_answered_at=p_answered_at
    where user_id=uid and question_id=p_question_id;
end;
$$;
revoke all on function public.record_answer(uuid,text,boolean,timestamptz) from public, anon;
grant execute on function public.record_answer(uuid,text,boolean,timestamptz) to authenticated;
alter publication supabase_realtime add table public.answer_events;
commit;
