import { NextResponse } from "next/server";
import { createAuthFetchOptions } from "@/lib/api/fetch-with-auth";
import type { AaveV4AssetUniverseResponse } from "@/lib/api/fetch-aave-v4-asset-universe";

const RAILS_API_URL = process.env.RAILS_API_URL;

/**
 * Proxy to rails-server-mig's `/api/aave-v4/asset-universe`. Returns the
 * distinct set of token symbols ever seen with a non-zero balance across
 * mv_aave_v4_spoke_positions. Powers the Supplying / Borrowing multi-select
 * pills on /aave-v4. The Express handler short-TTL-caches (5 min) since the
 * universe shifts only when reserves enter or leave usage.
 */
export async function GET() {
  if (!RAILS_API_URL) {
    console.error("RAILS_API_URL environment variable is not set");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  try {
    const url = `${RAILS_API_URL}/api/aave-v4/asset-universe`;
    const response = await fetch(url, createAuthFetchOptions());

    if (!response.ok) {
      console.error(`Backend API error: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        { error: `Backend error: ${response.statusText}` },
        { status: response.status },
      );
    }

    const data: AaveV4AssetUniverseResponse = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching aave-v4 asset-universe from backend:", error);
    return NextResponse.json({ error: "Failed to fetch asset universe" }, { status: 500 });
  }
}
