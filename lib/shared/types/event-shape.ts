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
// transformers come online. Phase 1: Liquity V2 only. When a new protocol
// gets a transformer, add its id to ProtocolId and a discriminant arm to
// ProtocolContext. The frontend duplicate must mirror these additions.

export type ProtocolId = "liquity-v2-troves" | "other";

/** Full protocol-specific detail, discriminated by `protocol`. */
export type ProtocolContext =
  | { protocol: "liquity-v2-troves"; data: LiquityContext }
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
