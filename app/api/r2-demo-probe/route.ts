import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const TEST_URL = "https://pub-9744153e7b2d41df9aad6475c60db5e4.r2.dev/42.mp4";

export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  const summary: Record<string, unknown> = { file: "video/42.mp4", source: "Cloudflare R2 public development URL" };
  try {
    const response = await fetch(TEST_URL, {
      method: "GET",
      cache: "no-store",
      headers: { Range: "bytes=0-63", Accept: "video/mp4,*/*;q=0.1" },
      signal: AbortSignal.timeout(12000),
    });
    summary.status = response.status;
    summary.type = response.headers.get("content-type");
    summary.length = response.headers.get("content-length");
    summary.range = response.headers.get("content-range");
    summary.acceptRanges = response.headers.get("accept-ranges");
    summary.rateLimit = response.headers.get("retry-after");
    summary.server = response.headers.get("server");
    // Only read the first chunk; do not transfer or disclose the video.
    if (response.ok && response.body) {
      const reader = response.body.getReader();
      try {
        const result = await reader.read();
        if (result.value) {
          const first = result.value.slice(0, 16);
          summary.signature = Buffer.from(first).toString("hex");
          summary.isMp4 = first.length >= 8 && Buffer.from(first.slice(4, 8)).toString("ascii") === "ftyp";
        }
      } finally {
        await reader.cancel().catch(() => {});
      }
    } else {
      await response.body?.cancel().catch(() => {});
    }
  } catch (e) {
    summary.error = e instanceof Error ? e.name : "UnknownNetworkError";
  }
  return NextResponse.json(summary, { headers });
}
