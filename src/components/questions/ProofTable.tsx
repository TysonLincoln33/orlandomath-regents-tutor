import type { ProofAnswer, ProofQuestion } from "@/lib/questionBank";
type Props = { question: ProofQuestion; answer?: ProofAnswer; onChange?: (answer: ProofAnswer) => void; interactive?: boolean; checked?: boolean; showAnswers?: boolean; disabled?: boolean };
export default function ProofTable({ question, answer = {}, onChange, interactive = false, checked = false, showAnswers = false, disabled = false }: Props) {
 return <div className="proof-table-wrap my-5"><table className="proof-table w-full table-fixed border-collapse text-sm text-slate-900" aria-label={"Question " + (question.sourceNumber ?? question.id) + " proof statements and reasons"}>
  <thead><tr><th className="w-10 border border-slate-300 bg-slate-100 p-2" scope="col">Step</th><th className="border border-slate-300 bg-slate-100 p-2 text-left" scope="col">Statement</th><th className="border border-slate-300 bg-slate-100 p-2 text-left" scope="col">Reason</th></tr></thead>
  <tbody>{question.proof.rows.map((row, index) => <tr key={row.id}><th scope="row" className="border border-slate-300 p-2 align-top font-medium">{index + 1}</th>
   {(["statement", "reason"] as const).map(column => {
    const cell = row[column]; const key = row.id + "." + column; const correct = cell.kind === "dropdown" && answer[key] === cell.answerIndex;
    return <td key={column} className={"break-words border border-slate-300 p-2 align-top sm:p-3 " + (checked && cell.kind === "dropdown" ? correct ? "bg-green-50" : "bg-red-50" : "")}>
     {cell.kind === "fixed" ? cell.text : showAnswers ? cell.choices[cell.answerIndex] : <>
      {interactive && <div className="no-print"><select aria-label={"Question " + (question.sourceNumber ?? question.id) + ", step " + (index + 1) + " " + column} value={answer[key] ?? ""} disabled={disabled} onChange={event => { const next = {...answer}; if (event.target.value === "") delete next[key]; else next[key] = Number(event.target.value); onChange?.(next); }} className="w-full min-w-0 rounded-lg border border-slate-400 bg-white px-2 py-3 text-base text-slate-900 focus:outline-2 focus:outline-blue-600">
       <option value="">Choose…</option>{cell.choices.map((choice, i) => <option key={i} value={i}>{choice}</option>)}</select>
       {answer[key] !== undefined && <p className="mt-2 whitespace-normal leading-6">{cell.choices[answer[key]]}</p>}
       {checked && <p className={"mt-2 font-semibold " + (correct ? "text-green-800" : "text-red-800")}>{correct ? "Correct" : "Review this selection"}</p>}</div>}
      <div className={interactive ? "proof-print-blank" : "min-h-12 border-b border-slate-400"} aria-label="Write your answer" /></>}
    </td>;
   })}</tr>)}</tbody></table>{interactive && <p className="no-print mt-3 text-sm text-slate-600">Complete every dropdown. This proof counts as one question.</p>}</div>;
}
