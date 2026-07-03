import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Shared "Explore X on Rails" Open Graph renderer.
 *
 * The artwork (rails tracks, Rails wordmark, rails.finance, gradient) is baked
 * into `public/og/bg.png` — a 1200×630 template with a blank 1040×200 content
 * window at (70, 130). This module only overlays the variable content: an
 * optional protocol icon and the title, rendered as a single left-aligned
 * icon+text UNIT that is then centred within the window.
 *
 * Copy rule: "Explore ‹Protocol› ‹Qualifier?› on Rails". ‹Protocol› (e.g.
 * "Aave V4") and ‹Qualifier› (e.g. "Paxos Hub", a spoke/branch/product name)
 * are BLUE and never break internally; the framing words are white.
 */

// ── Canvas + content-window geometry (see bg.png) ──────────────────────────
export const OG_SIZE = { width: 1200, height: 630 } as const;
const BOX = { left: 70, top: 130, width: 1040, height: 200 } as const;

// ── Palette ────────────────────────────────────────────────────────────────
const WHITE = "#ffffff";
const BLUE = "#3b82f6"; // --color-blue-500, the Rails brand/link blue

// ── Icon + type ─────────────────────────────────────────────────────────────
const ICON = 150; // rendered tile size (source art is 225×225)
const ICON_RADIUS = 34;
const GAP = 28; // icon → text gap; part of the ≤1040 unit width
const TEXT_MAX = BOX.width - ICON - GAP; // width the text column may occupy

// A title chunk carries its own colour; a whole line never wraps internally.
type Chunk = { text: string; blue?: boolean };
type Line = Chunk[];

// ── Asset loading (module-scoped; read once per lambda) ─────────────────────
const asset = (...p: string[]) => join(process.cwd(), "public", ...p);

let fontsPromise: Promise<Array<{ name: string; data: Buffer; weight: 800; style: "normal" }>> | null = null;
function loadFonts() {
  fontsPromise ??= (async () => [
    {
      name: "Inter",
      data: await readFile(asset("og", "fonts", "Inter-ExtraBold.woff")),
      weight: 800 as const,
      style: "normal" as const,
    },
  ])();
  return fontsPromise;
}

const bgCache = new Map<string, Promise<string>>();
function dataUrl(...p: string[]) {
  const key = p.join("/");
  let hit = bgCache.get(key);
  if (!hit) {
    hit = readFile(asset(...p)).then((b) => `data:image/png;base64,${b.toString("base64")}`);
    bgCache.set(key, hit);
  }
  return hit;
}

// ── Fit: pick the largest font size that keeps every line within TEXT_MAX and
// the whole block within the content window. Inter ExtraBold advance ≈ 0.55em;
// a conservative factor avoids overflow without a real measurement pass. ─────
function fitFontSize(lines: Line[]): number {
  const longest = Math.max(...lines.map((l) => l.reduce((n, c) => n + c.text.length, 0)));
  for (const size of [72, 64, 56, 50, 44, 40]) {
    const widest = longest * size * 0.55;
    const tall = lines.length * size * 1.12;
    if (widest <= TEXT_MAX && tall <= BOX.height) return size;
  }
  return 40;
}

/**
 * Build the default two-line title from a protocol and optional qualifier:
 *   no qualifier → ["Explore ‹Protocol›", "on Rails"]
 *   qualifier    → ["Explore ‹Protocol›", "‹Qualifier› on Rails"]
 * Blue groups are emitted as single chunks so they never split across a line.
 */
export function buildTitleLines(protocol: string, qualifier?: string): Line[] {
  const line1: Line = [{ text: "Explore " }, { text: protocol, blue: true }];
  const line2: Line = qualifier ? [{ text: qualifier, blue: true }, { text: " on Rails" }] : [{ text: "on Rails" }];
  return [line1, line2];
}

export type ExploreOgInput = {
  /** public-relative icon path, e.g. ["icons","protocols","aave-v4.png"]. */
  icon?: string[];
  protocol: string;
  qualifier?: string;
  /** Override the auto two-line layout entirely. */
  lines?: Line[];
};

export async function renderExploreOg({ icon, protocol, qualifier, lines }: ExploreOgInput) {
  const titleLines = lines ?? buildTitleLines(protocol, qualifier);
  const fontSize = fitFontSize(titleLines);
  const [fonts, bg, iconSrc] = await Promise.all([
    loadFonts(),
    dataUrl("og", "bg.png"),
    icon ? dataUrl(...icon) : Promise.resolve(null),
  ]);

  return new ImageResponse(
    (
      <div style={{ position: "relative", display: "flex", width: OG_SIZE.width, height: OG_SIZE.height }}>
        <img src={bg} width={OG_SIZE.width} height={OG_SIZE.height} style={{ position: "absolute", top: 0, left: 0 }} />
        {/* content window (70,130,1040,200) — centre the icon+text unit inside it */}
        <div
          style={{
            position: "absolute",
            left: BOX.left,
            top: BOX.top,
            width: BOX.width,
            height: BOX.height,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: GAP, maxWidth: BOX.width }}>
            {iconSrc ? <img src={iconSrc} width={ICON} height={ICON} style={{ borderRadius: ICON_RADIUS }} /> : null}
            <div style={{ display: "flex", flexDirection: "column" }}>
              {titleLines.map((line, i) => (
                <div key={i} style={{ display: "flex", fontSize, lineHeight: 1.1, letterSpacing: -1.5 }}>
                  {line.map((c, j) => (
                    <span key={j} style={{ color: c.blue ? BLUE : WHITE, whiteSpace: "pre" }}>
                      {c.text}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts },
  );
}
