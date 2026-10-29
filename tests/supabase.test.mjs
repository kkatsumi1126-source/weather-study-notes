import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
const uid='10000000-0000-4000-8000-000000000001';
const other='10000000-0000-4000-8000-000000000002';
test('PostgreSQL: RPCの遷移・再送・RLS・直接書換拒否',async()=>{
 const db=new PGlite();
 try {
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create table auth.users(id uuid primary key);insert into auth.users values('${uid}'),('${other}');
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema public,auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
 const sql=readFileSync(new URL('../supabase/migrations/001_study_sync.sql',import.meta.url),'utf8');
 // Publication delivery is an external Supabase integration, not provided by this embedded engine.
 await db.exec(sql.replace('alter publication supabase_realtime add table public.answer_events;',''));
 await db.exec(readFileSync(new URL('../supabase/seed.sql',import.meta.url),'utf8'));
 await db.exec(readFileSync(new URL('../supabase/seed.sql',import.meta.url),'utf8'));
 assert.equal((await db.query('select count(*)::int n from public.questions')).rows[0].n,20);
 await db.exec(`set role authenticated;set request.jwt.claim.sub='${uid}';`);
 const answer=async(n,correct)=>db.query('select public.record_answer($1,$2,$3,$4)',[`20000000-0000-4000-8000-${String(n).padStart(12,'0')}`,'demo-001',correct,`2026-10-28T12:00:0${n}Z`]);
 await answer(1,false);await answer(2,true);
 assert.equal((await db.query('select status from public.study_progress')).rows[0].status,'review');
 await answer(3,true);await answer(3,true);
 let p=(await db.query('select * from public.study_progress')).rows[0];
 assert.equal(p.status,'mastered');assert.equal(p.answers,3);assert.equal(p.streak,2);
 await assert.rejects(()=>answer(3,false));
 await answer(4,false);
 p=(await db.query('select * from public.study_progress')).rows[0];
 assert.equal(p.status,'review');assert.equal(p.streak,0);assert.equal(p.wrong,2);
 assert.equal((await db.query('select count(*)::int n from public.answer_events')).rows[0].n,4);
 await assert.rejects(()=>db.query("update public.study_progress set status='mastered'"));
 await assert.rejects(()=>db.query('delete from public.answer_events'));
 await assert.rejects(()=>db.query("insert into public.questions(id,content) values ('bad','{}')"));
 await db.exec(`set request.jwt.claim.sub='${other}';`);
 assert.equal((await db.query('select * from public.answer_events')).rows.length,0);
 assert.equal((await db.query('select * from public.study_progress')).rows.length,0);
 await answer(1,true);
 assert.equal((await db.query('select * from public.answer_events')).rows.length,1);
 await db.exec('reset role;set role anon;');
 await assert.rejects(()=>db.query('select * from public.answer_events'));
 await assert.rejects(()=>answer(5,true));
 }finally{await db.close();}
});
