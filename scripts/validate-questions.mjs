import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const DIR = path.join(ROOT, "public", "questions", "sections");

function walkJson(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const stat = fs.statSync(p);
    if (stat.isDirectory()) out.push(...walkJson(p));
    else if (name.toLowerCase().endsWith(".json")) out.push(p);
  }
  return out;
}

function hasDelims(s) {
  return s.includes("\\(") || s.includes("\\[") || s.includes("\\)") || s.includes("\\]");
}

function flagString(label, file, idx, s) {
  console.log(`\n[${file}] Q${idx + 1} ${label}`);
  console.log(`  ${s}`);
}

function checkField(label, file, qIndex, s) {
  if (typeof s !== "string") return 0;
  const t = s;
  const has = hasDelims(t);

  let issues = 0;

  // Carets/exponents should generally be rendered by KaTeX (either delimited or autoMath contexts).
  // Prompts/explanations MUST be delimited if they contain math-y operators.
  const containsMathOps = /[=<>^]/.test(t) || /\b(sqrt|sin|cos|tan)\b/i.test(t) || /\\(frac|sqrt|pi|le|ge|neq|times|cdot|div)/.test(t);

  // slashes that look like fractions: (x/3) or x/3
  const looksLikeFraction = /\(([A-Za-z0-9]+)\s*\/\s*([A-Za-z0-9]+)\)|\b([A-Za-z0-9]+)\s*\/\s*([A-Za-z0-9]+)\b/.test(t);

  // Exclude obvious dates/paths (a/b/c)
  const hasSlashChain = /\d+\s*\/\s*\d+\s*\/\s*\d+/.test(t);

  if ((label === "prompt" || label === "explanation") && containsMathOps && !has) {
    flagString(`${label}: missing \\( \\) delimiters`, file, qIndex, t);
    issues++;
  }

  if ((label === "prompt" || label === "explanation") && looksLikeFraction && !hasSlashChain && !t.includes("\\frac")) {
    flagString(`${label}: possible fraction should use \\frac{ }{ }`, file, qIndex, t);
    issues++;
  }

  // choices are allowed to be plain because we render them with autoMath,
  // but warn if they contain a slash chain.
  if (label.startsWith("choice") && hasSlashChain) {
    flagString(`${label}: looks like date/path (check)`, file, qIndex, t);
    issues++;
  }

  return issues;
}

let totalIssues = 0;

const files = walkJson(DIR);
if (!files.length) {
  console.log(`No JSON files found at ${DIR}`);
  process.exit(0);
}

for (const file of files) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    console.log(`\n[${file}] Invalid JSON: ${e?.message ?? e}`);
    totalIssues++;
    continue;
  }

  const qs = Array.isArray(data?.questions) ? data.questions : [];
  for (let i = 0; i < qs.length; i++) {
    const q = qs[i];
    totalIssues += checkField("prompt", file, i, q?.prompt);

    if (Array.isArray(q?.choices)) {
      for (let c = 0; c < q.choices.length; c++) {
        totalIssues += checkField(`choice${c + 1}`, file, i, q.choices[c]);
      }
    }

    totalIssues += checkField("explanation", file, i, q?.explanation);
  }
}

if (totalIssues === 0) {
  console.log("✅ Question formatting check passed (no issues found).");
  process.exit(0);
} else {
  console.log(`\n❌ Found ${totalIssues} potential formatting issue(s). Fix the flagged strings (prefer \\( \\) and \\frac{ }{ }).`);
  process.exit(1);
}
