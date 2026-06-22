"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Link2 } from "lucide-react";
import { TroveSummary } from "@/types/api/trove";
import { TroveStateData } from "@/types/api/troveState";
import { OraclePricesData } from "@/types/api/oracle";
import { formatPrice, formatUsdValue, formatApproximate } from "@/lib/utils/format";
import { formatDateRange, formatDuration } from "@/lib/date";
import { getBatchManagerByAddress } from "@/lib/services/batch-manager-service";
import { getLiquidationThreshold } from "@/lib/utils/liquidation-utils";
import { trovePriceRunwayExplanation } from "@/components/protocol/liquity/trove-price-axis";
import { getTroveNftUrl } from "@/lib/utils/nft-utils";
import { HighlightableValue } from "@/components/transaction-timeline/explanation/HighlightableValue";

interface UseTroveExplanationItemsArgs {
  trove: TroveSummary;
  liveState?: TroveStateData;
  prices?: OraclePricesData;
  debtInFront?: number | null;
  trovesAhead?: number | null;
}

/**
 * Returns the plain-English explanation bullets for a trove's status. Same
 * content that used to live inside each summary card's local useMemo, lifted
 * here so the items can render below the trove identity row instead of
 * inside the card itself. Hover-state isn't a dep — items contain
 * `HighlightableValue` components that subscribe to hover at render time.
 */
export function useTroveExplanationItems({
  trove,
  liveState,
  prices,
  debtInFront,
  trovesAhead,
}: UseTroveExplanationItemsArgs): React.ReactNode[] {
  return useMemo(() => {
    if (trove.status === "liquidated") return buildLiquidatedItems(trove);
    if (trove.status === "closed") return buildClosedItems(trove);
    return buildOpenItems({ trove, liveState, prices, debtInFront, trovesAhead });
  }, [trove, liveState, prices, debtInFront, trovesAhead]);
}

function buildLiquidatedItems(trove: TroveSummary): React.ReactNode[] {
  const items: React.ReactNode[] = [];
  const liquidationThreshold = getLiquidationThreshold(trove.collateralType);
  const truncatedTroveId = trove.id.length > 10 ? `${trove.id.slice(0, 6)}...${trove.id.slice(-4)}` : trove.id;
  const duration = formatDuration(trove.activity.createdAt, trove.activity.lastActivityAt);
  const dateRange = formatDateRange(trove.activity.createdAt, trove.activity.lastActivityAt);

  items.push(
    <span key="liquidation" className="text-rb-500">
      Trove ID{" "}
      <HighlightableValue type="troveId" state="after" value={trove.id ? parseInt(trove.id) : undefined}>
        {truncatedTroveId}
      </HighlightableValue>{" "}
      was liquidated when the collateral ratio fell below the minimum threshold ({liquidationThreshold}% for{" "}
      {trove.collateralType})
    </span>,
  );

  items.push(
    <span key="lifecycle" className="text-rb-500">
      Trove was active for{" "}
      <HighlightableValue type="duration" state="after">
        {duration}
      </HighlightableValue>{" "}
      before liquidation from{" "}
      <HighlightableValue type="dateRange" state="after">
        {dateRange}
      </HighlightableValue>
    </span>,
  );

  const nftUrl = getTroveNftUrl(trove.collateralType, trove.id);
  if (nftUrl && trove.lastOwner) {
    const truncatedOwner = trove.ownerEns || `${trove.lastOwner.substring(0, 6)}...${trove.lastOwner.substring(38)}`;
    items.push(
      <span key="nft-info" className="text-rb-500">
        The{" "}
        <HighlightableValue type="nftToken" state="after">
          NFT
        </HighlightableValue>{" "}
        representing trove{" "}
        <HighlightableValue type="troveId" state="after" value={trove.id ? parseInt(trove.id) : undefined}>
          {`${trove.id.substring(0, 8)}...`}
        </HighlightableValue>{" "}
        was held by{" "}
        <Link
          href={`/liquity-v2?ownerAddress=${trove.lastOwner}`}
          className="hover:text-foreground dark:hover:text-rb-200 transition-colors"
        >
          <HighlightableValue type="ownerAddress" state="after">
            {truncatedOwner}
          </HighlightableValue>
        </Link>{" "}
        at the time of liquidation
      </span>,
    );
  } else if (nftUrl) {
    items.push(
      <span key="nft-info" className="text-rb-500">
        Trove ownership is represented by an NFT token
      </span>,
    );
  }

  return items;
}

function buildClosedItems(trove: TroveSummary): React.ReactNode[] {
  const items: React.ReactNode[] = [];
  const duration = formatDuration(trove.activity.createdAt, trove.activity.lastActivityAt);
  const durationInSeconds =
    (new Date(trove.activity.lastActivityAt).getTime() - new Date(trove.activity.createdAt).getTime()) / 1000;

  items.push(
    <span key="peak-debt" className="text-rb-500">
      This trove reached a maximum debt of{" "}
      <HighlightableValue type="peakDebt" state="after" value={trove.debt.peak}>
        {formatPrice(trove.debt.peak)} BOLD
      </HighlightableValue>{" "}
      during its lifetime
    </span>,
  );

  items.push(
    <span key="peak-collateral" className="text-rb-500">
      The highest recorded collateral was{" "}
      <HighlightableValue type="peakCollateral" state="after" value={trove.collateral.peakAmount}>
        {formatPrice(trove.collateral.peakAmount)} {trove.collateralType}
      </HighlightableValue>
    </span>,
  );

  items.push(
    <span key="lifecycle" className="text-rb-500">
      Trove was active for{" "}
      <HighlightableValue type="duration" state="after" value={durationInSeconds}>
        {duration}
      </HighlightableValue>{" "}
      from{" "}
      <HighlightableValue
        type="dateRange"
        state="after"
        value={`${trove.activity.createdAt}-${trove.activity.lastActivityAt}`}
      >
        {formatDateRange(trove.activity.createdAt, trove.activity.lastActivityAt)}
      </HighlightableValue>
    </span>,
  );

  items.push(
    <span key="closure" className="text-rb-500">
      The trove has been closed and all debt has been repaid. Any collateral above the liquidation reserve was returned
      to the owner
    </span>,
  );

  const nftUrl = getTroveNftUrl(trove.collateralType, trove.id);
  if (nftUrl) {
    items.push(
      <span key="nft-info" className="text-rb-500">
        Trove ownership is represented by an NFT token
      </span>,
    );
  }

  return items;
}

function buildOpenItems({
  trove,
  liveState,
  prices,
  debtInFront,
  trovesAhead,
}: UseTroveExplanationItemsArgs): React.ReactNode[] {
  const items: React.ReactNode[] = [];
  const batchManagerInfo = getBatchManagerByAddress(trove.batch.manager);

  const displayDebt = liveState?.debt.entire ?? trove.debt.current;
  const displayRecordedDebt = liveState?.debt.recorded ?? trove.debt.current;
  const displayAccruedInterest = liveState?.debt.accruedInterest;
  const displayInterestRate = liveState?.rates.annualInterestRate ?? trove.metrics.interestRate;
  const displayManagementFee = liveState?.rates.accruedBatchManagementFee;
  const displayCollateral = liveState?.collateral.entire ?? trove.collateral.amount;

  const annualInterestCost = (displayRecordedDebt * displayInterestRate) / 100;
  const dailyInterestCost = annualInterestCost / 365;
  const annualManagementFee = (displayRecordedDebt * trove.batch.managementFee) / 100;
  const dailyManagementFee = annualManagementFee / 365;

  const hasLiveData = liveState && prices;
  const collateralTokenKey = trove.collateralType.toLowerCase() as keyof OraclePricesData;
  const currentPrice = hasLiveData ? prices[collateralTokenKey] : null;
  const collateralUsd = hasLiveData && currentPrice ? displayCollateral * currentPrice : null;
  const collateralRatio = hasLiveData && collateralUsd && displayDebt > 0 ? (collateralUsd / displayDebt) * 100 : null;
  const mcr = getLiquidationThreshold(trove.collateralType);

  if (displayAccruedInterest !== undefined) {
    items.push(
      <span key="debt-breakdown" className="text-rb-500">
        Current debt of{" "}
        <HighlightableValue type="debt" state="after" value={displayDebt}>
          {formatPrice(displayDebt)} BOLD
        </HighlightableValue>{" "}
        consists of{" "}
        <HighlightableValue type="principal" state="after" value={displayRecordedDebt}>
          {formatPrice(displayRecordedDebt)} BOLD
        </HighlightableValue>{" "}
        carried debt plus{" "}
        <HighlightableValue type="interest" state="after" value={displayAccruedInterest}>
          {formatPrice(displayAccruedInterest)} BOLD
        </HighlightableValue>{" "}
        interest accrued since the last event
        {trove.batch.isMember && displayManagementFee !== undefined && displayManagementFee > 0 && (
          <span>
            {" "}
            and{" "}
            <HighlightableValue type="managementFee" state="after" value={displayManagementFee}>
              {formatPrice(displayManagementFee)} BOLD
            </HighlightableValue>{" "}
            delegate fees
          </span>
        )}
      </span>,
    );
  }

  if (hasLiveData && currentPrice && collateralUsd) {
    items.push(
      <span key="collateral-info" className="text-rb-500">
        <HighlightableValue type="collateral" state="after" value={displayCollateral}>
          {displayCollateral} {trove.collateralType}
        </HighlightableValue>{" "}
        collateral worth{" "}
        <HighlightableValue type="collateralUsd" state="after" value={collateralUsd}>
          {formatUsdValue(collateralUsd)}
        </HighlightableValue>{" "}
        at current price of{" "}
        <HighlightableValue type="currentPrice" state="after" value={currentPrice}>
          {formatUsdValue(currentPrice)}
        </HighlightableValue>{" "}
        / {trove.collateralType} secures this position
      </span>,
    );
  } else {
    items.push(
      <span key="collateral-info" className="text-rb-500">
        <HighlightableValue type="collateral" state="after" value={displayCollateral}>
          {displayCollateral} {trove.collateralType}
        </HighlightableValue>{" "}
        collateral secures this position
      </span>,
    );
  }

  if (hasLiveData && collateralRatio) {
    const currentCollateralRatio = collateralRatio.toFixed(1);
    items.push(
      <span key="collateral-ratio" className="text-rb-500">
        Collateral ratio of{" "}
        <HighlightableValue type="collRatio" state="after" value={parseFloat(currentCollateralRatio)}>
          {currentCollateralRatio}%
        </HighlightableValue>{" "}
        means the collateral is worth {currentCollateralRatio}% more than the debt (minimum {mcr}% to avoid liquidation)
      </span>,
    );
  }

  // Liquidation-price runway gloss — the footnote for the runway bar that now
  // lives in the position card beneath the stats (moved up from the economics
  // panel so the gauge sits with the current-state numbers it reads).
  const liqPrice =
    hasLiveData && currentPrice && displayCollateral > 0
      ? (displayRecordedDebt * (mcr / 100)) / displayCollateral
      : null;
  if (currentPrice && liqPrice && liqPrice > 0) {
    items.push(
      <span key="price-runway" className="text-rb-500">
        {trovePriceRunwayExplanation({
          collateralSymbol: trove.collateralType,
          debtSymbol: "BOLD",
          oraclePrice: currentPrice,
          liquidationPrice: liqPrice,
        })}
      </span>,
    );
  }

  if (trove.batch.isMember) {
    // Rate + delegate + cost folded into one bullet: the interest rate, who
    // manages it and at what fee, and what the base interest plus delegate fee
    // actually cost — one continuous thought rather than two split bullets.
    items.push(
      <span key="rate-cost" className="text-rb-500">
        <HighlightableValue type="interestRate" state="after" value={displayInterestRate}>
          {displayInterestRate}%
        </HighlightableValue>{" "}
        interest rate managed by{" "}
        {batchManagerInfo?.website ? (
          <a
            href={batchManagerInfo.website}
            target="_blank"
            rel="noopener noreferrer"
            title={`Visit ${batchManagerInfo.name} website`}
            className="inline-flex items-center gap-0.5 hover:text-pink-500 transition-colors"
          >
            <HighlightableValue type="delegateName" state="after">
              {batchManagerInfo.name}
            </HighlightableValue>
            <Link2 size={11} className="-rotate-45" aria-hidden="true" />
          </a>
        ) : (
          <HighlightableValue type="delegateName" state="after">
            {batchManagerInfo?.name || "Batch Manager"}
          </HighlightableValue>
        )}{" "}
        with a +
        <HighlightableValue type="managementFeeRate" state="after" value={trove.batch.managementFee}>
          {trove.batch.managementFee}%
        </HighlightableValue>{" "}
        management fee. Base interest costs approximately{" "}
        <HighlightableValue type="dailyInterest" state="after" value={dailyInterestCost}>
          {formatPrice(dailyInterestCost)} BOLD
        </HighlightableValue>{" "}
        per day or{" "}
        <HighlightableValue type="annualInterest" state="after" value={annualInterestCost}>
          {formatPrice(annualInterestCost)} BOLD
        </HighlightableValue>{" "}
        per year, plus{" "}
        <HighlightableValue type="dailyManagementFee" state="after" value={dailyManagementFee}>
          {formatPrice(dailyManagementFee)} BOLD
        </HighlightableValue>{" "}
        per day or{" "}
        <HighlightableValue type="annualManagementFee" state="after" value={annualManagementFee}>
          {formatPrice(annualManagementFee)} BOLD
        </HighlightableValue>{" "}
        per year in delegate fees
      </span>,
    );
  } else {
    items.push(
      <span key="rate-cost" className="text-rb-500">
        Self-managed interest rate of{" "}
        <HighlightableValue type="interestRate" state="after" value={displayInterestRate}>
          {displayInterestRate}%
        </HighlightableValue>{" "}
        accrues continuously on the principal debt, costing approximately{" "}
        <HighlightableValue type="dailyInterest" state="after" value={dailyInterestCost}>
          {formatPrice(dailyInterestCost)} BOLD
        </HighlightableValue>{" "}
        per day or{" "}
        <HighlightableValue type="annualInterest" state="after" value={annualInterestCost}>
          {formatPrice(annualInterestCost)} BOLD
        </HighlightableValue>{" "}
        per year
      </span>,
    );
  }

  if (debtInFront !== null && debtInFront !== undefined) {
    items.push(
      <span key="debt-in-front" className="text-rb-500">
        <span className="font-bold text-foreground">{formatApproximate(debtInFront)} BOLD</span> of debt sits at the same
        or lower
        interest rate and is exposed to redemption alongside this trove
        {trovesAhead !== null && trovesAhead !== undefined && (
          <span>
            {" "}
            ({trovesAhead} other trove{trovesAhead !== 1 ? "s" : ""})
          </span>
        )}
      </span>,
    );
  }

  // Liquidation reserve moved to the economics panel's footnote — it's a
  // closing-accounting figure, not a headline-stat elaboration.

  const nftUrl = getTroveNftUrl(trove.collateralType, trove.id);
  if (nftUrl && trove.owner) {
    const truncatedOwner = trove.ownerEns || `${trove.owner.substring(0, 6)}...${trove.owner.substring(38)}`;
    items.push(
      <span key="nft-info" className="text-rb-500">
        A transferable{" "}
        <a
          href={nftUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="View NFT on OpenSea"
          className="inline-flex items-center gap-0.5 hover:text-pink-500 transition-colors"
        >
          <HighlightableValue type="nftToken" state="after">
            NFT
          </HighlightableValue>
          <Link2 size={11} className="-rotate-45" aria-hidden="true" />
        </a>{" "}
        representing trove{" "}
        <HighlightableValue
          type="troveId"
          state="after"
          value={parseInt(trove.id)}
        >{`${trove.id.substring(0, 8)}...`}</HighlightableValue>{" "}
        is held by wallet{" "}
        <Link
          href={`/liquity-v2?ownerAddress=${trove.owner}`}
          className="hover:text-foreground dark:hover:text-rb-200 transition-colors"
        >
          <HighlightableValue type="ownerAddress" state="after">
            {truncatedOwner}
          </HighlightableValue>
        </Link>
      </span>,
    );
  }

  return items;
}
