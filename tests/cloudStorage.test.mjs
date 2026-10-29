import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
const source=ts.transpileModule(readFileSync(new URL('../src/cloudStorage.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {readCache,editCache,enqueue,reconcile,visibleEvents}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const event=n=>({id:`e${n}`,questionId:'demo-001',correct:n%2===0,answeredAt:'2026-10-28T00:00:00Z'});
test('送信待ちは再読込相当のDB再取得でも保持しアカウントを分離',async()=>{
 await editCache('a',old=>enqueue(old,event(1)));
 assert.equal((await readCache('a')).pending.length,1);assert.equal((await readCache('b')).pending.length,0);
});
test('並行追加でもキューを欠落させず同じIDは二重登録しない',async()=>{
 await Promise.all([1,2,3,4,5].map(n=>editCache('concurrent',old=>enqueue(old,event(n)))));
 await editCache('concurrent',old=>enqueue(old,event(1)));
 assert.equal((await readCache('concurrent')).pending.length,5);
});
test('確認取得成功分のみキューから除去し、未送信分と途中追加を保持',async()=>{
 await editCache('reconcile',old=>[1,2,3].reduce((c,n)=>enqueue(c,event(n)),old));
 const cache=await editCache('reconcile',old=>reconcile(old,[event(2),event(1)]));
 assert.deepEqual(cache.pending.map(e=>e.id),['e3']);
 assert.deepEqual(visibleEvents(cache).map(e=>e.id),['e2','e1','e3']);
 await editCache('reconcile',old=>enqueue(old,event(4)));
 const retry=await editCache('reconcile',old=>reconcile(old,[event(2),event(1),event(3)]));
 assert.deepEqual(retry.pending.map(e=>e.id),['e4']);
});
test('別タブの古い取得結果が後から届いても確定履歴を失わない',()=>{
 const first={...event(1),serverOrder:1};const second={...event(2),serverOrder:2};
 const cache={confirmed:[first,second],pending:[]};
 assert.deepEqual(reconcile(cache,[first]).confirmed,[first,second]);
 const ordered=reconcile({confirmed:[second],pending:[first]},[first]);
 assert.deepEqual(ordered.confirmed,[first,second]);assert.equal(ordered.pending.length,0);
});
