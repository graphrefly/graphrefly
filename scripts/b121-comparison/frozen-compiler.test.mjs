import assert from 'node:assert/strict';
import test from 'node:test';
import {captureCompiler,digest,openFrozenCompiler} from './frozen-compiler.mjs';
const tsRoot=new URL('../../../graphrefly-ts/',import.meta.url).pathname;
function capture(packageAliases){return captureCompiler({tsRoot,snippetLocation:'consumer/main.ts',materialsJSON:JSON.stringify({files:{'packages/ts/src/index.ts':'export const rootValue: number = 2;', 'packages/ts/src/data/index.ts':'export interface Fact { value: string }'},packageAliases})});}
test('frozen compiler resolves public root and nested package aliases with actual consumer typechecking',()=>{
 const env=capture({'@graphrefly/ts':'packages/ts/src/index.ts','@graphrefly/ts/data':'packages/ts/src/data/index.ts'});
 const compiler=openFrozenCompiler(env,digest(env));
 assert.equal(compiler.compile('import {rootValue} from "@graphrefly/ts"; import type {Fact} from "@graphrefly/ts/data"; export const value: Fact = {value: String(rootValue)};').ok,true);
 assert.equal(compiler.compile('import {rootValue} from "@graphrefly/ts"; export const value: string = rootValue;').ok,false);
});
test('public aliases reject malformed names, escaping targets and absent material',()=>{
 for(const name of ['@graphrefly/ts/','@graphrefly/ts//data','@graphrefly/ts/../data'])assert.throws(()=>capture({[name]:'packages/ts/src/index.ts'}),/invalid frozen package alias/);
 for(const path of ['../secret.ts','/tmp/secret.ts','packages/ts/src/missing.ts'])assert.throws(()=>capture({'@graphrefly/ts':path}),/invalid frozen package alias/);
});
