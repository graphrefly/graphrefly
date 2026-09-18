import {readFileSync,writeFileSync,readdirSync,existsSync} from 'node:fs';
import {resolve,join,relative,dirname} from 'node:path';
import {gzipSync} from 'node:zlib';
import {captureCompiler,digest,openFrozenCompiler} from '../../../../../../scripts/b121-comparison/frozen-compiler.mjs';
const root=resolve(new URL('../../../../../../',import.meta.url).pathname),tsRoot=resolve(root,'../graphrefly-ts');
const base=resolve(new URL('../',import.meta.url).pathname);
const files={},excluded=[];
function walk(dir){for(const e of readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const path=join(dir,e.name),rel=relative(tsRoot,path);if(['__tests__','__bench__','node_modules'].includes(e.name)||/\.(test|spec)\.ts$/.test(e.name)){excluded.push(rel);continue;}if(e.isDirectory())walk(path);else if(e.name.endsWith('.ts')||e.name==='README.md')files[rel]=readFileSync(path,'utf8');}}
walk(join(tsRoot,'packages/ts/src'));
for(const f of ['packages/ts/README.md','packages/ts/package.json'])files[f]=readFileSync(join(tsRoot,f),'utf8');
const pkg=JSON.parse(files['packages/ts/package.json']),packageAliases={},resourceExports={};
for(const [name,entry] of Object.entries(pkg.exports)){if(typeof entry==="string"){const path="packages/ts/"+entry.slice(2);files[path]=readFileSync(join(tsRoot,path),"utf8");resourceExports[pkg.name+name.slice(1)]=path;continue;}const type=entry.import.types;const path='packages/ts/'+type.replace(/^\.\/dist\//,'src/').replace(/\.d\.ts$/,'.ts');if(!Object.hasOwn(files,path))throw Error('missing public export source '+path);packageAliases[pkg.name+(name==='.'?'':name.slice(1))]=path;}
const materialsJSON=JSON.stringify({entrypoint:'packages/ts/README.md',files,packageAliases},null,2)+'\n';
writeFileSync(join(base,'materials.json'),materialsJSON,{flag:'wx'});
const env=captureCompiler({tsRoot,materialsJSON,snippetLocation:'consumer/__b121_entry_validation__.ts'});
writeFileSync(join(base,'compiler-environment.json.gz'),gzipSync(env),{flag:'wx'});
const compiler=openFrozenCompiler(env,digest(env));
const probe=Object.keys(packageAliases).map((key,i)=>`import * as p${i} from ${JSON.stringify(key)}; export type P${i} = typeof p${i};`).join('\n');
const compilation=compiler.compile(probe);
const links=[...files['packages/ts/README.md'].matchAll(/\]\(([^)]+)\)/g)].map(m=>m[1]).filter(p=>!/^https?:|^#/.test(p)).map(p=>({path:p,resolved:relative(tsRoot,resolve(tsRoot,'packages/ts',p.split('#')[0])),included:Object.hasOwn(files,relative(tsRoot,resolve(tsRoot,'packages/ts',p.split('#')[0])))}));
const report={kind:'uniform-public-package-material',generationCalls:0,sourceRoot:tsRoot,entrypoint:'packages/ts/README.md',snippetLocation:'consumer/__b121_entry_validation__.ts',policy:'All current production package source TS and src README files, package README and package.json; exclude __tests__/__bench__ and *.test/spec.ts. All exports mapped uniformly to source, no task-specific inclusion.',files:Object.entries(files).map(([path,text])=>({path,sha256:digest(text),bytes:Buffer.byteLength(text)})),fileCount:Object.keys(files).length,bytes:Buffer.byteLength(materialsJSON),publicAliases:packageAliases,resourceExports,exportCount:Object.keys(pkg.exports).length,typescriptExportCount:Object.keys(packageAliases).length,excluded,packageReadmeLinks:links,knownBoundary:'Normal package README + source navigation; linked sibling examples/website are not included, no network or executable examples. No package installation, bundler/runtime execution, human or cross-language claim.',materialSHA256:digest(materialsJSON),environmentSHA256:digest(env),publicImportCompilation:compilation,probe};
writeFileSync(join(base,'offline/material-audit.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({fileCount:report.fileCount,bytes:report.bytes,exports:report.exportCount,ok:compilation.ok,diagnostics:compilation.diagnostics,missingDocLinks:links.filter(l=>!l.included)}));if(!compilation.ok)process.exitCode=1;
