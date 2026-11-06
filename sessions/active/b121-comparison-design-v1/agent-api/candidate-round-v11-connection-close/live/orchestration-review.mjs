import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {join} from 'node:path';
import {openCandidateRound} from '/Users/davidchenallio/src/graphrefly/scripts/b121-comparison/candidate-entry.mjs';
const base='/Users/davidchenallio/src/graphrefly/sessions/active/b121-comparison-design-v1/agent-api/candidate-round-v11-connection-close',live=join(base,'live');
const read=p=>JSON.parse(readFileSync(p));
const save=(p,x)=>writeFileSync(p,JSON.stringify(x,null,2)+'\n',{flag:'wx'});
const outcome=read(join(live,'outcome.json'));
const round=openCandidateRound({materialsJSON:readFileSync(join(base,'materials.json'),'utf8'),tasksJSON:readFileSync(join(base,'tasks.json'),'utf8'),rubricJSON:readFileSync(join(base,'reviewer-rubric.json'),'utf8'),environmentJSON:gunzipSync(readFileSync(join(base,'compiler-environment.json.gz'))).toString(),pins:read(join(base,'integration-pins.json')),receiptRoot:join(live,'review-compiler')});
const rows=[];
for(let i=1;i<=4;i++){
 const id='candidate-entry-'+String(i).padStart(2,'0'),aPath=join(outcome.directory,id+'.assessment.json');
 if(!existsSync(aPath)){rows.push({...outcome.summary.rows.find(r=>r.sampleId===id),accepted:false,submitted:false,reviewArtifact:null});continue;}
 const a=read(aPath);
 if(!a.assessment.result.entryAnswer){rows.push({sampleId:id,taskId:a.assessment.taskId,status:a.assessment.status,accepted:false,submitted:false,reviewArtifact:null});continue;}
 const review=read('/tmp/b121-v11/'+id+'.review-input.json');
 const result=await round.review({...a,review});
 save(join(live,id+'.review-input.json'),review);save(join(live,id+'.review-verified.json'),result);
 rows.push({sampleId:id,taskId:a.assessment.taskId,status:result.status,accepted:result.accepted,submitted:true,reviewArtifact:id+'.review-verified.json'});
}
save(join(live,'review-verified-summary.json'),{denominator:4,accepted:rows.filter(r=>r.accepted).length,submitted:rows.filter(r=>r.submitted).length,incomplete:rows.filter(r=>r.status==='incomplete').length,notRun:rows.filter(r=>r.status==='not-run').length,formalReady:false,runtimeBehaviorVerified:false,interpretation:'Development coverage revision; static frozen compilation plus v6 criteria; not an unseen holdout or runtime behavior verification',rows});
console.log(JSON.stringify(rows));
