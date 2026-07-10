import { NextRequest, NextResponse } from "next/server";
import { createAuthFetchOptions } from "@/lib/api/fetch-with-auth";

const RAILS_API_URL = process.env.RAILS_API_URL;

/**
 * Proxy to rails-server-production's `/api/liquity-v2/debt-in-front`. Returns the
 * on-chain Liquity V2 redemption buffer for a single trove: total
 * accrued-inclusive BOLD debt at rates <= this trove's (in its own branch,
 * excluding itself) plus the count of troves at or below that rate. Backed by
 * MultiTroveGetter over RPC, cached server-side.
 */
export async function GET(request: NextRequest) {
  if (!RAILS_API_URL) {
    console.error("RAILS_API_URL environment variable is not set");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  try {
    const search = request.nextUrl.searchParams.toString();
    const url = `${RAILS_API_URL}/api/liquity-v2/debt-in-front${search ? `?${search}` : ""}`;
    const response = await fetch(url, createAuthFetchOptions());

    if (!response.ok) {
      console.error(`Backend API error: ${response.status} ${response.statusText}`);
      return NextResponse.json({ error: `Backend error: ${response.statusText}` }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching liquity-v2 debt-in-front from backend:", error);
    return NextResponse.json({ error: "Failed to fetch debt in front" }, { status: 500 });
  }
}
