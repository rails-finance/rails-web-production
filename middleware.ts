import { NextResponse, type NextRequest } from "next/server";
import { slugifySpoke, spokeFromSlug } from "@/lib/aave-v4/spoke-meta";

// Legacy → canonical 308 for Aave V4 spoke detail URLs.
//
// Lives in middleware (rather than next.config.ts → redirects) because
// `redirects` matches case-insensitively: a literal `source: "Main"` rule
// would also catch the canonical `main` slug and self-loop. Here we resolve
// the segment programmatically — if it's already a known slug we pass
// through, otherwise we try to slugify the display name and redirect.
//
// Bookmarks landing on the encoded display-name shape
// (`/aave-v4/spoke/Ethena%20Ecosystem/0x…`) get upgraded to the kebab slug
// (`/aave-v4/spoke/ethena-ecosystem/0x…`).
//
// The page itself also has a `spokeFromSlug(rawSpoke) ?? decodeURIComponent`
// fallback as a belt-and-braces — middleware catches the common case before
// the page renders, the fallback covers exotic encodings the middleware
// misses (mixed case, future-renamed spokes, etc).

const SPOKE_PATH_RE = /^\/aave-v4\/spoke\/([^/]+)\/(0x[0-9a-fA-F]{40})\/?$/;

export function middleware(req: NextRequest) {
  const m = SPOKE_PATH_RE.exec(req.nextUrl.pathname);
  if (!m) return NextResponse.next();

  const [, rawSegment, wallet] = m;
  // Already canonical? Bail without rewriting (avoids self-loop).
  if (spokeFromSlug(rawSegment)) return NextResponse.next();

  // Try to interpret the raw segment as a display name. `req.nextUrl.pathname`
  // preserves percent-encoding, so `Ethena%20Ecosystem` arrives literally and
  // needs decoding before SPOKE_NAME_TO_SLUG can match it.
  let decoded: string;
  try {
    decoded = decodeURIComponent(rawSegment);
  } catch {
    return NextResponse.next();
  }
  const slug = slugifySpoke(decoded);
  if (!slug) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = `/aave-v4/spoke/${slug}/${wallet}`;
  return NextResponse.redirect(url, 308);
}

export const config = {
  matcher: ["/aave-v4/spoke/:path*"],
};
