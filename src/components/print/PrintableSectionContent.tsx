export type PrintableQuestion = {
  id: string;
  type: string;
  prompt: string;
  image?: string;
  table?: { headers: string[]; rows: string[][] };
  choiceImages?: string[];
  choices: string[];
  answerIndex: number;
  explanation?: string;
  hint?: string;
};

export type PrintableSectionData = {
  sectionId: string;
  title: string;
  lesson?: { title: string; intro: string[] };
  questions: PrintableQuestion[];
};

export function renderBoldText(text: string) {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, index) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={index}>{part.slice(2, -2)}</strong>
    ) : (
      <span key={index}>{part}</span>
    )
  );
}

type Props = {
  data: PrintableSectionData;
  showSectionTitle?: boolean;
  answers?: Record<string, number | null>;
  mastered?: Record<string, boolean>;
  incorrect?: Record<string, boolean>;
  onSelect?: (questionId: string, choiceIndex: number) => void;
  onCheck?: (question: PrintableQuestion) => void;
  showHint?: Record<string, boolean>;
  interactive?: boolean;
  answerKey?: boolean;
};

export default function PrintableSectionContent({
  data,
  showSectionTitle = false,
  answers = {},
  mastered = {},
  incorrect = {},
  onSelect,
  onCheck,
  showHint = {},
  interactive = false,
  answerKey = false,
}: Props) {
  return (
    <section className="chapter-print-section section-print-section">
      {showSectionTitle ? (
        <header className="chapter-print-section-header">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{data.sectionId}</p>
          <h2 className="mt-1 text-2xl font-bold text-gray-950">{data.title}</h2>
        </header>
      ) : null}

      {data.lesson ? (
        <div className="section-print-lesson bg-white rounded-xl shadow p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">MINI LESSON</p>
          <h3 className="text-xl font-bold mb-4 text-gray-900">{data.lesson.title}</h3>
          {data.lesson.intro.map((line, i) => (
            <p key={i} className="mb-4 text-gray-800 leading-8">{renderBoldText(line)}</p>
          ))}
        </div>
      ) : null}

      <div className="section-print-question-list space-y-8">
        {data.questions.map((question, idx) => {
          const selected = answers[question.id];
          const isMastered = mastered[question.id];
          const isIncorrect = incorrect[question.id];
          return (
            <div key={question.id} className="section-print-question bg-white rounded-xl shadow p-6">
              <p className="text-xs font-semibold text-gray-500 mb-3">Question {idx + 1}</p>
              <div className="section-print-question-prompt text-lg mb-4 leading-8 text-gray-900">{renderBoldText(question.prompt)}</div>
              {question.image ? <img src={question.image} alt="Question visual" className="my-4 max-w-full rounded-lg border" /> : null}
              {question.table ? (
                <div className="my-4 overflow-x-auto"><table className="border-collapse border border-gray-300 text-sm"><thead><tr>{question.table.headers.map((header, i) => <th key={i} className="border border-gray-300 px-3 py-2 bg-gray-100 text-left text-gray-900">{renderBoldText(header)}</th>)}</tr></thead><tbody>{question.table.rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j} className="border border-gray-300 px-3 py-2 text-gray-900">{renderBoldText(cell)}</td>)}</tr>)}</tbody></table></div>
              ) : null}
              <div className="section-print-answer-list space-y-3 mt-4">
                {question.choices.map((choice, choiceIndex) => {
                  const isAnswerKeyCorrect = answerKey && choiceIndex === question.answerIndex;
                  const isSelected = selected === choiceIndex;
                  let buttonClass = "section-print-answer-choice w-full text-left border rounded-lg px-4 py-3 transition text-gray-900";
                  if (isMastered && isSelected) buttonClass += " bg-green-100 border-green-400";
                  else if (isIncorrect && isSelected) buttonClass += " bg-red-100 border-red-400";
                  else buttonClass += isSelected ? " bg-blue-50 border-blue-400" : " bg-white border-gray-300";
                  return <button key={choiceIndex} type="button" onClick={() => interactive && onSelect?.(question.id, choiceIndex)} disabled={!interactive} className={buttonClass}>{question.choiceImages?.[choiceIndex] ? <div className="flex items-start gap-3"><span className={`section-print-choice-label font-semibold mt-1 shrink-0 ${isAnswerKeyCorrect ? "section-print-choice-label-correct" : ""}`}>{String.fromCharCode(65 + choiceIndex)}.</span><img src={question.choiceImages[choiceIndex]} alt={`Choice ${choiceIndex + 1}`} className="max-w-full rounded" /></div> : <><span className={`section-print-choice-label font-semibold mr-2 ${isAnswerKeyCorrect ? "section-print-choice-label-correct" : ""}`}>{String.fromCharCode(65 + choiceIndex)}.</span>{renderBoldText(choice)}</>}</button>;
                })}
              </div>
              {interactive ? <><button type="button" onClick={() => onCheck?.(question)} className="no-print mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg">Check answer</button>{isIncorrect ? <div className="no-print mt-4 p-3 bg-red-50 border border-red-300 rounded-lg text-sm text-red-800 font-medium">Incorrect. Try again.</div> : null}{showHint[question.id] ? <div className="section-print-hint no-print mt-4 p-3 bg-amber-50 border border-amber-300 rounded-lg text-sm text-amber-900"><strong className="font-semibold">Hint:</strong> {question.hint ?? "Eliminate choices that don't match conditions."}</div> : null}{isMastered && question.explanation ? <div className="section-print-explanation no-print mt-4 p-3 bg-gray-50 border rounded-lg text-sm text-gray-800 leading-7">{renderBoldText(question.explanation)}</div> : null}</> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
