import fs from "fs";
import path from "path";
import { notFound } from "next/navigation";
import { SECTIONS } from "@/lib/course/registry";
import type { SectionQuestionSet } from "@/lib/questionBank";
import SectionPageClient from "./SectionPageClient";

export default async function SectionPage({
  params,
}: {
  params: Promise<{ sectionId: string }>;
}) {
  const { sectionId } = await params;

  if (!SECTIONS.some(section => section.id === sectionId)) notFound();

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
  const data: SectionQuestionSet = JSON.parse(fileContents);

  return <SectionPageClient key={sectionId} data={data} />;
}