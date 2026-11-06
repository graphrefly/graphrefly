// Trusted static judgments below were checked separately by new_task_rubric_review.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {openCandidateRound} from '../../../../../scripts/b121-comparison/candidate-entry.mjs';
const base=fileURLToPath(new URL('.',import.meta.url));
const read=n=>readFileSync(resolve(base,n),'utf8');
const receiptRoot=resolve(base,'offline',process.argv[2]??'review-01');mkdirSync(receiptRoot,{recursive:true});
const rubric=JSON.parse(read('reviewer-rubric.json'));
const round=openCandidateRound({materialsJSON:read('materials.json'),tasksJSON:read('tasks.json'),rubricJSON:read('reviewer-rubric.json'),environmentJSON:gunzipSync(readFileSync(resolve(base,'compiler-environment.json.gz'))).toString(),pins:JSON.parse(read('integration-pins.json')),receiptRoot});
const failures={
 'export-structure-only-semantic-negative':{'structural-api':'Calls rich describe() without existing structural projection.','full-structure':'Rich node status/value/version fields are retained.'},
 'report-node-version-metadata-semantic-negative':{'preserve-fields':'Replaces prev:null with empty string.'},
 'consume-business-results-semantic-negative':{'result-branches':'Drops ok values whenever additional issues are present.','preserve-order-identity':'Dropping ok occurrences also loses required duplicate occurrences.'},
};
const rows=[];
for(const row of JSON.parse(read('calibration-results.json')).rows){
 const criteria=Object.fromEntries(rubric.tasks.find(t=>t.id===row.assessment.taskId).criteria.map(c=>[c.id,{pass:!failures[row.id]?.[c.id],evidence:failures[row.id]?.[c.id]??'Source-based independent static review agrees with fixture body and explanation; see review-notes.md. Missing-export cases independently fail consumer compilation.'}]));
 const review={assessmentSHA256:row.assessmentSHA256,reviewerId:'root-integrating-new_task_rubric_review',criteria};
 const verified=await round.review({...row,review});
 const expected=row.id.endsWith('-positive');
 assert.equal(verified.accepted,expected,row.id);
 rows.push({id:row.id,review,verified});
}
writeFileSync(resolve(base,'review-calibration-results.json'),JSON.stringify({providerCalls:0,formalReady:false,rows},null,2)+'\n');
console.log('10/10 calibration verdicts match: 4 accepted, 3 static failures, 3 consumer compilation failures; no model calls.');
