import fs from "fs";
import path from "path";
import SectionPageClient from "./SectionPageClient";

type Question = {
  id: string;
  type: string;
  prompt: string;
  image?: string;
  table?: {
    headers: string[];
    rows: string[][];
  };
  choices: string[];
  answerIndex: number;
  explanation?: string;
};

type SectionData = {
  sectionId: string;
  title: string;
  lesson: {
    title: string;
    intro: string[];
  };
  questions: Question[];
};

export default async function SectionPage({
  params,
}: {
  params: Promise<{ sectionId: string }>;
}) {
  const { sectionId } = await params;

  const filePath = path.join(
    process.cwd(),
    "public",
    "questions",
    "sections",
    `${sectionId}.json`
  );

  if (!fs.existsSync(filePath)) {
    return (
      <div className="max-w-3xl mx-auto p-8 text-white">
        <h1 className="text-2xl font-bold mb-4">Section not found</h1>
        <p>No JSON file exists for section: {sectionId}</p>
      </div>
    );
  }

  const fileContents = fs.readFileSync(filePath, "utf8");
  const data: SectionData = JSON.parse(fileContents);

  return <SectionPageClient data={data} />;
}