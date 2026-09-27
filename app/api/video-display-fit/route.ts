import sharp from "sharp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

const SAMPLE_WIDTH = 128;
const BLACK_LUMA_THRESHOLD = 24;
const ROW_CONTENT_THRESHOLD = 0.08;

type LetterboxFrame = {
  activeFraction: number;
  contentAspectRatio: number;
};

const analysisCache = new Map<string, { expiresAt: number; aspectRatio: number | null }>();

function jsonResponse(body: object, cacheSeconds: number): Response {
  return Response.json(body, {
    headers: {
      "Cache-Control": `public, max-age=300, s-maxage=${cacheSeconds}, stale-while-revalidate=86400`,
    },
  });
}

async function inspectMuxFrame(playbackId: string, time: number): Promise<LetterboxFrame | null> {
  const imageUrl = new URL(`/${playbackId}/thumbnail.jpg`, "https://image.mux.com");
  imageUrl.searchParams.set("time", time.toFixed(1));
  imageUrl.searchParams.set("width", String(SAMPLE_WIDTH));

  try {
    const response = await fetch(imageUrl, { signal: AbortSignal.timeout(5_000) });
    if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) return null;

    const encoded = Buffer.from(await response.arrayBuffer());
    if (encoded.byteLength === 0 || encoded.byteLength > 2_000_000) return null;

    const { data, info } = await sharp(encoded, { limitInputPixels: 2_000_000 })
      .resize({ width: SAMPLE_WIDTH, withoutEnlargement: true })
      .toColourspace("srgb")
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    if (info.width < 32 || info.height < 48 || info.channels < 3) return null;

    const rowContent: number[] = [];
    for (let y = 0; y < info.height; y++) {
      let visiblePixels = 0;
      for (let x = 0; x < info.width; x++) {
        const pixel = (y * info.width + x) * info.channels;
        const luma = 0.2126 * data[pixel] + 0.7152 * data[pixel + 1] + 0.0722 * data[pixel + 2];
        if (luma > BLACK_LUMA_THRESHOLD) visiblePixels++;
      }
      rowContent.push(visiblePixels / info.width);
    }

    const activeRows = rowContent
      .map((content, index) => (content >= ROW_CONTENT_THRESHOLD ? index : -1))
      .filter((index) => index >= 0);
    if (activeRows.length === 0) return null;

    const firstActiveRow = activeRows[0];
    const lastActiveRow = activeRows[activeRows.length - 1];
    const topBarFraction = firstActiveRow / info.height;
    const bottomBarFraction = (info.height - lastActiveRow - 1) / info.height;
    const activeFraction = (lastActiveRow - firstActiveRow + 1) / info.height;

    // Only treat this as a letterboxed landscape video when sizeable dark
    // bands exist at BOTH ends and the visible band is still wide. Requiring
    // repeated, matching frames below keeps a dark scene from being mistaken
    // for black bars on its own.
    if (topBarFraction < 0.14 || bottomBarFraction < 0.14 || activeFraction <= 0) return null;

    const contentAspectRatio = (info.width / info.height) / activeFraction;
    if (contentAspectRatio < 1.25 || contentAspectRatio > 2.2) return null;

    // Make sure the active image reaches both side edges. Otherwise the
    // thumbnail may be a portrait video with a small subject in the middle.
    const activeHeight = lastActiveRow - firstActiveRow + 1;
    const edgeWidth = Math.max(2, Math.round(info.width * 0.04));
    let leftVisibleRows = 0;
    let rightVisibleRows = 0;
    for (let y = firstActiveRow; y <= lastActiveRow; y++) {
      let leftVisible = false;
      let rightVisible = false;
      for (let edge = 0; edge < edgeWidth && (!leftVisible || !rightVisible); edge++) {
        const leftPixel = (y * info.width + edge) * info.channels;
        const rightPixel = (y * info.width + info.width - edge - 1) * info.channels;
        const leftLuma = 0.2126 * data[leftPixel] + 0.7152 * data[leftPixel + 1] + 0.0722 * data[leftPixel + 2];
        const rightLuma = 0.2126 * data[rightPixel] + 0.7152 * data[rightPixel + 1] + 0.0722 * data[rightPixel + 2];
        leftVisible ||= leftLuma > BLACK_LUMA_THRESHOLD;
        rightVisible ||= rightLuma > BLACK_LUMA_THRESHOLD;
      }
      if (leftVisible) leftVisibleRows++;
      if (rightVisible) rightVisibleRows++;
    }
    if (leftVisibleRows / activeHeight < 0.12 || rightVisibleRows / activeHeight < 0.12) return null;

    return { activeFraction, contentAspectRatio };
  } catch {
    return null;
  }
}

function findStableLetterbox(frames: LetterboxFrame[]): number | null {
  let bestCluster: LetterboxFrame[] = [];

  for (const frame of frames) {
    const cluster = frames.filter(
      (candidate) => Math.abs(candidate.activeFraction - frame.activeFraction) <= 0.07,
    );
    if (cluster.length > bestCluster.length) bestCluster = cluster;
  }

  if (bestCluster.length < 2) return null;
  const ratios = bestCluster.map((frame) => frame.contentAspectRatio).sort((a, b) => a - b);
  const median = ratios[Math.floor(ratios.length / 2)];

  // Common source formats should remain exact, while unusual active bands
  // retain their measured ratio within a conservative landscape range.
  if (Math.abs(median - 16 / 9) < 0.1) return 16 / 9;
  if (Math.abs(median - 4 / 3) < 0.08) return 4 / 3;
  return Math.max(1.25, Math.min(2.2, Math.round(median * 100) / 100));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const playbackId = url.searchParams.get("playbackId") ?? "";
  const duration = Number(url.searchParams.get("duration"));

  if (!/^[A-Za-z0-9_-]{16,128}$/.test(playbackId)) {
    return jsonResponse({ contentAspectRatio: null }, 60);
  }

  const cached = analysisCache.get(playbackId);
  if (cached && cached.expiresAt > Date.now()) {
    return jsonResponse({ contentAspectRatio: cached.aspectRatio }, 86_400);
  }

  const sampleTimes = Number.isFinite(duration) && duration > 2
    ? [1, Math.min(10, duration / 2), Math.min(30, duration * 0.8)]
    : [1, 5, 10];
  const uniqueTimes = [...new Set(sampleTimes.map((time) => Math.max(0.5, time)))];
  const inspectedFrames = await Promise.all(uniqueTimes.map((time) => inspectMuxFrame(playbackId, time)));
  const frames = inspectedFrames
    .filter((frame): frame is LetterboxFrame => frame !== null);
  const contentAspectRatio = findStableLetterbox(frames);
  // A confirmed classification is stable per playback ID. If one or more
  // thumbnail requests failed, keep the negative result short so transient
  // Mux/network failures cannot hide letterboxing for a full day.
  const cacheSeconds = contentAspectRatio !== null || frames.length === uniqueTimes.length
    ? 86_400
    : 60;

  analysisCache.set(playbackId, { expiresAt: Date.now() + cacheSeconds * 1000, aspectRatio: contentAspectRatio });
  return jsonResponse({ contentAspectRatio }, cacheSeconds);
}
