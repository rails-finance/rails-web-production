import type { LearnMoreContent } from "@/components/shared/learn-more-modal";
import type { CurveEventType } from "@/lib/shared/types/protocols/curve";
import type { UniswapEventType } from "@/lib/shared/types/protocols/uniswap";
import { getSpokeMeta, ARCHETYPE_LABEL } from "@/lib/aave-v4/spoke-meta";
import { FAQ_URLS, AAVE_FAQ_URLS } from "@/components/transaction-timeline/explanation/shared/faqUrls";

// ── CoW Protocol ─────────────────────────────────────────────────────────────

export function cowSwapContent(orderClass?: string | null): LearnMoreContent {
  const isLimit = orderClass === "limit";
  const isMarket = orderClass === "market";

  const extra: string[] = [];
  if (isLimit) {
    extra.push(
      "This is a limit order — it specifies an exact price. It stays open until filled, expired, or cancelled. Solvers only execute when the market reaches the target price. The trader may get a better price if the solver finds a favourable batch.",
    );
  }
  if (isMarket) {
    extra.push(
      "This is a market order — it aims to fill immediately at the best available price. It includes slippage tolerance to protect against unfavourable price movements. Any price improvement (surplus) is typically returned to the trader.",
    );
  }

  return {
    title: `How ${isLimit ? "Limit" : isMarket ? "Market" : "CoW Swap"} Orders Work`,
    intro:
      "CoW Protocol (Coincidence of Wants) is a trading protocol that finds the best execution for an order by batching multiple trades together.",
    stepsHeading: "How it works:",
    steps: [
      "The trader signs an off-chain intent describing what to trade and at what price.",
      'Solvers compete in a batch auction to find the best way to fill the order \u2014 matching traders peer-to-peer (a "Coincidence of Wants") or routing through on-chain liquidity like Uniswap, Curve, or Balancer.',
      "The winning solver submits the settlement on-chain. The trader only pays if the order is filled, and the solver covers gas costs.",
    ],
    extraParagraphs: extra.length > 0 ? extra : undefined,
    detailsHeading: "Key benefits:",
    details: [
      { bold: "MEV protection", text: "off-chain signing prevents front-running and sandwich attacks." },
      { bold: "Gasless trading", text: "the trader signs a message, not a transaction. The solver pays gas." },
      {
        bold: "Surplus",
        text: "if the solver can execute at a price better than the limit, the extra value can be returned to the trader.",
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
        text: "the value of the collateral relative to the debt. Must stay above the liquidation threshold.",
      },
      {
        bold: "Interest rate",
        text: "the borrower chooses the rate. Lower rates save money but increase redemption risk.",
      },
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

// ── Liquity — Live position panel (the trove summary's "?" FAQ) ──────────────
//
// Panel-scoped FAQ for the live trove position card. It consolidates the
// per-bullet "learn more" chain icons that used to sit inline on each
// explanation row into a single standardised "?" modal. Content is keyed to
// what THIS panel surfaces — collateral ratio, interest/delegation, redemption
// exposure, and trove-NFT ownership — so the questions answer the obvious
// "what does this number mean?" without repeating the borrowing/liquidation/
// redemption EVENT modals. Quick Links point at the canonical Liquity docs.
export function liquityPositionContent(opts: {
  collateralType: string;
  status: "open" | "closed" | "liquidated";
  isBatched?: boolean;
}): LearnMoreContent {
  const { collateralType, status, isBatched } = opts;
  const isETH = collateralType === "WETH" || collateralType === "ETH";
  const minCR = isETH ? "110%" : "120%";

  if (status === "liquidated") {
    return {
      title: "About This Position",
      intro:
        "This trove was liquidated when its collateral ratio fell below the minimum threshold. The panel above reconstructs its final state — peak debt, collateral, and how long it stayed open.",
      detailsHeading: "Key concepts:",
      details: [
        {
          bold: "Liquidation threshold",
          text: `a trove is liquidated once its collateral ratio drops below ${minCR} for ${collateralType}. Anyone can trigger the liquidation.`,
        },
        {
          bold: "Trove NFT",
          text: "ownership of a trove is an ERC-721 NFT. One address can hold many troves, each a separate position.",
        },
      ],
      links: [
        { label: "How do liquidations work?", url: FAQ_URLS.LIQUIDATIONS },
        { label: "How many troves can I open with the same address?", url: FAQ_URLS.NFT_TROVES },
      ],
    };
  }

  if (status === "closed") {
    return {
      title: "About This Position",
      intro:
        "This trove has been closed and its debt fully repaid. The panel above shows its lifetime peaks — the most debt and collateral it ever held.",
      detailsHeading: "Key concepts:",
      details: [
        {
          bold: "Closing a trove",
          text: "repaying all debt returns the collateral above the liquidation reserve to the owner and burns the trove NFT.",
        },
        {
          bold: "Trove NFT",
          text: "ownership of a trove is an ERC-721 NFT. One address can hold many troves, each a separate position.",
        },
      ],
      links: [
        { label: "What is a Trove?", url: FAQ_URLS.WHAT_IS_TROVE },
        { label: "How many troves can I open with the same address?", url: FAQ_URLS.NFT_TROVES },
      ],
    };
  }

  // Open trove — the live, interactive case.
  const details: LearnMoreContent["details"] = [
    {
      bold: "Collateral ratio",
      text: `the collateral's USD value relative to the debt. It must stay above ${minCR} for ${collateralType} or the trove can be liquidated.`,
    },
  ];
  if (isBatched) {
    details.push({
      bold: "Interest delegation",
      text: "a batch manager sets this trove's rate and charges a management fee on top of the interest, both accruing to the debt.",
    });
  } else {
    details.push({
      bold: "Interest rate",
      text: "the borrower sets the rate. Lower rates cost less but sit earlier in the redemption queue.",
    });
  }
  details.push(
    {
      bold: "Redemption exposure",
      text: "debt at the same or lower interest rate is redeemed first. The debt-in-front figure is how much shields this trove.",
    },
    {
      bold: "Trove NFT",
      text: "ownership of a trove is an ERC-721 NFT. One address can hold many troves, each a separate position.",
    },
  );

  const links: LearnMoreContent["links"] = [
    { label: "How do I decide on my collateral ratio?", url: FAQ_URLS.LTV_COLLATERAL_RATIO },
  ];
  if (isBatched) {
    links.push({ label: "What is interest-rate delegation?", url: FAQ_URLS.DELEGATION });
  } else {
    links.push({ label: "How do user-set interest rates work?", url: FAQ_URLS.USER_SET_RATES });
  }
  links.push(
    { label: "What happens if my trove gets redeemed?", url: FAQ_URLS.REDEMPTION_SELECTION },
    { label: "How many troves can I open with the same address?", url: FAQ_URLS.NFT_TROVES },
  );

  return {
    title: "About This Position",
    intro:
      "This panel explains the trove's live state in plain language — what backs the debt, what it costs to hold, and how exposed it is to redemption.",
    detailsHeading: "Key concepts:",
    details,
    links,
  };
}

// ── Liquity — Economics panel ────────────────────────────────────────────────
//
// State-explainer for the trove economics panel (carry cost + lifetime debt/
// collateral flows). Scoped to what that panel shows, distinct from the
// position panel's "About this position".
export function liquityEconomicsContent(opts: { isBatched?: boolean } = {}): LearnMoreContent {
  return {
    title: "About the Economics",
    intro:
      "This panel breaks down what the trove costs to carry and traces every unit of debt and collateral that has flowed through it over its lifetime.",
    detailsHeading: "Key concepts:",
    details: [
      {
        bold: "Carrying cost",
        text: opts.isBatched
          ? "the interest plus the delegate's management fee that accrue to the debt each day and year."
          : "the interest that accrues to the debt each day and year at the trove's chosen rate.",
      },
      {
        bold: "Upfront fee",
        text: "a one-time borrowing fee taken when debt is drawn, equivalent to about 7 days of average interest.",
      },
      {
        bold: "Lifetime flows",
        text: "the towers decompose everything that ever moved through the trove — deposited, withdrawn, borrowed, repaid, redeemed, liquidated.",
      },
      {
        bold: "Liquidation reserve",
        text: "0.0375 ETH held back at open to pay liquidators, refunded when the trove closes.",
      },
    ],
    links: [
      { label: "Are there other borrowing fees?", url: FAQ_URLS.BORROWING_FEES },
      { label: "What is the liquidation reserve?", url: FAQ_URLS.LIQUIDATION_RESERVE },
      opts.isBatched
        ? { label: "What is interest-rate delegation?", url: FAQ_URLS.DELEGATION }
        : { label: "How do user-set interest rates work?", url: FAQ_URLS.USER_SET_RATES },
    ],
  };
}

// ── Liquity — Event-card modals (process events) ─────────────────────────────
//
// One content function per mechanic, mapped from operation types by the event
// explainer's resolver. Process-event titles read "How … works"; each follows
// the slot grammar (Intro → Key Concepts → Quick Links) with no instance
// numbers. See learn-more-modal-grammar.md.

export function liquityCloseTroveContent(): LearnMoreContent {
  return {
    title: "How Closing a Trove Works",
    intro:
      "Closing a trove repays its entire debt and returns the collateral, ending the position. The trove's NFT is burned once it closes.",
    detailsHeading: "Key concepts:",
    details: [
      {
        bold: "Full repayment",
        text: "closing requires repaying the whole debt — principal plus accrued interest — in BOLD.",
      },
      {
        bold: "Liquidation reserve",
        text: "the 0.0375 ETH gas reserve set aside when the trove opened is refunded on close.",
      },
      {
        bold: "Trove NFT",
        text: "the NFT representing the position is burned when the trove closes, freeing the slot.",
      },
    ],
    links: [
      { label: "What is a Trove?", url: FAQ_URLS.WHAT_IS_TROVE },
      { label: "What is the liquidation reserve?", url: FAQ_URLS.LIQUIDATION_RESERVE },
      { label: "How many troves can I open with the same address?", url: FAQ_URLS.NFT_TROVES },
    ],
  };
}

export function liquityAdjustTroveContent(): LearnMoreContent {
  return {
    title: "How Adjusting a Trove Works",
    intro:
      "An adjustment changes a trove's collateral or debt without closing it — adding or withdrawing collateral, or borrowing or repaying BOLD.",
    detailsHeading: "Key concepts:",
    details: [
      {
        bold: "Collateral changes",
        text: "depositing more collateral raises the collateral ratio; withdrawing collateral lowers it.",
      },
      {
        bold: "Debt changes",
        text: "borrowing more BOLD increases the debt and may incur a one-time borrowing fee; repaying reduces it.",
      },
      {
        bold: "Collateral ratio",
        text: "every adjustment must leave the trove above its minimum collateral ratio, or it will revert.",
      },
    ],
    links: [
      { label: "How do I decide on my collateral ratio?", url: FAQ_URLS.LTV_COLLATERAL_RATIO },
      { label: "Are there other borrowing fees?", url: FAQ_URLS.BORROWING_FEES },
      { label: "What is a Trove?", url: FAQ_URLS.WHAT_IS_TROVE },
    ],
  };
}

// A trove's rate is controlled either by the borrower directly or, when the
// trove is delegated to a batch manager, by that delegate (it sets one shared
// rate across its batch). `delegated`/`delegateName` come from the position in
// view so the copy names who actually controls THIS trove's rate, rather than
// asserting only the borrower can — see feedback-position-copy-voice.
export function liquityInterestRateContent(opts?: { delegated?: boolean; delegateName?: string }): LearnMoreContent {
  const delegated = opts?.delegated ?? false;
  const delegateLabel = opts?.delegateName ? `the ${opts.delegateName} delegate` : "a batch-manager delegate";
  return {
    title: "How Interest Rates Work",
    intro: delegated
      ? `Each trove carries an annual interest rate that accrues continuously to its debt. This trove's rate is managed by ${delegateLabel} the borrower appointed, which sets one shared rate across a group of troves; the borrower can take back direct control by removing the trove from the batch.`
      : "Each trove carries an annual interest rate that accrues continuously to its debt. The borrower can change the rate at any time, or delegate that to a batch manager that runs one shared rate for a group of troves.",
    detailsHeading: "Key concepts:",
    details: [
      {
        bold: "Who sets the rate",
        text: delegated
          ? "the appointed delegate sets the rate on the borrower's behalf, until the borrower leaves the batch. Lower rates cost less but sit earlier in the redemption queue."
          : "the borrower sets the rate, or delegates it to a batch manager. Lower rates cost less but sit earlier in the redemption queue.",
      },
      {
        bold: "Continuous accrual",
        text: "interest compounds onto the principal over time rather than being charged upfront.",
      },
      {
        bold: "Premium on change",
        text: "changing the rate soon after the last adjustment can incur an upfront premium, discouraging rate-gaming.",
      },
    ],
    links: [
      { label: "How do user-set interest rates work?", url: FAQ_URLS.USER_SET_RATES },
      { label: "What are redemptions?", url: FAQ_URLS.REDEMPTIONS },
    ],
  };
}

export function liquityDelegationContent(): LearnMoreContent {
  return {
    title: "How Interest Delegation Works",
    intro:
      "A trove can delegate interest-rate management to a batch manager — a delegate that sets one shared rate for a group of troves and charges a management fee.",
    detailsHeading: "Key concepts:",
    details: [
      {
        bold: "Batch manager",
        text: "a delegate that sets a single interest rate applied to every trove in its batch.",
      },
      {
        bold: "Management fee",
        text: "an annual fee, on top of the interest, that accrues to the debt as the delegate's compensation.",
      },
      {
        bold: "Joining & leaving",
        text: "a trove can join or exit a batch at any time; leaving returns rate control to the owner.",
      },
    ],
    links: [
      { label: "What is interest-rate delegation?", url: FAQ_URLS.DELEGATION },
      { label: "How do user-set interest rates work?", url: FAQ_URLS.USER_SET_RATES },
    ],
  };
}

export function liquityTransferContent(): LearnMoreContent {
  return {
    title: "How Trove Transfers Work",
    intro: "A trove is an ERC-721 NFT, so its ownership can be transferred to another wallet like any other token.",
    detailsHeading: "Key concepts:",
    details: [
      {
        bold: "Trove NFT",
        text: "ownership of the position is a transferable NFT — whoever holds it controls the trove.",
      },
      {
        bold: "Transfer effects",
        text: "transferring the NFT hands full control of the collateral and debt to the new owner.",
      },
      {
        bold: "Multiple troves",
        text: "one address can hold many troves, each a separate NFT and position.",
      },
    ],
    links: [
      { label: "How many troves can I open with the same address?", url: FAQ_URLS.NFT_TROVES },
      { label: "What is a Trove?", url: FAQ_URLS.WHAT_IS_TROVE },
    ],
  };
}

// Generic Liquity fallback — guarantees the "never empty" floor for any trove
// event without a dedicated modal. Wired as the resolver's default.
export function liquityEventFallbackContent(): LearnMoreContent {
  return {
    title: "How Liquity V2 Troves Work",
    intro:
      "Liquity V2 lets a borrower take out BOLD against collateral in a trove — a self-custodied position represented by an NFT.",
    detailsHeading: "Key concepts:",
    details: [
      {
        bold: "Trove",
        text: "the borrowing position — collateral in, BOLD out, with a collateral ratio to keep above the threshold.",
      },
      {
        bold: "Interest rate",
        text: "a user-set rate that accrues to the debt and sets the trove's place in the redemption queue.",
      },
      {
        bold: "Redemptions",
        text: "BOLD can be redeemed for collateral at face value, starting with the lowest-rate troves.",
      },
    ],
    links: [
      { label: "What is a Trove?", url: FAQ_URLS.WHAT_IS_TROVE },
      { label: "How do user-set interest rates work?", url: FAQ_URLS.USER_SET_RATES },
      { label: "What are redemptions?", url: FAQ_URLS.REDEMPTIONS },
    ],
  };
}

// Generic Aave V4 fallback — the "never empty" floor for any Aave event without
// a dedicated modal (supply / withdraw / borrow / repay / collateral_toggle).
// P2 will replace these with mechanic-specific content.
export function aaveV4EventFallbackContent(): LearnMoreContent {
  return {
    title: "How Aave V4 Positions Work",
    intro:
      "Aave V4 lets a user supply assets as collateral and borrow against them inside an isolated spoke, where one shared health factor governs the whole position.",
    detailsHeading: "Key concepts:",
    details: [
      {
        bold: "Supply & collateral",
        text: "supplied assets earn interest and, when enabled, back the borrowing.",
      },
      {
        bold: "Borrowing & health factor",
        text: "borrowing draws against the collateral; the health factor measures how safely the debt is covered.",
      },
      {
        bold: "Hub & spoke",
        text: "each spoke isolates risk — one shared health factor inside, fully independent between spokes.",
      },
    ],
    links: [
      { label: "Aave V4 positions", url: AAVE_FAQ_URLS.V4_POSITIONS },
      { label: "Health factor & liquidations", url: AAVE_FAQ_URLS.LIQUIDATIONS },
      { label: "Aave FAQ", url: AAVE_FAQ_URLS.FAQ },
    ],
  };
}

// ── Aave V4 — Event-card modals (process events) ─────────────────────────────
//
// Mechanic-specific content mapped from event types by the event explainer's
// resolver. Same slot grammar as the Liquity event modals.

export function aaveV4SupplyContent(): LearnMoreContent {
  return {
    title: "How Supplying Works",
    intro:
      "Supplying deposits an asset into a spoke, where it earns interest and — if enabled as collateral — can back borrowing. Withdrawing reverses it.",
    detailsHeading: "Key concepts:",
    details: [
      {
        bold: "Supplied balance",
        text: "the deposit, which accrues supply interest continuously and stays withdrawable unless it's backing a borrow.",
      },
      {
        bold: "Collateral toggle",
        text: "each supplied asset can be switched on or off as collateral; only collateral-enabled supply supports borrowing.",
      },
      {
        bold: "Withdrawing",
        text: "any supply not currently needed to keep borrows covered can be withdrawn.",
      },
    ],
    links: [
      { label: "Aave V4 positions", url: AAVE_FAQ_URLS.V4_POSITIONS },
      { label: "Supplying assets", url: AAVE_FAQ_URLS.SUPPLYING },
      { label: "Aave FAQ", url: AAVE_FAQ_URLS.FAQ },
    ],
  };
}

export function aaveV4BorrowContent(): LearnMoreContent {
  return {
    title: "How Borrowing Works",
    intro:
      "Borrowing draws an asset against the supplied collateral within a spoke. Repaying returns the asset and frees up that collateral.",
    detailsHeading: "Key concepts:",
    details: [
      {
        bold: "Borrowing power",
        text: "how much can be borrowed depends on the collateral's value weighted by each asset's risk parameters.",
      },
      {
        bold: "Health factor",
        text: "borrowing lowers the health factor; if it falls below 1.0 the position can be liquidated.",
      },
      {
        bold: "Borrow interest",
        text: "debt accrues interest continuously at the asset's borrow rate until it's repaid.",
      },
    ],
    links: [
      { label: "Borrowing assets", url: AAVE_FAQ_URLS.BORROWING },
      { label: "Health factor & liquidations", url: AAVE_FAQ_URLS.LIQUIDATIONS },
      { label: "Aave FAQ", url: AAVE_FAQ_URLS.FAQ },
    ],
  };
}

export function aaveV4CollateralToggleContent(): LearnMoreContent {
  return {
    title: "How Collateral Works",
    intro:
      "Each supplied asset can be enabled or disabled as collateral. Only enabled assets back borrowing and count toward the health factor.",
    detailsHeading: "Key concepts:",
    details: [
      {
        bold: "Collateral toggle",
        text: "turning an asset on lets it back borrows; turning it off removes it from borrowing power.",
      },
      {
        bold: "Health-factor impact",
        text: "disabling collateral lowers the health factor, so it's blocked if doing so would leave the position unsafe.",
      },
      {
        bold: "Isolated per spoke",
        text: "collateral only backs borrows within the same spoke — spokes never share risk.",
      },
    ],
    links: [
      { label: "Aave V4 positions", url: AAVE_FAQ_URLS.V4_POSITIONS },
      { label: "Health factor & liquidations", url: AAVE_FAQ_URLS.LIQUIDATIONS },
      { label: "Aave FAQ", url: AAVE_FAQ_URLS.FAQ },
    ],
  };
}

// Generic Aave position-panel fallback — the "never empty" floor for the spoke
// position panel when a spoke has no editorial metadata. State-explainer, so
// titled "About this position".
export function aaveV4PositionFallbackContent(): LearnMoreContent {
  return {
    title: "About This Position",
    intro:
      "This panel explains an Aave V4 position in plain language — what's supplied as collateral, what's borrowed against it, and how safely the debt is covered.",
    detailsHeading: "Key concepts:",
    details: [
      {
        bold: "Supply & collateral",
        text: "supplied assets earn interest and, when enabled, back the borrowing.",
      },
      {
        bold: "Health factor",
        text: "measures how safely the debt is covered; below 1.0 the position can be liquidated.",
      },
      {
        bold: "Hub & spoke",
        text: "each spoke isolates risk — one shared health factor inside, fully independent between spokes.",
      },
    ],
    links: [
      { label: "Aave V4 positions", url: AAVE_FAQ_URLS.V4_POSITIONS },
      { label: "Health factor & liquidations", url: AAVE_FAQ_URLS.LIQUIDATIONS },
      { label: "Aave FAQ", url: AAVE_FAQ_URLS.FAQ },
    ],
  };
}

// ── Aave V4 — Economics panel ────────────────────────────────────────────────
//
// State-explainer for the spoke economics section (lifetime towers + price
// runways + health factor). Scoped to that section, distinct from the position
// panel's "About this position".
//
// Layer-2 modal: it explains how the economics section works *in general* and
// must read identically on every position — so it takes no per-position arguments
// and never branches on live state (e.g. whether this wallet currently carries
// debt). A supply-only position simply doesn't render the runway sub-section; the
// modal still teaches what it shows. See learn-more-modal-grammar.md §1.
export function aaveV4EconomicsContent(): LearnMoreContent {
  return {
    title: "About the Economics",
    intro:
      "This section traces a position's supply and borrow flows over its lifetime and shows how much price cushion each collateral asset has before liquidation.",
    detailsHeading: "Key concepts:",
    details: [
      {
        bold: "Lifetime flows",
        text: "the towers show every supply, withdrawal, borrow, and repayment over the position's life — not just the current balance.",
      },
      {
        bold: "Price runway",
        text: "for a borrowing position, how far each collateral asset's price can fall before it reaches the liquidation price.",
      },
      {
        bold: "Health factor",
        text: "the single safety number for the whole spoke; a runway is exhausted when the position's health factor would hit 1.0. A position with no borrows has no health factor or liquidation risk to track.",
      },
    ],
    links: [
      { label: "Aave V4 positions", url: AAVE_FAQ_URLS.V4_POSITIONS },
      { label: "Health factor & liquidations", url: AAVE_FAQ_URLS.LIQUIDATIONS },
      { label: "Aave FAQ", url: AAVE_FAQ_URLS.FAQ },
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
        text: "the difference between the expected 1:1 rate and the actual execution price. 1 bps = 0.01%. Positive means the trade got a better price than par.",
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
      ? "Depositing tokens into the Curve BOLD/USDC pool returns LP tokens representing a proportional share of the pool. LPs earn trading fees on every swap proportional to their share."
      : "Withdrawing from a Curve pool burns the LP tokens and returns the underlying assets. Withdrawals can be balanced (both tokens proportionally) or single-sided (one token only).",
    detailsHeading: "Key concepts:",
    details: [
      {
        bold: "LP tokens",
        text: "represent a proportional share of the pool. As fees accumulate, each LP token becomes worth more underlying assets.",
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
        ? "Burning a V3 position removes its liquidity from the pool. The underlying tokens are returned proportionally based on the current price relative to the position's tick range."
        : "Collecting fees from a V3 position gathers accumulated trading fees earned while the price was within its tick range. Fees accrue continuously but must be explicitly collected.",
    detailsHeading: "Key concepts:",
    details: [
      {
        bold: "Tick ranges",
        text: "define the price boundaries of the position. Narrower ranges earn more fees per unit of capital but are more likely to go out of range.",
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
        text: "concentrated positions amplify IL compared to full-range. If the price moves outside the range, the position holds 100% of one token.",
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
      "A depositor places BOLD into one of three Stability Pools (WETH, wstETH, or rETH).",
      "When a Trove in that collateral branch is liquidated, the deposit absorbs a proportional share of the debt.",
      "In return, the depositor receives the liquidated collateral at a discount — typically 5-10% below market price.",
      "The deposit also earns a continuous yield from borrower interest payments in BOLD.",
    ],
    detailsHeading: "Key concepts:",
    details: [
      {
        bold: "Deposit loss",
        text: "when a liquidation occurs, the BOLD balance decreases. This is offset by collateral gained at a discount.",
      },
      {
        bold: "Yield gains",
        text: "the depositor's share of interest payments from borrowers in the same collateral branch.",
      },
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
      "Allocate the voting power to one or more registered initiatives.",
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
      "Withdraw anytime by burning shares to receive the BOLD plus earned yield.",
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

// Page-level explainer for the cross-hub comparison surface (/aave-v4/hubs).
// Layer-2 mechanic only — no snapshot numbers, so it reads identically on any
// block. Concepts mirror what the band + table actually show: hubs, spokes,
// credit lines / utilisation, and the LT range.
export function aaveV4HubsContent(): LearnMoreContent {
  return {
    title: "How hubs and spokes work",
    intro:
      "Aave V4 splits lending into Liquidity Hubs — the shared pools that hold supplied assets and set each market's caps and rates — and Spokes, the markets people supply to and borrow from. A Spoke draws liquidity from a Hub over a credit line, and can hold lines to more than one Hub.",
    detailsHeading: "Key concepts:",
    details: [
      {
        bold: "Liquidity Hub",
        text: "the pool that custodies supplied assets and backs borrowing. Core, Plus and Prime are separate hubs that don't co-mingle liquidity.",
      },
      {
        bold: "Spoke",
        text: "a market users interact with, drawing from a Hub. One spoke can draw from more than one — Bluechip keeps collateral in Prime but borrows from Core.",
      },
      {
        bold: "Credit line & utilisation",
        text: "the cap a Hub grants a Spoke to draw an asset; utilisation is how much of that line is currently drawn.",
      },
      {
        bold: "Liquidation threshold (LT)",
        text: "the share of an asset's value borrowable against it before liquidation; shown as a range when spokes set it differently.",
      },
    ],
    links: [
      { label: "Aave V4 architecture", url: AAVE_FAQ_URLS.V4_ARCHITECTURE },
      { label: "Hubs & liquidity model", url: AAVE_FAQ_URLS.V4_LIQUIDITY_MODEL },
      { label: "Aave V4 docs", url: AAVE_FAQ_URLS.V4_DOCS },
    ],
  };
}
