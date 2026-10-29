import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
const source = ts.transpileModule(readFileSync(new URL('../src/study.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { summarize } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const event = (correct, n, questionId = 'q1') => ({ id: `e${n}`, questionId, correct, answeredAt: new Date(2026, 9, 28, 12, n).toISOString() });
const result = (...answers) => summarize(answers.map((correct,n)=>event(correct,n))).q1;
test('通常の連続正解だけでは習得済みにしない',()=>assert.equal(result(true,true,true).status,'correct'));
test('初回の間違いは復習対象、1回正解では残り2回で習得',()=>{
  assert.equal(result(false).status,'review');
  assert.equal(result(false,true).status,'review');
  assert.equal(result(false,true).streak,1);
  assert.equal(result(false,true,true).status,'mastered');
});
test('途中の間違いで連続正解をリセット',()=>{
  const p=result(false,true,false,true);
  assert.equal(p.status,'review');assert.equal(p.streak,1);assert.equal(p.wrong,2);assert.equal(p.answers,4);
});
test('習得後の再間違いで復習に戻り再度2回必要',()=>{
  assert.equal(result(false,true,true,false).streak,0);
  assert.equal(result(false,true,true,false,true).status,'review');
  assert.equal(result(false,true,true,false,true,true).status,'mastered');
});
test('同じイベントの再送で二重計上しない',()=>{
  const e=event(false,1);assert.equal(summarize([e,e]).q1.answers,1);
});
test('履歴のJSON往復で日時・全履歴・集計を保持、問題ごとに独立',()=>{
  const events=[event(false,0),event(true,1,'q2'),event(true,2),event(true,3)];
  const restored=JSON.parse(JSON.stringify(events));
  assert.deepEqual(summarize(restored),summarize(events));
  assert.equal(restored.length,4);assert.equal(summarize(restored).q1.lastAnsweredAt,events[3].answeredAt);
  assert.equal(summarize(restored).q2.status,'correct');
});
