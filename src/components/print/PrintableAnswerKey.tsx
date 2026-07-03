import type { PrintableSectionData } from "@/components/print/PrintableSectionContent";

function answerLetter(answerIndex: number) {
  return String.fromCharCode(65 + answerIndex);
}

function sectionLabel(sectionId: string) {
  const match = sectionId.match(/^ch(\d+)_s(\d+)$/i);
  return match ? `Section ${match[1]}.${match[2]}` : sectionId;
}

type SectionAnswerKeyProps = {
  section: PrintableSectionData;
  showSectionHeading?: boolean;
};

export function PrintableSectionAnswerKey({
  section,
  showSectionHeading = false,
}: SectionAnswerKeyProps) {
  return (
    <section className="print-answer-key-section bg-white p-8 text-gray-950">
      {showSectionHeading ? (
        <h2 className="text-xl font-bold text-gray-950">
          {sectionLabel(section.sectionId)} — {section.title}
        </h2>
      ) : (
        <h1 className="text-3xl font-bold text-gray-950">{section.title}</h1>
      )}
      <p className="mt-4 text-lg font-semibold text-gray-950">Answer Key</p>
      <ol className="mt-4 list-decimal space-y-2 pl-6 text-lg text-gray-950">
        {section.questions.map((question, index) => (
          <li key={question.id} value={index + 1}>
            {answerLetter(question.answerIndex)}
          </li>
        ))}
      </ol>
    </section>
  );
}

type ChapterAnswerKeyProps = {
  chapterNumber: number;
  sections: PrintableSectionData[];
};

export function PrintableChapterAnswerKey({ chapterNumber, sections }: ChapterAnswerKeyProps) {
  return (
    <div className="print-answer-key bg-white p-8 text-gray-950">
      <h1 className="text-3xl font-bold uppercase text-gray-950">CHAPTER {chapterNumber}</h1>
      <p className="mt-4 text-lg font-semibold text-gray-950">Answer Key</p>
      <div className="mt-8 space-y-8">
        {sections.map((section) => (
          <PrintableSectionAnswerKey key={section.sectionId} section={section} showSectionHeading />
        ))}
      </div>
    </div>
  );
}
