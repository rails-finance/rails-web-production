import { NextRequest, NextResponse } from "next/server";
import { createAuthFetchOptions } from "@/lib/api/fetch-with-auth";
import type { AaveV4SpokePositionChainResponse } from "@/lib/api/fetch-aave-v4-spoke-position";

const RAILS_API_URL = process.env.RAILS_API_URL;

/**
 * Proxy to rails-server-mig's `/api/aave-v4/spoke-position` (singular)
 * endpoint. Returns gospel-truth on-chain state for a single (wallet, spoke):
 * HF + CF + per-reserve supply/debt balances + collateral toggle status.
 * Backed by Multicall3 against the spoke contract, cached per-block server-side.
 */
export async function GET(request: NextRequest) {
  if (!RAILS_API_URL) {
    console.error("RAILS_API_URL environment variable is not set");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  try {
    const search = request.nextUrl.searchParams.toString();
    const url = `${RAILS_API_URL}/api/aave-v4/spoke-position${search ? `?${search}` : ""}`;
    const response = await fetch(url, createAuthFetchOptions());

    if (!response.ok) {
      console.error(`Backend API error: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        { error: `Backend error: ${response.statusText}` },
        { status: response.status },
      );
    }

    const data: AaveV4SpokePositionChainResponse = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching aave-v4 spoke-position from backend:", error);
    return NextResponse.json({ error: "Failed to fetch spoke position" }, { status: 500 });
  }
}
