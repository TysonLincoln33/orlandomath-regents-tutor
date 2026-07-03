import fs from "fs";
import path from "path";
import Link from "next/link";

import { CHAPTERS, SECTIONS } from "@/lib/course/algebra1";
import ChapterPrintClient from "./ChapterPrintClient";
import type { PrintableSectionData } from "@/components/print/PrintableSectionContent";

type Params = { chapterId: string };

function loadSection(sectionId: string): PrintableSectionData | null {
  const filePath = path.join(process.cwd(), "public", "questions", "sections", `${sectionId}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as PrintableSectionData;
}

export default async function ChapterPrintPage({ params }: { params: Params | Promise<Params> }) {
  const { chapterId } = await Promise.resolve(params);
  const chapter = CHAPTERS.find((item) => item.id === chapterId);
  const sections = SECTIONS.filter((section) => section.chapterId === chapterId)
    .map((section) => loadSection(section.id))
    .filter((section): section is PrintableSectionData => Boolean(section));

  if (!chapter) {
    return <main className="mx-auto max-w-3xl p-8 text-white"><h1 className="text-2xl font-bold">Chapter not found</h1><Link href="/dashboard" className="mt-4 inline-block text-blue-200 underline">Return to dashboard</Link></main>;
  }

  return <ChapterPrintClient data={{ chapterId: chapter.id, chapterTitle: chapter.title, sections }} />;
}
