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
import { getTroveNftUrl } from "@/lib/utils/nft-utils";
import { HighlightableValue } from "@/components/transaction-timeline/explanation/HighlightableValue";
import { InfoButton } from "@/components/transaction-timeline/explanation/InfoButton";
import { FAQ_URLS } from "@/components/transaction-timeline/explanation/shared/faqUrls";
import { LIQUIDATION_RESERVE_ETH } from "@/components/transaction-timeline/explanation/shared/eventHelpers";

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
  const truncatedTroveId = trove.id.length > 10
    ? `${trove.id.slice(0, 6)}...${trove.id.slice(-4)}`
    : trove.id;
  const duration = formatDuration(trove.activity.createdAt, trove.activity.lastActivityAt);
  const dateRange = formatDateRange(trove.activity.createdAt, trove.activity.lastActivityAt);

  items.push(
    <span key="liquidation" className="text-slate-500">
      Trove ID{" "}
      <HighlightableValue type="troveId" state="after" value={trove.id ? parseInt(trove.id) : undefined}>
        {truncatedTroveId}
      </HighlightableValue>
      {" "}was liquidated when the collateral ratio fell below the minimum threshold ({liquidationThreshold}% for {trove.collateralType})
      {" "}<InfoButton href={FAQ_URLS.LIQUIDATIONS} />
    </span>,
  );

  items.push(
    <span key="lifecycle" className="text-slate-500">
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
      <span key="nft-info" className="text-slate-500">
        The{" "}
        <HighlightableValue type="nftToken" state="after">NFT</HighlightableValue>{" "}
        representing trove{" "}
        <HighlightableValue type="troveId" state="after" value={trove.id ? parseInt(trove.id) : undefined}>
          {`${trove.id.substring(0, 8)}...`}
        </HighlightableValue>{" "}
        was held by{" "}
        <Link
          href={`/troves?ownerAddress=${trove.lastOwner}`}
          className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
        >
          <HighlightableValue type="ownerAddress" state="after">
            {truncatedOwner}
          </HighlightableValue>
        </Link>{" "}
        at the time of liquidation
        <InfoButton href={FAQ_URLS.NFT_TROVES} />
      </span>,
    );
  } else if (nftUrl) {
    items.push(
      <span key="nft-info" className="text-slate-500">
        Trove ownership is represented by an NFT token <InfoButton href={FAQ_URLS.NFT_TROVES} />
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
    <span key="peak-debt" className="text-slate-600 dark:text-slate-500">
      This trove reached a maximum debt of{" "}
      <HighlightableValue type="peakDebt" state="after" value={trove.debt.peak}>
        {formatPrice(trove.debt.peak)} BOLD
      </HighlightableValue>{" "}
      during its lifetime
    </span>,
  );

  items.push(
    <span key="peak-collateral" className="text-slate-600 dark:text-slate-500">
      The highest recorded collateral was{" "}
      <HighlightableValue type="peakCollateral" state="after" value={trove.collateral.peakAmount}>
        {formatPrice(trove.collateral.peakAmount)} {trove.collateralType}
      </HighlightableValue>
    </span>,
  );

  items.push(
    <span key="lifecycle" className="text-slate-600 dark:text-slate-500">
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
    <span key="closure" className="text-slate-600 dark:text-slate-500">
      The trove has been closed and all debt has been repaid. Any collateral above the liquidation reserve was
      returned to the owner
    </span>,
  );

  const nftUrl = getTroveNftUrl(trove.collateralType, trove.id);
  if (nftUrl) {
    items.push(
      <span key="nft-info" className="text-slate-600 dark:text-slate-500">
        Trove ownership is represented by an NFT token
        <a
          href={nftUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="-rotate-45 inline-flex items-center justify-center ml-0.5 bg-slate-200 dark:bg-slate-800 w-4 h-4 rounded-full transition-colors duration-150"
          aria-label="View NFT on OpenSea"
        >
          <Link2 className="w-3 h-3" />
        </a>{" "}
        <InfoButton href={FAQ_URLS.NFT_TROVES} />
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
      <span key="debt-breakdown" className="text-slate-500">
        Current debt of{" "}
        <HighlightableValue type="debt" state="after" value={displayDebt}>
          {formatPrice(displayDebt)} BOLD
        </HighlightableValue>{" "}
        consists of{" "}
        <HighlightableValue type="principal" state="after" value={displayRecordedDebt}>
          {formatPrice(displayRecordedDebt)} BOLD
        </HighlightableValue>{" "}
        principal plus{" "}
        <HighlightableValue type="interest" state="after" value={displayAccruedInterest}>
          {formatPrice(displayAccruedInterest)} BOLD
        </HighlightableValue>{" "}
        accrued interest
        {trove.batch.isMember && displayManagementFee !== undefined && displayManagementFee > 0 && (
          <span>
            {" "}and{" "}
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
      <span key="collateral-info" className="text-slate-500">
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
      <span key="collateral-info" className="text-slate-500">
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
      <span key="collateral-ratio" className="text-slate-500">
        Collateral ratio of{" "}
        <HighlightableValue type="collRatio" state="after" value={parseFloat(currentCollateralRatio)}>
          {currentCollateralRatio}%
        </HighlightableValue>{" "}
        means the collateral is worth {currentCollateralRatio}% more than the debt (minimum {mcr}% to avoid liquidation)
      </span>,
    );
  }

  if (trove.batch.isMember) {
    items.push(
      <span key="delegated-rate" className="text-slate-500">
        <HighlightableValue type="interestRate" state="after" value={displayInterestRate}>
          {displayInterestRate}%
        </HighlightableValue>{" "}
        interest rate managed by{" "}
        <HighlightableValue type="delegateName" state="after">
          {batchManagerInfo?.name || "Batch Manager"}
        </HighlightableValue>
        {batchManagerInfo?.website && (
          <a
            href={batchManagerInfo.website}
            target="_blank"
            rel="noopener noreferrer"
            className="-rotate-45 inline-flex items-center justify-center ml-0.5 bg-blue-500 w-4 h-4 rounded-full transition-colors hover:bg-blue-600 text-white"
            aria-label={`Visit ${batchManagerInfo.name} website`}
          >
            <Link2 className="w-3 h-3" />
          </a>
        )}{" "}
        with +
        <HighlightableValue type="managementFeeRate" state="after" value={trove.batch.managementFee}>
          {trove.batch.managementFee}%
        </HighlightableValue>{" "}
        management fee costing ~
        <HighlightableValue type="dailyManagementFee" state="after" value={dailyManagementFee}>
          {formatPrice(dailyManagementFee)} BOLD
        </HighlightableValue>{" "}
        per day or{" "}
        <HighlightableValue type="annualManagementFee" state="after" value={annualManagementFee}>
          {formatPrice(annualManagementFee)} BOLD
        </HighlightableValue>{" "}
        per year
      </span>,
    );
  } else {
    items.push(
      <span key="self-managed-rate" className="text-slate-500">
        Self-managed interest rate of{" "}
        <HighlightableValue type="interestRate" state="after" value={displayInterestRate}>
          {displayInterestRate}%
        </HighlightableValue>{" "}
        accrues continuously on the principal debt
      </span>,
    );
  }

  items.push(
    <span key="interest-cost" className="text-slate-500">
      {trove.batch.isMember ? "Base interest" : "Current interest"} costs approximately{" "}
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

  if (debtInFront !== null && debtInFront !== undefined) {
    items.push(
      <span key="debt-in-front" className="text-slate-500">
        <span className="font-bold">{formatApproximate(debtInFront)} BOLD</span> of debt sits at the same or lower
        interest rate and is exposed to redemption alongside this trove
        {trovesAhead !== null && trovesAhead !== undefined && (
          <span> ({trovesAhead} other trove{trovesAhead !== 1 ? "s" : ""})</span>
        )}
      </span>,
    );
  }

  if (LIQUIDATION_RESERVE_ETH > 0) {
    items.push(
      <span key="liquidation-reserve" className="text-slate-500">
        <span className="font-bold">{LIQUIDATION_RESERVE_ETH} ETH</span> liquidation reserve set aside and refunded
        when the Trove is closed{" "}
        <InfoButton href={FAQ_URLS.LIQUIDATION_RESERVE} />
      </span>,
    );
  }

  const nftUrl = getTroveNftUrl(trove.collateralType, trove.id);
  if (nftUrl && trove.owner) {
    const truncatedOwner = trove.ownerEns || `${trove.owner.substring(0, 6)}...${trove.owner.substring(38)}`;
    items.push(
      <span key="nft-info" className="text-slate-500">
        A transferable{" "}
        <HighlightableValue type="nftToken" state="after">NFT</HighlightableValue>{" "}
        representing trove{" "}
        <HighlightableValue
          type="troveId"
          state="after"
          value={parseInt(trove.id)}
        >{`${trove.id.substring(0, 8)}...`}</HighlightableValue>{" "}
        is held by wallet{" "}
        <Link
          href={`/troves?ownerAddress=${trove.owner}`}
          className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
        >
          <HighlightableValue type="ownerAddress" state="after">
            {truncatedOwner}
          </HighlightableValue>
        </Link>{" "}
        <InfoButton href={FAQ_URLS.NFT_TROVES} />
      </span>,
    );
  }

  return items;
}
