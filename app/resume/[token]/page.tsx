import ResumeClient from "./ResumeClient";

type Params = { token: string };

/**
 * Next.js (15+) may provide params as a Promise in some client contexts.
 * Keep this page as a SERVER component, unwrap params here, and pass token down
 * to a CLIENT component.
 */
export default async function Page({
  params,
}: {
  params: Params | Promise<Params>;
}) {
  const { token } = await Promise.resolve(params);
  return <ResumeClient token={token} />;
}
