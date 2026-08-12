/**
 * Redirect to the newest video on THP RAW.
 *
 * This exists so one link can live inside a ManyChat message forever. The
 * alternative was pasting a video URL into the flow by hand after every upload,
 * which works right up until someone forgets — and the failure is silent, so
 * people keep getting sent a video from three weeks ago and nobody notices.
 *
 * Used by: ManyChat → THP-Latest-Video (comment `WATCH` → DM containing
 * https://thpofficial.com/api/latest-video). Public on purpose — it is a link
 * strangers click from Instagram, so there is nothing to authenticate.
 *
 * Reads YouTube's public Atom feed rather than the Data API: no key, no quota,
 * no billing account to expire. The feed carries only the ~15 most recent
 * uploads, which is 14 more than this needs.
 */

/**
 * THP RAW — youtube.com/@thpraw.
 *
 * Not the same channel as `site.youtube` in lib/site.ts (@THPDIGITAL). Both are
 * real; the website footer points at one and Instagram points at the other, so
 * resist the urge to "fix" the inconsistency by pointing them at each other.
 */
const CHANNEL_ID = 'UCSUxVcYWTNfQsuKxqAxo8uQ';

const FEED_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;

/** Where to send someone when the feed is unreachable — newest upload is still on top. */
const CHANNEL_URL = 'https://www.youtube.com/@thpraw';

/**
 * Ten minutes. Long enough that a post going viral doesn't mean thousands of
 * requests to YouTube, short enough that a new upload is live in the DM before
 * anyone would think to ask why it isn't.
 */
const CACHE_SECONDS = 600;

/** A stalled fetch must not hold the redirect open; the fallback is instant and fine. */
const TIMEOUT_MS = 5000;

export async function GET() {
  const videoId = await newestVideoId();

  // 302, not 301: browsers cache a permanent redirect forever, which would pin
  // whoever clicked first to that video for good.
  return Response.redirect(
    videoId ? `https://www.youtube.com/watch?v=${videoId}` : CHANNEL_URL,
    302,
  );
}

/**
 * The first <yt:videoId> in the feed, or null if anything at all goes wrong.
 *
 * Every failure path returns null rather than throwing. A viewer arriving from
 * an Instagram DM must never see an error page — landing on the channel is a
 * worse experience than landing on the video, and an infinitely better one than
 * landing on a 500.
 */
async function newestVideoId(): Promise<string | null> {
  try {
    const res = await fetch(FEED_URL, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate: CACHE_SECONDS },
    });

    if (!res.ok) {
      console.error(`[latest-video] feed returned ${res.status}`);
      return null;
    }

    const xml = await res.text();

    // Entries are newest-first, so the first match is the latest upload. A
    // regex is the right tool here: the shape is fixed, and pulling in an XML
    // parser to read one tag is more surface area than the whole route.
    const match = xml.match(/<yt:videoId>([A-Za-z0-9_-]{11})<\/yt:videoId>/);
    if (!match) {
      console.error('[latest-video] no videoId in feed — channel empty or format changed');
      return null;
    }

    return match[1];
  } catch (err) {
    console.error('[latest-video] feed fetch failed:', err);
    return null;
  }
}
