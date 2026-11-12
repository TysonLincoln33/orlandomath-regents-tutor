import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import ts from 'typescript';
const source = readFileSync('src/lib/questionBank.ts', 'utf8');
const js = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
const {gradeQuestion, serializeAnswer} = await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const ids = new Set(); let mc=0, proofs=0, cells=0;
const files=readdirSync('public/questions/sections').filter(n=>n.startsWith('geo-'));
assert.equal(files.length,38);
for(const file of files){
 const section=JSON.parse(readFileSync('public/questions/sections/'+file,'utf8'));
 assert.equal(file,section.sectionId+'.json'); assert.equal(section.courseId,'geometry');
 assert(section.questions.length>0);
 for(const q of section.questions){
  assert(!ids.has(q.id));ids.add(q.id);assert(q.id.startsWith('geo-'));
  assert(q.sourceNumber<4||q.sourceNumber>7);
  assert(existsSync(resolve('public',q.image.replace(/^\//,''))),q.image);
  assert.equal(gradeQuestion(q,null).complete,false);
  if(q.type==='mc'){
   mc++;assert.equal(q.choices.length,4);assert(Number.isInteger(q.answerIndex));assert(q.answerIndex>=0&&q.answerIndex<4);
   for(let i=0;i<4;i++)assert.equal(gradeQuestion(q,i).correct,i===q.answerIndex,q.id);
   for(const bad of [-1,4,0.5,{},NaN,'0'])assert.equal(gradeQuestion(q,bad).complete,false,q.id);
  }else{
   assert.equal(q.type,'proof_dropdown');proofs++;assert.equal(q.proof.countAsQuestions,1);
   const answer={};const rowIds=new Set();
   for(const row of q.proof.rows){
    assert(!rowIds.has(row.id));rowIds.add(row.id);
    for(const col of ['statement','reason']){
     const cell=row[col];assert(['fixed','dropdown'].includes(cell.kind));
     if(cell.kind==='dropdown'){cells++;assert.equal(cell.choices.length,4);assert.equal(new Set(cell.choices).size,4);assert(Number.isInteger(cell.answerIndex));assert(cell.answerIndex>=0&&cell.answerIndex<4);answer[row.id+'.'+col]=cell.answerIndex;}
    }
   }
   assert(gradeQuestion(q,answer).correct,q.id);
   for(const key of Object.keys(answer)){
    const incomplete={...answer};delete incomplete[key];assert.equal(gradeQuestion(q,incomplete).complete,false,q.id);
    const wrong={...answer,[key]:(answer[key]+1)%4};assert(gradeQuestion(q,wrong).complete);assert.equal(gradeQuestion(q,wrong).correct,false,q.id);
   }
   assert.deepEqual(JSON.parse(serializeAnswer(answer)),answer);
  }
 }
}
assert.equal(ids.size,109);assert.equal(mc,103);assert.equal(proofs,6);assert.equal(cells,36);
console.log('Passed: 38 sections, 109 unique questions, 103 multiple choice, 6 proofs, 36 dropdowns, grading and serialization.');
