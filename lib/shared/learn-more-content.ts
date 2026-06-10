import type { LearnMoreContent } from "@/components/shared/learn-more-modal";
import type { CurveEventType } from "@/lib/shared/types/protocols/curve";
import type { UniswapEventType } from "@/lib/shared/types/protocols/uniswap";
import { getSpokeMeta, ARCHETYPE_LABEL } from "@/lib/aave-v4/spoke-meta";

// ── CoW Protocol ─────────────────────────────────────────────────────────────

export function cowSwapContent(orderClass?: string | null): LearnMoreContent {
  const isLimit = orderClass === "limit";
  const isMarket = orderClass === "market";

  const extra: string[] = [];
  if (isLimit) {
    extra.push(
      "This is a limit order — it specifies an exact price. It stays open until filled, expired, or cancelled. Solvers only execute when the market reaches the target price. You may get a better price if the solver finds a favourable batch.",
    );
  }
  if (isMarket) {
    extra.push(
      "This is a market order — it aims to fill immediately at the best available price. It includes slippage tolerance to protect against unfavourable price movements. Any price improvement (surplus) is typically returned to you.",
    );
  }

  return {
    title: `How ${isLimit ? "Limit" : isMarket ? "Market" : "CoW Swap"} Orders Work`,
    intro:
      "CoW Protocol (Coincidence of Wants) is a trading protocol that finds the best execution for your order by batching multiple trades together.",
    stepsHeading: "How it works:",
    steps: [
      "You sign an off-chain intent describing what you want to trade and at what price.",
      'Solvers compete in a batch auction to find the best way to fill your order \u2014 matching traders peer-to-peer (a "Coincidence of Wants") or routing through on-chain liquidity like Uniswap, Curve, or Balancer.',
      "The winning solver submits the settlement on-chain. You only pay if your order is filled, and the solver covers gas costs.",
    ],
    extraParagraphs: extra.length > 0 ? extra : undefined,
    detailsHeading: "Key benefits:",
    details: [
      { bold: "MEV protection", text: "off-chain signing prevents front-running and sandwich attacks." },
      { bold: "Gasless trading", text: "you sign a message, not a transaction. The solver pays gas." },
      {
        bold: "Surplus",
        text: "if the solver can execute at a price better than your limit, the extra value can be returned to you.",
      },
      { bold: "Batch settlement", text: "multiple orders settle in a single transaction, reducing overall costs." },
    ],
  };
}

// ── Liquity — Redemptions ────────────────────────────────────────────────────

export function liquityRedemptionContent(collateralType?: string, interestRate?: number): LearnMoreContent {
  const rateNote =
    interestRate != null
      ? ` This Trove's ${interestRate}% rate was among the lowest in the ${collateralType ?? "collateral"} branch at redemption time.`
      : "";

  return {
    title: "How Redemptions Work",
    intro: `Redemptions allow BOLD holders to exchange BOLD for collateral at face value ($1 per BOLD). This mechanism helps maintain BOLD's USD peg \u2014 if BOLD trades below $1, arbitrageurs (typically automated bots) profit by buying cheap BOLD and redeeming it for $1 worth of collateral. Troves are redeemed in ascending order of interest rates (lowest first).${rateNote}`,
    video: {
      label: "9 min video",
      url: "https://www.youtube.com/watch?v=CQVmjFx987A",
      description:
        "Watch this video on redemptions from Liquity to understand how they work and how to manage redemption risk.",
    },
    links: [
      {
        label: "What are redemptions?",
        url: "https://docs.liquity.org/v2-faq/redemptions-and-delegation#what-are-redemptions",
      },
      {
        label: "What happens if my Trove gets redeemed?",
        url: "https://docs.liquity.org/v2-faq/redemptions-and-delegation#what-happens-if-my-trove-gets-redeemed",
      },
      {
        label: "How can I stay protected?",
        url: "https://docs.liquity.org/v2-faq/redemptions-and-delegation#how-can-i-stay-protected",
      },
      {
        label: "Is there a redemption fee?",
        url: "https://docs.liquity.org/v2-faq/redemptions-and-delegation#is-there-a-redemption-fee",
      },
    ],
  };
}

// ── Liquity — Liquidations ───────────────────────────────────────────────────

export function liquityLiquidationContent(collateralType?: string): LearnMoreContent {
  const isETH = collateralType === "WETH" || collateralType === "ETH";
  const minCR = isETH ? "110%" : "120%";
  const maxLTV = isETH ? "90.91%" : "83.33%";

  return {
    title: "How Liquidations Work",
    intro: `Troves become eligible for liquidation when the collateral ratio falls below the minimum threshold (${minCR} for ${collateralType ?? "this collateral"}, equivalent to a maximum ${maxLTV} LTV). Once eligible, anyone can trigger a liquidation transaction.`,
    extraParagraphs: [
      "If the Stability Pool has sufficient BOLD, it absorbs the debt and receives the collateral. Otherwise, debt and collateral are redistributed proportionally to other active borrowers in the same market.",
      "Liquidators receive a 5% incentive on the debt cleared, plus a gas compensation of 0.0375 WETH. Any remaining collateral above what is needed to cover debt + penalty is claimable by the original borrower as surplus.",
    ],
    links: [
      {
        label: "How do liquidations work?",
        url: "https://docs.liquity.org/v2-faq/borrowing-and-liquidations#how-do-liquidations-work-in-liquity-v2",
      },
      {
        label: "What is the liquidation threshold?",
        url: "https://docs.liquity.org/v2-faq/borrowing-and-liquidations#how-do-liquidations-work-in-liquity-v2",
      },
      {
        label: "How does the Stability Pool work?",
        url: "https://docs.liquity.org/v2-faq/borrowing-and-liquidations#how-do-liquidations-work-in-liquity-v2",
      },
    ],
  };
}

// ── Liquity — Open Trove / Borrowing ─────────────────────────────────────────

export function liquityOpenTroveContent(): LearnMoreContent {
  return {
    title: "How Borrowing Works",
    intro:
      "Liquity V2 allows users to borrow BOLD (a decentralized stablecoin) by depositing collateral into a Trove. The Trove is represented by an NFT that provides full control over the position. The interest rate set at opening determines redemption risk \u2014 higher rates provide better protection against redemptions but cost more over time.",
    detailsHeading: "Key concepts:",
    details: [
      {
        bold: "Collateral ratio",
        text: "the value of your collateral relative to your debt. Must stay above the liquidation threshold.",
      },
      { bold: "Interest rate", text: "you choose your own rate. Lower rates save money but increase redemption risk." },
      {
        bold: "Upfront fee",
        text: "a one-time borrowing fee equivalent to 7 days of average interest, deducted from the borrowed amount.",
      },
      {
        bold: "Liquidation reserve",
        text: "0.0375 ETH set aside to incentivise liquidators. Refunded when the Trove is closed.",
      },
    ],
    video: {
      label: "video guide",
      url: "https://www.youtube.com/watch?v=o1miCKLIPYs",
      description: "Learn how to borrow on Liquity and manage a Trove effectively.",
    },
    links: [
      { label: "What is a Trove?", url: "https://docs.liquity.org/v2-faq/borrowing-and-liquidations#what-is-a-trove" },
      {
        label: "Understanding borrowing fees",
        url: "https://docs.liquity.org/v2-faq/borrowing-and-liquidations#are-there-any-other-fees-related-to-borrowing",
      },
      {
        label: "What is the liquidation reserve?",
        url: "https://docs.liquity.org/v2-faq/borrowing-and-liquidations#what-is-the-refundable-gas-deposit",
      },
      {
        label: "How user-set interest rates work",
        url: "https://docs.liquity.org/v2-faq/borrowing-and-liquidations#what-are-user-set-rates",
      },
    ],
  };
}

// ── Aave V4 — Spoke architecture ─────────────────────────────────────────────

// Generic, per-spoke-type explainer for the Aave V4 Hub & Spoke model. The copy
// is keyed purely by spoke name (archetype, hub mapping, narrative) and carries
// nothing about the wallet's position, so it belongs in the shared Learn-More
// modal rather than inline on the card. Returns null for spokes without
// editorial metadata so the caller can omit the "?" affordance.
export function aaveV4SpokeContent(spokeName: string): LearnMoreContent | null {
  const meta = getSpokeMeta(spokeName);
  if (!meta) return null;

  const sameHub = meta.collateralHub === meta.borrowHub;
  const hubMapping = sameHub
    ? `Collateral and borrows both sit in the ${meta.collateralHub} Hub.`
    : `Collateral sits in the ${meta.collateralHub} Hub, while borrows are drawn from the ${meta.borrowHub} Hub.`;
  const archetype = ARCHETYPE_LABEL[meta.archetype];

  const extraParagraphs = [...meta.narrative];
  if (meta.rateNote) extraParagraphs.push(meta.rateNote);

  return {
    title: `How the ${meta.name} Spoke Works`,
    intro: `${archetype} — ${meta.name} on Aave V4's Hub & Spoke model. ${hubMapping}`,
    extraParagraphs,
  };
}

// ── Aave V4 — Liquidations ───────────────────────────────────────────────────

// Generic explainer for Aave V4 liquidations. The mechanism is identical across
// every spoke and hub, so this carries nothing wallet-specific; an optional
// spokeName only adds the shared "which spoke this touched" framing (still the
// same for every wallet on that spoke). Reused by every liquidation event card.
export function aaveV4LiquidationContent(spokeName?: string): LearnMoreContent {
  const meta = spokeName ? getSpokeMeta(spokeName) : null;
  const marketNote = meta
    ? ` This liquidation happened on the ${meta.name} spoke — under Aave V4's Hub & Spoke model it only touches collateral and debt inside that spoke, so positions on other spokes are unaffected.`
    : " Under Aave V4's Hub & Spoke model a liquidation only touches collateral and debt inside the affected spoke, so positions on other spokes are unaffected.";

  return {
    title: "How Liquidations Work",
    intro:
      "An Aave V4 position becomes eligible for liquidation when its health factor falls below 1.0 — the point where the borrowed value, measured against each collateral asset's liquidation threshold, is no longer sufficiently covered. Once eligible, anyone (in practice, automated liquidator bots) can step in.",
    extraParagraphs: [
      "A liquidator repays part of the outstanding debt and, in return, receives an equivalent value of the borrower's collateral plus a liquidation bonus — so the collateral seized is worth more than the debt cleared. That bonus is the liquidator's incentive and the borrower's effective penalty." +
        marketNote,
      "Health factor = (collateral value × each asset's liquidation threshold) ÷ total debt. To stay safe, keep it comfortably above 1.0 by holding more collateral or carrying less debt; falling collateral prices or rising debt both push it down.",
    ],
    links: [
      { label: "Health factor & liquidations", url: "https://aave.com/help/borrowing/liquidations" },
      { label: "Liquidations in Aave V4", url: "https://aave.com/docs/aave-v4/positions/liquidations" },
      { label: "Aave FAQ", url: "https://aave.com/faq" },
    ],
  };
}

// ── Curve ────────────────────────────────────────────────────────────────────

export function curveSwapContent(): LearnMoreContent {
  return {
    title: "How Curve StableSwap Works",
    intro:
      "Curve's StableSwap invariant is designed specifically for assets that should trade near parity — like BOLD and USDC. It concentrates liquidity around the 1:1 price, enabling very low slippage on stablecoin swaps compared to constant-product AMMs like Uniswap.",
    detailsHeading: "Key concepts:",
    details: [
      {
        bold: "StableSwap invariant",
        text: "a bonding curve tuned for pegged assets. Trades near parity use a flat (constant-sum) curve; larger deviations shift towards a constant-product curve, increasing slippage as protection.",
      },
      {
        bold: "Effective price",
        text: "the actual rate received after the pool's bonding curve pricing. For BOLD/USDC, 1.0000 means the trade executed exactly at peg.",
      },
      {
        bold: "Slippage (basis points)",
        text: "the difference between the expected 1:1 rate and the actual execution price. 1 bps = 0.01%. Positive means you got a better price than par.",
      },
      {
        bold: "Pool fee",
        text: "Curve charges a small fee on each swap (typically 1–4 bps for stableswap pools), distributed to LPs.",
      },
      {
        bold: "Size categories",
        text: "whale (>$100K), large ($10K–$100K), medium ($1K–$10K), small (<$1K). Larger swaps move the price more.",
      },
    ],
    links: [
      { label: "Curve StableSwap whitepaper", url: "https://curve.fi/whitepaper" },
      { label: "BOLD/USDC pool on Curve", url: "https://curve.fi/#/ethereum/pools" },
    ],
  };
}

export function curveLiquidityContent(eventType: CurveEventType): LearnMoreContent {
  const isAdd = eventType === "add";
  const isRemoveOne = eventType === "remove_one";
  const isRemoveImbalance = eventType === "remove_imbalance";

  const extra: string[] = [];
  if (isRemoveOne) {
    extra.push(
      "This is a single-sided withdrawal — all liquidity is removed as one token. The pool rebalances internally, which can cause slippage if the withdrawal is large relative to pool reserves.",
    );
  }
  if (isRemoveImbalance) {
    extra.push(
      "This is an imbalanced withdrawal — tokens are removed in a custom ratio rather than the pool's current balance. This may incur a small fee proportional to the imbalance.",
    );
  }

  return {
    title: isAdd ? "How Curve Liquidity Provision Works" : "How Curve Liquidity Withdrawal Works",
    intro: isAdd
      ? "When you deposit tokens into the Curve BOLD/USDC pool, you receive LP tokens representing your share of the pool. LPs earn trading fees on every swap proportional to their share."
      : "Withdrawing from a Curve pool burns your LP tokens and returns the underlying assets. You can withdraw balanced (both tokens proportionally) or single-sided (one token only).",
    detailsHeading: "Key concepts:",
    details: [
      {
        bold: "LP tokens",
        text: "represent your proportional share of the pool. As fees accumulate, each LP token becomes worth more underlying assets.",
      },
      {
        bold: "Balanced vs single-sided",
        text: "balanced deposits/withdrawals match the pool's current ratio and incur no slippage. Single-sided operations cause the pool to rebalance, which may cost a small fee.",
      },
      {
        bold: "Impermanent loss",
        text: "if BOLD depegs significantly from USDC, LPs end up holding more of the cheaper asset. For stableswap pools this risk is minimal under normal conditions.",
      },
      {
        bold: "Fee income",
        text: "LPs earn a share of every swap fee. In a BOLD/USDC pool, fee income grows with trading volume.",
      },
    ],
    extraParagraphs: extra.length > 0 ? extra : undefined,
    links: [
      { label: "Curve LP guide", url: "https://resources.curve.fi/lp/understanding-curve-pools/" },
      { label: "Understanding impermanent loss", url: "https://resources.curve.fi/lp/understanding-curve-pools/" },
    ],
  };
}

export function getCurveLearnMore(eventType: CurveEventType): LearnMoreContent {
  if (eventType === "swap") return curveSwapContent();
  return curveLiquidityContent(eventType);
}

// ── Uniswap V3 ───────────────────────────────────────────────────────────────

export function uniswapSwapContent(): LearnMoreContent {
  return {
    title: "How Uniswap V3 Swaps Work",
    intro:
      "Uniswap V3 uses concentrated liquidity — LPs choose specific price ranges to provide liquidity. This means more capital efficiency near the current price, but trades that move the price significantly may cross multiple tick ranges and experience varying slippage.",
    detailsHeading: "Key concepts:",
    details: [
      {
        bold: "Concentrated liquidity",
        text: "unlike V2's full-range liquidity, V3 LPs choose tick ranges. More capital near the current price means better rates for traders.",
      },
      {
        bold: "Fee tiers",
        text: "pools can have different fee tiers (0.01%, 0.05%, 0.3%, 1%). The BOLD/USDC pool uses 0.05%, typical for stable pairs.",
      },
      {
        bold: "Effective price",
        text: "the actual rate received. For BOLD/USDC, 1.0000 means the trade executed exactly at peg.",
      },
      {
        bold: "Price impact",
        text: "larger trades consume liquidity across ticks, potentially crossing into ranges with less liquidity and worse rates.",
      },
    ],
    links: [{ label: "Uniswap V3 concepts", url: "https://docs.uniswap.org/concepts/protocol/concentrated-liquidity" }],
  };
}

export function uniswapLiquidityContent(eventType: UniswapEventType): LearnMoreContent {
  const isMint = eventType === "mint";
  const isBurn = eventType === "burn";

  return {
    title: isMint
      ? "How V3 Liquidity Provision Works"
      : isBurn
        ? "How V3 Liquidity Removal Works"
        : "How Fee Collection Works",
    intro: isMint
      ? "In Uniswap V3, LPs provide liquidity within a specific price range (tick range). The position only earns fees when the price is within that range, but capital is used much more efficiently than full-range liquidity."
      : isBurn
        ? "Burning a V3 position removes your liquidity from the pool. The underlying tokens are returned proportionally based on the current price relative to your tick range."
        : "Collecting fees from a V3 position gathers accumulated trading fees earned while the price was within your tick range. Fees accrue continuously but must be explicitly collected.",
    detailsHeading: "Key concepts:",
    details: [
      {
        bold: "Tick ranges",
        text: "define the price boundaries of your position. Narrower ranges earn more fees per unit of capital but are more likely to go out of range.",
      },
      {
        bold: "Concentrated vs full-range",
        text: "concentrated positions (narrow ranges) are more capital efficient. Full-range mimics V2 behavior but earns less per dollar deployed.",
      },
      {
        bold: "Fee collection",
        text: "earned fees are not automatically compounded. They must be collected via a separate transaction.",
      },
      {
        bold: "Impermanent loss",
        text: "concentrated positions amplify IL compared to full-range. If the price moves outside your range, you hold 100% of one token.",
      },
    ],
    links: [{ label: "Uniswap V3 LP guide", url: "https://docs.uniswap.org/concepts/protocol/concentrated-liquidity" }],
  };
}

export function getUniswapLearnMore(eventType: UniswapEventType): LearnMoreContent {
  if (eventType === "swap") return uniswapSwapContent();
  return uniswapLiquidityContent(eventType);
}

// ── Stability Pool ──────────────────────────────────────────────────────────

export function getStabilityLearnMore(): LearnMoreContent {
  return {
    title: "How the Stability Pool Works",
    intro:
      "The Stability Pool is the first line of defence in Liquity V2. Depositors provide BOLD which is used to absorb debt from liquidated Troves. In return, depositors earn collateral at a discount and a share of borrower interest payments.",
    stepsHeading: "How it works:",
    steps: [
      "You deposit BOLD into one of three Stability Pools (WETH, wstETH, or rETH).",
      "When a Trove in that collateral branch is liquidated, your deposit absorbs a proportional share of the debt.",
      "In return, you receive the liquidated collateral at a discount — typically 5-10% below market price.",
      "You also earn a continuous yield from borrower interest payments in BOLD.",
    ],
    detailsHeading: "Key concepts:",
    details: [
      {
        bold: "Deposit loss",
        text: "when a liquidation occurs, your BOLD balance decreases. This is offset by collateral gained at a discount.",
      },
      { bold: "Yield gains", text: "your share of interest payments from borrowers in the same collateral branch." },
      { bold: "Collateral gains", text: "discounted collateral received from liquidations — the main profit source." },
    ],
  };
}

// ── Governance ───────────────────────────────────────────────────────────────

export function getGovernanceLearnMore(): LearnMoreContent {
  return {
    title: "How Liquity V2 Governance Works",
    intro:
      "Liquity V2 uses an epoch-based governance system where LQTY holders stake and vote to direct BOLD incentives to registered initiatives. Each epoch lasts one week.",
    stepsHeading: "How it works:",
    steps: [
      "Stake LQTY in the governance contract to receive voting power.",
      "Allocate your voting power to one or more registered initiatives.",
      "At the end of each epoch, BOLD incentives are distributed proportionally to initiatives based on their vote share.",
      "Initiatives claim their BOLD allocation and use it according to their purpose (e.g., liquidity incentives, protocol development).",
    ],
    detailsHeading: "Key concepts:",
    details: [
      { bold: "Epochs", text: "fixed 7-day periods that govern voting cycles and BOLD distribution." },
      {
        bold: "Initiatives",
        text: "registered smart contracts that can receive BOLD incentives through governance votes.",
      },
      {
        bold: "Veto power",
        text: "LQTY can be allocated as veto votes to oppose an initiative, reducing its effective vote share.",
      },
    ],
  };
}

// ── Vaults ───────────────────────────────────────────────────────────────────

export function getVaultsLearnMore(): LearnMoreContent {
  return {
    title: "How BOLD Yield Vaults Work",
    intro:
      "BOLD yield vaults (Yearn V3 and sBOLD) are ERC-4626 tokenized vaults that deposit BOLD into yield-generating strategies. Depositors receive shares that increase in value as yield accrues.",
    stepsHeading: "How it works:",
    steps: [
      "Deposit BOLD into the vault and receive vault shares in return.",
      "The vault deploys BOLD into yield strategies (e.g., Stability Pool deposits, lending).",
      "As strategies earn yield, the share price increases — each share represents more BOLD.",
      "Withdraw anytime by burning shares to receive your BOLD plus earned yield.",
    ],
    detailsHeading: "Key concepts:",
    details: [
      { bold: "Share price", text: "the ratio of total assets to total shares. Increases as yield accrues." },
      {
        bold: "Strategy reports",
        text: "periodic updates from yield strategies reporting gains, losses, and current debt.",
      },
      { bold: "ERC-4626", text: "a standard interface for tokenized vaults, ensuring compatibility across DeFi." },
    ],
  };
}
