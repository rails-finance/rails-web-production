// ============================================================================
// EVENT SHAPE — frontend consumer copy.
// ============================================================================
//
// ⚠️ DUPLICATED FILE. The canonical declaration lives in rails-server-mig at
// api/src/types/event-shape.ts. This copy must stay byte-for-byte in sync
// (modulo this header comment). When the API adds a new ProtocolId / arm to
// ProtocolContext, mirror it here.
//
// Why duplicated and not a shared package: rails-server-mig and rails-web-mig
// are separate top-level git repos. A real workspace package would require
// either a monorepo consolidation or a published private npm dependency —
// both bigger commitments than phase 1 should make. Type drift is caught the
// moment a TypeScript error fires on either side.
//
// Promote both copies to a shared workspace package when monorepo
// consolidation lands.

// ───────────────────────── Base primitives ─────────────────────────

/** A single token movement within a transaction. */
export interface AssetFlow {
  /** Contract address (lowercase). */
  token: string;
  /** Human-readable symbol. */
  tokenSymbol: string;
  tokenDecimals: number;
  /** Raw amount as string (bigint-safe). */
  amount: string;
  /** Human-readable decimal number. */
  amountFormatted: number;
  direction: "in" | "out";
  /** Protocol contract or counterparty wallet involved in this flow. */
  counterparty?: string;
  /** USD value at time of event, if known. */
  valueUsd?: number;
}

export interface GasCost {
  gasUsed?: number;
  gasCostEth: number;
  gasCostUsd: number;
}

/** Same-block operation grouping info. */
export interface BlockGrouping {
  /** True if multiple operations in same block. */
  isGrouped: boolean;
  /** Total operations in this block. */
  sameBlockCount: number;
  /** 1-based position within block. */
  sameBlockIndex: number;
}

// ───────────────────────── Liquity V2 detail types ─────────────────────────

export type LiquityOperationType =
  | "openTrove"
  | "closeTrove"
  | "adjustTrove"
  | "adjustTroveInterestRate"
  | "applyPendingDebt"
  | "liquidate"
  | "redeemCollateral"
  | "openTroveAndJoinBatch"
  | "setInterestBatchManager"
  | "removeFromBatch"
  | "transferTrove"
  | "setBatchManagerAnnualInterestRate"
  | "adjustZombieTrove"
  | "adjustUnredeemableZombieTrove";

export type LiquityEventType =
  | "trove"
  | "liquidation"
  | "redemption"
  | "transfer"
  | "batch_manager";

export type BatchOperationType =
  | "registerBatchManager"
  | "lowerBatchManagerAnnualFee"
  | "setBatchManagerAnnualInterestRate"
  | "applyBatchInterestAndFee"
  | "joinBatch"
  | "exitBatch"
  | "troveChange";

export type CollateralType = string;

export interface TroveState {
  debt: number;
  coll: number;
  stake: number;
  annualInterestRate: number;
  /** Backend-calculated: (coll × price) / debt × 100. */
  collateralRatio: number;
  /** Total collateral value in USD. */
  collateralInUsd: number;
  /** From BatchedTroveUpdated. */
  interestBatchManager?: string;
  /** From BatchedTroveUpdated, converted to number. */
  batchDebtShares?: number;
}

export interface TroveOperationData {
  annualInterestRate: number;
  debtIncreaseFromRedist: number;
  debtIncreaseFromUpfrontFee: number;
  debtChangeFromOperation: number;
  collIncreaseFromRedist: number;
  collChangeFromOperation: number;
}

export interface BatchUpdateData {
  operation: BatchOperationType;
  batchDebt: number;
  batchColl: number;
  annualInterestRate: number;
  annualManagementFee: number;
  totalDebtShares: number;
  interestBatchManager?: string;
}

export interface LiquidationDetail {
  debtOffsetBySP: number;
  debtRedistributed: number;
  boldGasCompensation: number;
  collGasCompensation: number;
  collSentToSP: number;
  collRedistributed: number;
  collSurplus: number;
  price: number;
}

export interface RedemptionDetail {
  attemptedBoldAmount: number;
  actualBoldAmount: number;
  ETHSent: number;
  ETHFee: string;
  price: number;
  redemptionPrice: number;
  redemptionFee: string;
}

export interface TransferDetail {
  transferType: "mint" | "burn" | "transfer";
  fromAddress: string;
  toAddress: string;
}

/** Full Liquity V2 protocol context for granular event rendering. */
export interface LiquityContext {
  eventType: LiquityEventType;
  operation: LiquityOperationType;
  troveId: string;
  collateralType: CollateralType;
  collateralPrice: number;
  protocolName: string; // "liquity-v2"
  assetType: string;    // "BOLD"

  stateBefore: TroveState;
  stateAfter: TroveState;

  isInBatch: boolean;
  batchManager?: string;
  isZombieTrove: boolean;
  batchUpdate?: BatchUpdateData;

  /** Present for all except pure transfer events. */
  troveOperation?: TroveOperationData;

  /** Set on liquidation events. */
  liquidation?: LiquidationDetail;
  /** Set on redemption events. */
  redemption?: RedemptionDetail;
  /** Set on transfer events. */
  transfer?: TransferDetail;

  /** For redeemer's view — who owns the redeemed trove. */
  troveOwner?: string;
  /** For trove owner's view — who initiated the redemption. */
  redeemer?: string;

  /** Trove-centric view: who performed this action. */
  actorRole?: "owner" | "redeemer" | "liquidator" | "batch_manager";
  actorAddress?: string;

  blockGrouping: BlockGrouping;
}

// ───────────────────────── Aave V4 detail types ─────────────────────────

export type AaveV4EventType =
  | "supply"
  | "withdraw"
  | "borrow"
  | "repay"
  | "liquidation"
  | "collateral_toggle";

/** One row of the snapshot table — a single (asset, balance) tuple held in
 *  this spoke at the event block, with an optional historic USD price. The
 *  price is keyed by (asset_address, block_number) and carries the same
 *  provenance enum as the primary-asset `ctx.price` field. Renderers should
 *  drive the USD chip off `item.price`, falling back to "no chip" when
 *  absent (analog to how the primary-asset chip behaves). */
export interface AaveV4SnapshotItem {
  symbol: string;
  amount: string;
  price?: { usd: number; source: AaveV4PriceSource };
}

/** Mirror of rails-explorer's lib/shared/types/protocols/aave-v4.ts.
 *  Numeric fields ship as strings to preserve precision across the wire. */
export interface AaveV4Context {
  eventType: AaveV4EventType;
  /** Amount in reserve token (human-readable). */
  amount?: string;
  /** Reserve token symbol (resolved from reserve_id). */
  reserveSymbol?: string;
  /** Spoke display name ("Main", "Bluechip", …). */
  spokeName?: string;
  /** Spoke contract address (lowercase). */
  spokeAddress?: string;
  /** collateral_toggle: whether collateral was enabled. */
  enabled?: boolean;
  /** liquidation: collateral reserve symbol. */
  collateralSymbol?: string;
  /** liquidation: debt covered. */
  debtToCover?: string;
  /** liquidation: collateral seized. */
  liquidatedCollateralAmount?: string;
  /** liquidation: liquidator address. */
  liquidator?: string;
  /** Running supply balance before this event (human-readable). */
  supplyBefore?: string;
  /** Running supply balance after this event (human-readable). */
  supplyAfter?: string;
  /** Running debt balance before this event (human-readable). */
  debtBefore?: string;
  /** Running debt balance after this event (human-readable). */
  debtAfter?: string;
  /** All non-zero supply positions in this spoke after the event. Each item
   *  optionally carries the asset's USD price at the event block — populated
   *  when an `aave_v4_historic_prices` row exists for (asset_address,
   *  block_number) and is in the categorical-allowlist (chainlink /
   *  iaave-oracle / stablecoin). `defillama` rows are wire-stripped. */
  allSupplies?: AaveV4SnapshotItem[];
  /** All non-zero debt positions in this spoke after the event. Same
   *  per-item price plumbing as `allSupplies`. */
  allDebts?: AaveV4SnapshotItem[];
  /** Same-tx supply + collateral_toggle merge — drives the
   *  "Supply & Enable Collateral" card. */
  alsoToggledCollateral?: boolean;
  /** Effective supply APR derived from share/amount index changes. */
  supplyAPR?: string;
  /** Effective borrow APR derived from share/amount index changes. */
  borrowAPR?: string;
  /** USD price of the event's primary asset at the event's block. Populated
   *  on supply/withdraw/borrow/repay/collateral_toggle. Liquidation rows use
   *  `collateralPrice` + `debtPrice` instead. Number is the float-precision
   *  USD value (e.g. 2876.57); source indicates provenance. */
  price?: { usd: number; source: AaveV4PriceSource };
  /** Liquidation rows only — USD price of the collateral asset at event block. */
  collateralPrice?: { usd: number; source: AaveV4PriceSource };
  /** Liquidation rows only — USD price of the debt asset at event block. */
  debtPrice?: { usd: number; source: AaveV4PriceSource };
}

/** Provenance of an Aave V4 historic price. Drives the UI's
 *  approximate-vs-protocol-faithful chip.
 *
 *  Categorical model (current):
 *    - `chainlink` — Chainlink USD aggregator round at the event block.
 *      Used for the bluechip USD-feed allowlist (WETH, WBTC, cbBTC, AAVE,
 *      EURC, LINK, USDC, USDT, XAUt). Same value Aave's oracle returned
 *      within nominal accuracy; no `≈` prefix on the chip.
 *    - `chainlink-eth-derived` — ETH/USD × on-chain LST→ETH exchange rate.
 *      Used for ETH-liquid-staking wrappers (wstETH, weETH) where Aave's
 *      own oracle composes the same calculation internally. Block-aligned
 *      via the LST contract's view method. No `≈` prefix.
 *    - `iaave-oracle` — protocol-faithful read from IAaveOracle. Reserved
 *      for if/when a working V4 forward writer lands; not currently
 *      producing rows. No `≈` prefix.
 *    - `stablecoin` — hard-pinned to $1.00 for the known stable set.
 *      Approximate by definition; `≈` prefix.
 *    - `defillama` — DEPRECATED. DefiLlama-aggregated CEX/DEX price.
 *      The transformer drops these rows from the wire response so the UI
 *      never sees them; the source remains in the enum so historical
 *      rows in `aave_v4_historic_prices` still parse if you query them
 *      directly. */
export type AaveV4PriceSource =
  | "chainlink"
  | "chainlink-eth-derived"
  | "iaave-oracle"
  | "stablecoin"
  | "defillama";

// ───────────────────────── Generic / unknown ─────────────────────────

export interface OtherContext {
  contractAddress: string;
  contractName: string | null;
  eventCount: number;
  /** Auto-classified protocol from contract name patterns. */
  inferredProtocol?: string | null;
}

// ───────────────────────── Protocol identity ─────────────────────────
//
// ProtocolId and ProtocolContext are designed to grow as new protocol
// transformers come online. When a new protocol gets a transformer, add
// its id to ProtocolId and a discriminant arm to ProtocolContext. The
// frontend duplicate must mirror these additions.

export type ProtocolId = "liquity-v2-troves" | "aave-v4" | "other";

/** Full protocol-specific detail, discriminated by `protocol`. */
export type ProtocolContext =
  | { protocol: "liquity-v2-troves"; data: LiquityContext }
  | { protocol: "aave-v4"; data: AaveV4Context }
  | { protocol: "other"; data: OtherContext };

// ───────────────────────── The unified event ─────────────────────────

export interface BaseActivityEvent {
  /** Unique ID — typically txHash + ":" + logIndex. */
  id: string;

  // ── On-chain coordinates ──
  txHash: string;
  blockNumber: number;
  /** Unix timestamp in seconds. */
  timestamp: number;

  // ── Who and where ──
  /** Initiating wallet address (lowercase). */
  wallet: string;
  /** Protocol this event belongs to. */
  protocol: ProtocolId;

  // ── What happened ──
  /** Protocol-specific but consistent within each protocol (e.g. "openTrove"). */
  actionType: string;
  /** Human display label (e.g. "Open Trove"). */
  actionLabel: string;

  // ── Token movements ──
  flows: AssetFlow[];

  // ── Costs ──
  gas?: GasCost;

  // ── Links ──
  etherscanUrl: string;

  // ── Protocol-specific detail ──
  context?: ProtocolContext;

  /** If true, event is hidden by default (e.g. contract-internal movements). */
  hidden?: boolean;
}

/** A chronologically sorted list of events, optionally per-wallet. */
export interface ActivityTimeline {
  events: BaseActivityEvent[];
  /** Protocols represented in this timeline. */
  protocols: ProtocolId[];
  /** Wallet address if this is a per-wallet timeline. */
  wallet?: string;
}

// ───────────────────────── Type guards ─────────────────────────

export function isLiquityEvent(
  e: BaseActivityEvent,
): e is BaseActivityEvent & {
  context: { protocol: "liquity-v2-troves"; data: LiquityContext };
} {
  return (
    e.context?.protocol === "liquity-v2-troves" &&
    !!(e.context.data as LiquityContext)?.collateralType
  );
}

export function isAaveV4Event(
  e: BaseActivityEvent,
): e is BaseActivityEvent & {
  context: { protocol: "aave-v4"; data: AaveV4Context };
} {
  return e.context?.protocol === "aave-v4";
}

