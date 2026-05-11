"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Rails Index discovery section — ported from rails-explorer's umbrella.
 * Animates a "Discover Protocols / Assets / Wallets" headline with cycling
 * icons + facehashes, followed by a static diamond-grid showcase strip.
 *
 * The 'View catalogue' link is intentionally omitted — rails-web-mig is
 * single-protocol and has no catalogue surface.
 */

const FACEHASHES = [
  { bg: "#e74c3c", ec: "#e2e8f0", ey: 25, v: 0 },
  { bg: "#3498db", ec: "#e2e8f0", ey: 27, v: 1 },
  { bg: "#f39c12", ec: "#1e293b", ey: 25, v: 2 },
  { bg: "#1abc9c", ec: "#1e293b", ey: 28, v: 3 },
  { bg: "#9b59b6", ec: "#e2e8f0", ey: 26, v: 4 },
  { bg: "#e67e22", ec: "#1e293b", ey: 25, v: 5 },
  { bg: "#2ecc71", ec: "#1e293b", ey: 27, v: 0 },
  { bg: "#e84393", ec: "#e2e8f0", ey: 28, v: 3 },
  { bg: "#00cec9", ec: "#1e293b", ey: 26, v: 1 },
];

const LX = 18, RX = 38;

function eyeSvg(v: number, ey: number, ec: string, bg: string) {
  switch (v) {
    case 0: return <><circle cx={LX} cy={ey} r={5} fill={ec} /><circle cx={RX} cy={ey} r={5} fill={ec} /></>;
    case 1: return <><circle cx={LX} cy={ey} r={3.4} fill={ec} /><circle cx={RX} cy={ey} r={3.4} fill={ec} /></>;
    case 2: return <><line x1={LX - 5} y1={ey} x2={LX + 5} y2={ey} stroke={ec} strokeWidth={3.5} strokeLinecap="round" /><line x1={RX - 5} y1={ey} x2={RX + 5} y2={ey} stroke={ec} strokeWidth={3.5} strokeLinecap="round" /></>;
    case 3: return <><circle cx={LX} cy={ey} r={6} fill={ec} /><circle cx={LX} cy={ey} r={2.5} fill={bg} /><circle cx={RX} cy={ey} r={6} fill={ec} /><circle cx={RX} cy={ey} r={2.5} fill={bg} /></>;
    case 4: return <><path d={`M${LX - 5} ${ey} Q${LX} ${ey - 7} ${LX + 5} ${ey}`} fill={ec} /><path d={`M${RX - 5} ${ey} Q${RX} ${ey - 7} ${RX + 5} ${ey}`} fill={ec} /></>;
    case 5: return <><ellipse cx={LX} cy={ey} rx={3.4} ry={5.6} fill={ec} /><ellipse cx={RX} cy={ey} rx={3.4} ry={5.6} fill={ec} /></>;
    default: return null;
  }
}

const PROTOCOL_ICONS = [
  "/icons/protocols/aave.png", "/icons/protocols/morpho.png", "/icons/protocols/curve.png",
  "/icons/protocols/uniswap.png", "/icons/protocols/compound.png", "/icons/protocols/lido.png",
  "/icons/protocols/convex.png", "/icons/protocols/pendle.png", "/icons/protocols/balancer.png",
  "/icons/protocols/liquity.png",
];

const TOKEN_ICONS = [
  "/icons/tokens/eth.png", "/icons/tokens/usdc.png", "/icons/tokens/dai.png",
  "/icons/tokens/wbtc.png", "/icons/tokens/lqty.png", "/icons/tokens/steth.png",
  "/icons/tokens/crv.png", "/icons/tokens/uni.png", "/icons/tokens/aave.png",
  "/icons/tokens/bold.png",
];

function FacehashSvg({ index, mouth, smile, blinking }: { index: number; mouth?: "o" | "none"; smile?: boolean; blinking?: boolean }) {
  const f = FACEHASHES[index % FACEHASHES.length];
  const isFinal = index === -1;
  const bg = isFinal ? "#a855f7" : f.bg;
  const ec = isFinal ? "#2d1b4e" : f.ec;
  const ey = isFinal ? 25 : f.ey;
  const v = isFinal ? 0 : f.v;

  return (
    <svg viewBox="0 0 56 56" className="w-full h-full rounded-[var(--icon-radius)]">
      <rect width={56} height={56} rx={12} fill={bg} />
      {blinking ? (
        <>
          <line x1={LX - 4} y1={ey} x2={LX + 4} y2={ey} stroke={ec} strokeWidth={2.5} strokeLinecap="round" />
          <line x1={RX - 4} y1={ey} x2={RX + 4} y2={ey} stroke={ec} strokeWidth={2.5} strokeLinecap="round" />
        </>
      ) : (
        eyeSvg(isFinal ? 0 : v, ey, ec, bg)
      )}
      {mouth === "o" && <circle cx={28} cy={38} r={3.5} fill={ec} />}
      {smile && (
        <g transform="translate(28,41)">
          <g>
            <path d="M-7 -4 Q0 4 7 -4" stroke={ec} strokeWidth={3} strokeLinecap="round" fill="none" />
            <animateTransform attributeName="transform" type="scale" from="0" to="1" dur="1s" fill="freeze" />
          </g>
        </g>
      )}
    </svg>
  );
}

function IconSlot({ visible, scale, children }: { visible: boolean; scale?: number; children: React.ReactNode }) {
  return (
    <div
      className="flex items-center justify-center overflow-hidden transition-[width,opacity] duration-[250ms] ease-out"
      style={{
        width: visible ? "var(--icon-size)" : "0px",
        height: "var(--icon-size)",
        opacity: visible ? 1 : 0,
      }}
    >
      <div
        className="flex items-center justify-center transition-transform duration-100 ease-out"
        style={{
          width: "var(--icon-size)",
          height: "var(--icon-size)",
          minWidth: "var(--icon-size)",
          transform: `scale(${scale ?? 1})`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const DIAMOND_PROTOCOLS = [
  "aave-v4", "morpho", "curve", "uniswap", "compound", "lido",
  "convex", "pendle", "balancer", "liquity", "frankencoin",
  "eigenlayer", "spark", "ajna", "euler", "gearbox", "rocketpool",
  "fx", "yearn", "beefy", "aave-v3", "asymmetry", "cow", "ekubo",
  "defidollar", "ebisu", "sbold", "fps", "bold", "uniswap-v3",
];

function DiamondGrid() {
  const TILE = 70;
  const COLS = 28;
  const ROWS = 4;
  const GAP = 4;
  const D = TILE * Math.SQRT2;
  const STEP = D + GAP;
  const HEIGHT = 180;

  const tiles: { left: number; top: number; icon: string; key: string }[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const cx = col * STEP + (row % 2 === 1 ? STEP / 2 : 0);
      const cy = (row + 1) * (STEP / 2);
      tiles.push({
        left: cx - TILE / 2,
        top: cy - TILE / 2,
        icon: DIAMOND_PROTOCOLS[(row * 11 + col * 7) % DIAMOND_PROTOCOLS.length],
        key: `${row}-${col}`,
      });
    }
  }
  const contentW = COLS * STEP;

  return (
    <div className="relative overflow-hidden flex justify-center" style={{ height: HEIGHT }}>
      <div className="relative shrink-0" style={{ width: contentW, height: HEIGHT }}>
        {tiles.map((t) => (
          <div
            key={t.key}
            className="absolute overflow-hidden rounded-xl"
            style={{
              left: t.left,
              top: t.top,
              width: TILE,
              height: TILE,
              transform: "rotate(-45deg)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/icons/protocols/${t.icon}.png`} alt="" className="w-full h-full object-cover" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function IndexSection() {
  const [word, setWord] = useState("Protocols");
  const [cursorVisible, setCursorVisible] = useState(false);

  const [facehashVisible, setFacehashVisible] = useState(false);
  const [facehashIndex, setFacehashIndex] = useState(0);
  const [facehashFinal, setFacehashFinal] = useState(false);
  const [facehashScale, setFacehashScale] = useState(1);
  const [facehashMouth, setFacehashMouth] = useState<"o" | "none">("none");
  const [facehashSmile, setFacehashSmile] = useState(false);
  const [facehashBlinking, setFacehashBlinking] = useState(false);

  const [protocolVisible, setProtocolVisible] = useState(false);
  const [protocolIndex, setProtocolIndex] = useState(0);
  const [protocolScale, setProtocolScale] = useState(1);

  const [tokenVisible, setTokenVisible] = useState(false);
  const [tokenIndex, setTokenIndex] = useState(0);
  const [tokenScale, setTokenScale] = useState(1);

  const iconsHasContent = protocolVisible || tokenVisible || facehashVisible;

  const sectionRef = useRef<HTMLElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const typeW = async (w: string, delay = 80) => {
      for (let i = 0; i <= w.length; i++) {
        setWord(w.slice(0, i));
        await sleep(delay);
      }
    };
    const deleteStr = async (str: string, delay = 30) => {
      for (let i = str.length; i >= 0; i--) {
        setWord(str.slice(0, i));
        await sleep(delay);
      }
    };

    const run = async () => {
      setWord("Protocols");
      await sleep(400);

      setProtocolVisible(true);
      for (let i = 0; i < PROTOCOL_ICONS.length; i++) {
        setProtocolIndex(i); setProtocolScale(0.5);
        await sleep(20); setProtocolScale(1); await sleep(110);
      }
      await sleep(1200);

      setCursorVisible(true);
      await deleteStr("Protocols");
      await sleep(150);
      await typeW("Assets", 40);
      setCursorVisible(false);
      await sleep(400);

      setTokenVisible(true);
      for (let i = 0; i < TOKEN_ICONS.length; i++) {
        setTokenIndex(i); setTokenScale(0.5);
        await sleep(20); setTokenScale(1); await sleep(110);
      }
      await sleep(1200);

      setCursorVisible(true);
      await deleteStr("Assets");
      await sleep(150);
      await typeW("Wallets", 40);
      setCursorVisible(false);
      await sleep(400);

      setFacehashMouth("o");
      setFacehashVisible(true);
      for (let i = 0; i < FACEHASHES.length; i++) {
        setFacehashIndex(i); setFacehashFinal(false); setFacehashScale(0.4);
        await sleep(60); setFacehashScale(1); await sleep(150);
      }
      setFacehashFinal(true); setFacehashMouth("none");
      setFacehashScale(0.5); await sleep(20); setFacehashScale(1);

      await sleep(600); setFacehashSmile(true); await sleep(500);
      setFacehashBlinking(true); await sleep(150); setFacehashBlinking(false);
      await sleep(1500);
      setFacehashBlinking(true); await sleep(150); setFacehashBlinking(false);
      await sleep(1000);

      setCursorVisible(true);
      await deleteStr("Wallets");
      await sleep(150);
      await typeW("Protocols", 40);
      setCursorVisible(false);
      await sleep(300);
      setFacehashVisible(false);
      setTokenVisible(false);
      await sleep(300);
      for (let i = 0; i < PROTOCOL_ICONS.length; i++) {
        setProtocolIndex(i); setProtocolScale(0.5);
        await sleep(20); setProtocolScale(1); await sleep(110);
      }
    };

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          obs.disconnect();
          run();
        }
      },
      { threshold: 0.2 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="relative overflow-hidden bg-rb-100 dark:bg-rb-950">
      <div className="flex flex-col items-center pt-10 pb-6">
        <div className="flex items-center justify-center pb-3 sm:pb-4 px-4 whitespace-nowrap discover-animation-text">
          <span
            className="font-semibold leading-none tracking-tighter text-foreground"
            style={{ fontSize: "var(--text-size)", marginRight: "var(--text-gap)" }}
          >
            Discover
          </span>
          <span
            className="font-semibold leading-none tracking-tighter text-green-500"
            style={{ fontSize: "var(--text-size)" }}
          >
            {word}
          </span>
          <span
            className="inline-block bg-green-500 align-middle"
            style={{
              width: "var(--cursor-w)",
              height: "var(--cursor-h)",
              marginLeft: "2px",
              opacity: cursorVisible ? undefined : 0,
              animation: cursorVisible ? "cursor-blink 0.6s step-end infinite" : "none",
              transition: "opacity 0.5s",
            }}
          />

          <div
            className="flex items-center"
            style={{
              marginLeft: iconsHasContent ? "var(--icon-gap)" : "0",
              transition: "margin-left 0.25s ease",
            }}
          >
            <IconSlot visible={protocolVisible && !tokenVisible && !facehashVisible} scale={protocolScale}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={PROTOCOL_ICONS[protocolIndex]}
                alt=""
                className="w-full h-full object-cover"
                style={{ borderRadius: "var(--icon-radius)" }}
              />
            </IconSlot>

            <IconSlot visible={tokenVisible && !facehashVisible} scale={tokenScale}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={TOKEN_ICONS[tokenIndex]}
                alt=""
                className="w-full h-full object-cover"
                style={{ borderRadius: "var(--icon-radius)" }}
              />
            </IconSlot>

            <IconSlot visible={facehashVisible} scale={facehashScale}>
              {facehashFinal ? (
                <FacehashSvg index={-1} mouth={facehashMouth} smile={facehashSmile} blinking={facehashBlinking} />
              ) : (
                <FacehashSvg index={facehashIndex} />
              )}
            </IconSlot>
          </div>
        </div>

        <p className="text-sm text-center max-w-xl mx-auto px-4 leading-relaxed">
          Browse protocols, trace assets, follow wallets, and simulate outcomes across the Ethereum DeFi network.
        </p>
      </div>

      <div className="pt-2 pb-12" />

      <DiamondGrid />

      <style jsx>{`
        @keyframes cursor-blink {
          50% { opacity: 0; }
        }

        .discover-animation-text {
          --text-size: 22px;
          --icon-size: 19px;
          --icon-radius: 5px;
          --cursor-h: 21px;
          --cursor-w: 2px;
          --text-gap: 6px;
          --icon-gap: 6px;
        }
        @media (min-width: 640px) {
          .discover-animation-text {
            --text-size: 32px;
            --icon-size: 27px;
            --icon-radius: 6px;
            --cursor-h: 29px;
            --text-gap: 10px;
            --icon-gap: 8px;
          }
        }
        @media (min-width: 768px) {
          .discover-animation-text {
            --text-size: 42px;
            --icon-size: 34px;
            --icon-radius: 8px;
            --cursor-h: 37px;
            --text-gap: 11px;
            --icon-gap: 10px;
          }
        }
        @media (min-width: 1024px) {
          .discover-animation-text {
            --text-size: 51px;
            --icon-size: 40px;
            --icon-radius: 9px;
            --cursor-h: 45px;
            --cursor-w: 2px;
            --text-gap: 14px;
            --icon-gap: 11px;
          }
        }
        @media (min-width: 1280px) {
          .discover-animation-text {
            --text-size: 58px;
            --icon-size: 45px;
            --icon-radius: 10px;
            --cursor-h: 51px;
            --cursor-w: 2px;
            --text-gap: 16px;
            --icon-gap: 13px;
          }
        }
      `}</style>
    </section>
  );
}
