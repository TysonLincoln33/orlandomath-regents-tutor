import { renderBoldText, type PrintableSectionData } from "@/components/print/PrintableSectionContent";

type Props = {
  chapterTitle?: string;
  sections: PrintableSectionData[];
};

function answerLabel(answerIndex: number) {
  return String.fromCharCode(65 + answerIndex);
}

export default function PrintableAnswerKey({ chapterTitle, sections }: Props) {
  return (
    <section className="print-answer-key rounded-2xl bg-white p-6 shadow">
      <header className="print-answer-key-header">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Answer Key</p>
        {chapterTitle ? <h1 className="mt-1 text-2xl font-bold text-gray-950">{chapterTitle}</h1> : null}
      </header>

      <div className="mt-5 space-y-6">
        {sections.map((section) => (
          <section key={section.sectionId} className="print-answer-key-section">
            <h2 className="text-lg font-bold text-gray-950">{section.title}</h2>
            <ol className="mt-3 space-y-2 text-gray-900">
              {section.questions.map((question, index) => (
                <li key={question.id} className="print-answer-key-item flex gap-2">
                  <span className="font-semibold">{index + 1}.</span>
                  <span>
                    <span className="font-semibold">{answerLabel(question.answerIndex)}.</span>{" "}
                    {renderBoldText(question.choices[question.answerIndex] ?? "")}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </section>
  );
}
