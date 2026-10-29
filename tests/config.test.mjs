import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
const source=ts.transpileModule(readFileSync(new URL('../src/configValidation.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {validateConfig}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
test('公開用キーだけ許可し、秘密鍵・片方のみ設定・HTTP接続を拒否',()=>{
 const jwt=role=>`x.${Buffer.from(JSON.stringify({role})).toString('base64url')}.y`;
 assert.equal(validateConfig(), '');
 assert.equal(validateConfig('https://test.supabase.co','sb_publishable_test'),'');
 assert.equal(validateConfig('https://test.supabase.co',jwt('anon')),'');
 assert.ok(validateConfig('https://test.supabase.co',jwt('service_role')));
 assert.ok(validateConfig('https://test.supabase.co','sb_secret_test'));
 assert.ok(validateConfig('https://test.supabase.co'));
 assert.ok(validateConfig('http://test.supabase.co','sb_publishable_test'));
});
