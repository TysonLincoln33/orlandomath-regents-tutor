import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise the actual TypeScript modules with isolated browser storage and auth.
const storage = new Map();
const browser = {
  location: { search: '', origin: 'https://example.test' },
  localStorage: {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key),
  },
  dispatchEvent() {},
  requestAnimationFrame: callback => callback(),
};
let authResult = { data: { user: null }, error: { name: 'AuthSessionMissingError' } };
let rpcCalls = [];
const supabase = {
  auth: { getUser: async () => authResult },
  rpc: async (name, args) => { rpcCalls.push({ name, args }); return { error: null }; },
};
const cache = new Map();
function load(file) {
  const fullPath = path.resolve(file);
  if (cache.has(fullPath)) return cache.get(fullPath).exports;
  const module = { exports: {} };
  cache.set(fullPath, module);
  const js = ts.transpileModule(readFileSync(fullPath, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const require = specifier => {
    if (specifier.endsWith('supabase/client')) return { getSupabaseBrowserClient: () => supabase };
    const target = specifier.startsWith('@/')
      ? path.resolve('src', specifier.slice(2))
      : path.resolve(path.dirname(fullPath), specifier);
    return load(target + '.ts');
  };
  vm.runInNewContext(js, {
    exports: module.exports, module, require, window: browser, URL, URLSearchParams,
    console: { ...console, warn() {} }, CustomEvent: class {},
  }, { filename: fullPath });
  return module.exports;
}

const progress = load('src/lib/sectionProgressLocal.ts');
const dashboard = load('src/lib/progress/dashboardProgress.ts');
const selection = load('src/lib/course/selection.ts');
const tracking = load('src/lib/progress/attemptTracking.ts');
const { gradeQuestion } = load('src/lib/questionBank.ts');

progress.recordAttempt({ sectionId: 'ch1_s1', questionId: 'q1', totalQuestions: 5, isCorrect: true, answerIndex: 2 });
const originalAlgebra = storage.get('orlandomath:sectionProgress:v1');
const originalLegacy = storage.get('orlandomath:progress:v1');
const proofAnswer = { 'r1.reason': 2, 'r2.statement': 1 };
progress.recordAttempt({ sectionId: 'geo-ch1_s1', questionId: 'geo-q1', totalQuestions: 3, isCorrect: true, answer: proofAnswer });
assert.equal(progress.getSectionPercent('geo-ch1_s1'), 33);
const snapshot = JSON.parse(JSON.stringify(progress.exportGeometrySnapshot()));
progress.resetSectionProgress('geo-ch1_s1');
assert.equal(progress.getSectionPercent('geo-ch1_s1'), 0);
progress.restoreGeometryGuestSnapshot(snapshot);
assert.equal(progress.getSectionPercent('geo-ch1_s1'), 33);
assert.equal(JSON.stringify(progress.getSectionProgress('geo-ch1_s1').byQuestionId['geo-q1'].lastAnswer), JSON.stringify(proofAnswer));

progress.setProgressOwner('student-a');
assert.equal(progress.getSectionProgress('geo-ch1_s1'), null);
progress.recordAttempt({ sectionId: 'geo-ch1_s1', questionId: 'geo-q1', totalQuestions: 3, isCorrect: true });
progress.recordAttempt({ sectionId: 'geo-ch1_s1', questionId: 'geo-q1', totalQuestions: 3, isCorrect: false });
assert.equal(progress.getSectionProgress('geo-ch1_s1').correct, 1, 'mastery stays earned');
progress.setProgressOwner('student-b');
assert.equal(progress.getSectionProgress('geo-ch1_s1'), null, 'accounts remain isolated');
progress.setProgressOwner('student-a');
assert.equal(progress.getSectionPercent('geo-ch1_s1'), 33);
assert.equal(storage.get('orlandomath:sectionProgress:v1'), originalAlgebra);
assert.equal(storage.get('orlandomath:progress:v1'), originalLegacy);

const row = (courseId, sectionId, completion) => ({
  user_id: 'student-a', course_id: courseId, section_id: sectionId,
  chapter_id: sectionId.split('_')[0], questions_attempted: 1, questions_correct: 1,
  accuracy_percent: 100, completion_percent: completion, last_active_at: null,
});
const mixed = [row('algebra1', 'ch1_s1', 100), row('geometry', 'geo-ch1_s1', 100), row('algebra1', 'geo-ch1_s1', 0)];
const geo = dashboard.buildCourseDashboardProgress(mixed, 'geometry');
assert.equal(geo.totalSections, 38);
assert.equal(geo.sectionsCompleted, 1);
assert.equal(geo.overallCompletionPercent, Math.round(100 / 38));
assert(geo.chapters.every(chapter => chapter.id.startsWith('geo-')));
const algebra = dashboard.buildCourseDashboardProgress(mixed, 'algebra1');
assert.equal(algebra.sectionsCompleted, 1);
assert(algebra.chapters.every(chapter => !chapter.id.startsWith('geo-')));
assert.equal((await dashboard.fetchCourseDashboardProgress('geometry')).sectionsCompleted, 0);
assert.equal(progress.getSectionPercent('geo-ch1_s1'), 33, 'guest storage restores after auth lookup');

for (const courseId of ['geometry', 'algebra1']) {
  browser.location.search = '?courseId=' + courseId;
  assert.equal(selection.selectedCourseId(), courseId);
  assert.equal(selection.reportingRpcName('get_master_algebra1_overview'), courseId === 'geometry' ? 'get_master_geometry_overview' : 'get_master_algebra1_overview');
  assert.equal(selection.reportingRpcName('get_teacher_classroom_progress'), 'get_teacher_classroom_progress' + (courseId === 'geometry' ? '_geometry' : ''));
}

const payload = { courseId: 'geometry', chapterId: 'geo-ch1', sectionId: 'geo-ch1_s1', questionId: 'geo-q1', selectedAnswer: '2', correct: true, sectionTotalQuestions: 3 };
await tracking.recordQuestionAttempt(payload);
assert.equal(rpcCalls.length, 0, 'guests make no database writes');
authResult = { data: { user: null }, error: { name: 'AuthRetryableFetchError', message: 'offline' } };
await assert.rejects(tracking.recordQuestionAttempt(payload), error => error.name === 'AuthRetryableFetchError');
authResult = { data: { user: { id: 'student-a' } }, error: null };
await tracking.recordQuestionAttempt(payload);
assert.equal(rpcCalls.length, 1);
assert.equal(rpcCalls[0].args.p_course_id, 'geometry');
assert.equal(rpcCalls[0].args.p_section_id, 'geo-ch1_s1');

let algebraQuestions = 0;
for (const file of readdirSync('public/questions/sections').filter(file => /^ch.*\.json$/.test(file))) {
  for (const question of JSON.parse(readFileSync('public/questions/sections/' + file, 'utf8')).questions) {
    assert.equal(gradeQuestion(question, question.answerIndex).correct, true, file + ':' + question.id);
    for (let i = 0; i < question.choices.length; i++) assert.equal(gradeQuestion(question, i).correct, i === question.answerIndex);
    algebraQuestions++;
  }
}
console.log(`Passed: course/account isolation, proof answer persistence, snapshot restore, dashboard totals, reporting RPC routing, sync failure handling, and ${algebraQuestions} existing Algebra questions.`);
