import { revalidatePath } from "next/cache";

/**
 * On-demand revalidation of the home page (and its OG image).
 *
 * - External crons / manual calls: POST with `Authorization: Bearer $REFRESH_SECRET`.
 * - Vercel Cron (see vercel.json) sends GET with `Authorization: Bearer $CRON_SECRET`
 *   (Vercel adds that header automatically when a CRON_SECRET env var exists).
 *
 * With neither env var configured the endpoint always answers 401 (fails closed).
 */
function isAuthorized(request: Request): boolean {
  const header = request.headers.get("authorization");
  if (!header) return false;
  const secrets = [process.env.REFRESH_SECRET, process.env.CRON_SECRET].filter(
    (secret): secret is string => typeof secret === "string" && secret.length > 0,
  );
  return secrets.some((secret) => header === `Bearer ${secret}`);
}

function refresh(request: Request): Response {
  if (!isAuthorized(request)) {
    return Response.json({ revalidated: false, error: "unauthorized" }, { status: 401 });
  }
  revalidatePath("/");
  return Response.json({ revalidated: true, at: new Date().toISOString() });
}

export async function POST(request: Request): Promise<Response> {
  return refresh(request);
}

export async function GET(request: Request): Promise<Response> {
  return refresh(request);
}
