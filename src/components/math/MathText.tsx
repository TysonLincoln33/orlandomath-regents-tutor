"use client";

import React, { Fragment, useMemo } from "react";
import { InlineMath, BlockMath } from "react-katex";

/**
 * MathText renders mixed plain text + math.
 *
 * Canonical delimiters:
 *  - Inline math: \( ... \)
 *  - Display math: \[ ... \]
 *
 * IMPORTANT: We intentionally do NOT support $...$ because Regents-style text uses currency ($3, $12).
 *
 * Optional behavior:
 *  - autoMath: if true, and the string contains no delimiters, we will render the *entire string*
 *    as inline math when it looks like a math expression (great for answer choices).
 */
type Part =
  | { kind: "text"; value: string }
  | { kind: "inline"; value: string }
  | { kind: "block"; value: string };

type InlineTextPart =
  | { kind: "plain"; value: string }
  | { kind: "bold"; value: string }
  | { kind: "italic"; value: string };

function tokenizeMixedMath(input: string): Part[] {
  if (!input) return [{ kind: "text", value: "" }];

  const parts: Part[] = [];
  let i = 0;

  const startsWith = (s: string) => input.startsWith(s, i);

  const pushText = (t: string) => {
    if (!t) return;
    const prev = parts[parts.length - 1];
    if (prev?.kind === "text") prev.value += t;
    else parts.push({ kind: "text", value: t });
  };

  const readUntil = (endToken: string) => {
    const start = i;
    const end = input.indexOf(endToken, start);
    if (end === -1) return null;
    const content = input.slice(start, end);
    i = end + endToken.length;
    return content;
  };

  while (i < input.length) {
    // Block: \[ ... \]
    if (startsWith("\\[")) {
      i += 2;
      const content = readUntil("\\]");
      if (content === null) {
        i -= 2;
        pushText(input.slice(i));
        break;
      }
      parts.push({ kind: "block", value: content.trim() });
      continue;
    }

    // Inline: \( ... \)
    if (startsWith("\\(")) {
      i += 2;
      const content = readUntil("\\)");
      if (content === null) {
        i -= 2;
        pushText(input.slice(i));
        break;
      }
      parts.push({ kind: "inline", value: content.trim() });
      continue;
    }

    const nextCandidates = [
      input.indexOf("\\[", i),
      input.indexOf("\\(", i),
    ].filter((x) => x !== -1);
    const nextDelim = nextCandidates.length ? Math.min(...nextCandidates) : -1;

    if (nextDelim === -1) {
      pushText(input.slice(i));
      break;
    } else if (nextDelim === i) {
      pushText(input[i]);
      i += 1;
    } else {
      pushText(input.slice(i, nextDelim));
      i = nextDelim;
    }
  }

  return parts.length ? parts : [{ kind: "text", value: input }];
}

function tokenizeInlineFormatting(input: string): InlineTextPart[] {
  if (!input) return [{ kind: "plain", value: "" }];

  const parts: InlineTextPart[] = [];
  let i = 0;

  const pushPlain = (value: string) => {
    if (!value) return;
    const prev = parts[parts.length - 1];
    if (prev?.kind === "plain") prev.value += value;
    else parts.push({ kind: "plain", value });
  };

  while (i < input.length) {
    if (input.startsWith("**", i)) {
      const end = input.indexOf("**", i + 2);
      if (end !== -1) {
        const value = input.slice(i + 2, end);
        parts.push({ kind: "bold", value });
        i = end + 2;
        continue;
      }
    }

    if (input[i] === "*") {
      const end = input.indexOf("*", i + 1);
      if (end !== -1) {
        const value = input.slice(i + 1, end);
        parts.push({ kind: "italic", value });
        i = end + 1;
        continue;
      }
    }

    pushPlain(input[i]);
    i += 1;
  }

  return parts.length ? parts : [{ kind: "plain", value: input }];
}

function renderFormattedText(input: string) {
  const chunks = tokenizeInlineFormatting(input);

  return chunks.map((chunk, idx) => {
    if (chunk.kind === "bold") {
      return <strong key={idx}>{chunk.value}</strong>;
    }
    if (chunk.kind === "italic") {
      return <em key={idx}>{chunk.value}</em>;
    }
    return <Fragment key={idx}>{chunk.value}</Fragment>;
  });
}

function looksLikeMathExpression(s: string): boolean {
  const t = (s ?? "").trim();
  if (!t) return false;
  if (/^[A-Za-z\s]+$/.test(t)) return false;
  if (/[\\^_]/.test(t)) return true;
  if (/(\\frac|\\sqrt|\\pi|\\le|\\ge|\\neq|\\times|\\cdot|\\div)/.test(t)) return true;
  if (/[=<>+\-*/]/.test(t)) return true;

  const hasVar = /[A-Za-z]/.test(t);
  const hasNum = /\d/.test(t);
  if (hasVar && hasNum) return true;

  return false;
}

function normalizeMathLatex(input: string): string {
  let s = input ?? "";
  if (!s) return s;

  s = s.replace(/−/g, "-");
  s = s.replace(/π/g, "\\pi");
  s = s.replace(/\bpi\b/gi, "\\pi");
  s = s.replace(/([A-Za-z0-9\\]+)\^([A-Za-z0-9]+)/g, (_m, base, exp) => `${base}^{${exp}}`);
  s = s.replace(/sqrt\(([^)]+)\)/gi, (_m, inner) => `\\sqrt{${inner}}`);
  s = s.replace(/\b([A-Za-z0-9\\]+)\s*\/\s*\(\s*([^)]+?)\s*\)/g, (_m, a, b) => `\\frac{${a}}{${b}}`);
  s = s.replace(/\(\s*([^)/]+?)\s*\)\s*\/\s*\(\s*([^)]+?)\s*\)/g, (_m, a, b) => `\\frac{${a.trim()}}{${b.trim()}}`);
  s = s.replace(/(?<!\\frac\{)([A-Za-z0-9\\]+)\s*\/\s*([A-Za-z0-9\\]+)/g, (_m, a, b) => `\\frac{${a}}{${b}}`);

  return s;
}

export default function MathText({
  children,
  className,
  autoMath = false,
  forceMath = false,
}: {
  children: string;
  className?: string;
  autoMath?: boolean;
  forceMath?: boolean;
}) {
  const tokens = useMemo(() => tokenizeMixedMath(children ?? ""), [children]);

  const hasAnyMathDelims = useMemo(() => {
    const s = children ?? "";
    return s.includes("\\(") || s.includes("\\[") || s.includes("\\)") || s.includes("\\]");
  }, [children]);

  const rawAll = (children ?? "").toString();

  if (forceMath) {
    const stripped = rawAll
      .replace(/\\\(/g, "")
      .replace(/\\\)/g, "")
      .replace(/\\\[/g, "")
      .replace(/\\\]/g, "")
      .trim();

    const safe = stripped.replace(/\$/g, "\\$");
    return <InlineMath math={safe} />;
  }

  if (autoMath && !hasAnyMathDelims && tokens.length === 1 && tokens[0].kind === "text") {
    const raw = tokens[0].value;
    if (looksLikeMathExpression(raw)) {
      const safe = normalizeMathLatex(raw.replace(/\$/g, "\\$"));
      return <InlineMath math={safe} />;
    }
  }

  return (
    <span className={className}>
      {tokens.map((p, idx) => {
        if (p.kind === "text") return <Fragment key={idx}>{renderFormattedText(p.value)}</Fragment>;

        if (p.kind === "block") {
          return (
            <span key={idx} className="my-2 block">
              <BlockMath math={normalizeMathLatex(p.value)} />
            </span>
          );
        }

        return <InlineMath key={idx} math={normalizeMathLatex(p.value)} />;
      })}
    </span>
  );
}
