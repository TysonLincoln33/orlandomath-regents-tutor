import ChapterClient from "./ChapterClient";

type Params = { chapterId: string };

export default async function ChapterPage({
  params,
}: {
  params: Params | Promise<Params>;
}) {
  const resolved = await Promise.resolve(params);
  return <ChapterClient chapterId={resolved.chapterId} />;
}
