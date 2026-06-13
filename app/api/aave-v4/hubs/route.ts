import { NextResponse } from "next/server";
import { createAuthFetchOptions } from "@/lib/api/fetch-with-auth";
import type { AaveV4HubsResponse } from "@/lib/api/fetch-aave-v4-hubs";

const RAILS_API_URL = process.env.RAILS_API_URL;

/**
 * Proxy to rails-server-mig's `/api/aave-v4/hubs`. Powers the cross-hub
 * comparison surface at /aave-v4/hubs — the three V4 hubs' credit lines, caps,
 * utilisation and active-position counts, side by side.
 *
 * No query params; one cacheable payload for everyone. The Express handler
 * short-TTL-caches (60s) since the credit-line / cap data is governance-rare
 * and utilisation only needs hour-scale freshness on a reference surface.
 */
export async function GET() {
  if (!RAILS_API_URL) {
    console.error("RAILS_API_URL environment variable is not set");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  try {
    const url = `${RAILS_API_URL}/api/aave-v4/hubs`;
    const response = await fetch(url, createAuthFetchOptions());

    if (!response.ok) {
      console.error(`Backend API error: ${response.status} ${response.statusText}`);
      return NextResponse.json({ error: `Backend error: ${response.statusText}` }, { status: response.status });
    }

    const data: AaveV4HubsResponse = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching aave-v4 hubs from backend:", error);
    return NextResponse.json({ error: "Failed to fetch hubs" }, { status: 500 });
  }
}
