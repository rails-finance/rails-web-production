import { NextResponse } from "next/server";
import { createAuthFetchOptions } from "@/lib/api/fetch-with-auth";
import type { LlamalendMarket } from "@/lib/api/fetch-llamalend";

const RAILS_API_URL = process.env.RAILS_API_URL;

interface MarketsResponse {
  markets: LlamalendMarket[];
  totalMarkets: number;
}

export async function GET() {
  if (!RAILS_API_URL) {
    console.error("RAILS_API_URL environment variable is not set");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  try {
    const response = await fetch(`${RAILS_API_URL}/api/llamalend/markets`, createAuthFetchOptions());

    if (!response.ok) {
      console.error(`Backend API error: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        { error: `Backend error: ${response.statusText}` },
        { status: response.status },
      );
    }

    const data: MarketsResponse = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching llamalend markets from backend:", error);
    return NextResponse.json({ error: "Failed to fetch markets" }, { status: 500 });
  }
}
