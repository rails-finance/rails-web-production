import { NextRequest, NextResponse } from "next/server";
import { createAuthFetchOptions } from "@/lib/api/fetch-with-auth";
import type { AaveV4Position } from "@/lib/api/fetch-aave-v4";

const RAILS_API_URL = process.env.RAILS_API_URL;

interface PositionsResponse {
  wallet: string;
  positions: AaveV4Position[];
}

export async function GET(request: NextRequest) {
  if (!RAILS_API_URL) {
    console.error("RAILS_API_URL environment variable is not set");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  try {
    const search = request.nextUrl.searchParams.toString();
    const url = `${RAILS_API_URL}/api/aave-v4/positions${search ? `?${search}` : ""}`;
    const response = await fetch(url, createAuthFetchOptions());

    if (!response.ok) {
      console.error(`Backend API error: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        { error: `Backend error: ${response.statusText}` },
        { status: response.status },
      );
    }

    const data: PositionsResponse = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching aave-v4 positions from backend:", error);
    return NextResponse.json({ error: "Failed to fetch positions" }, { status: 500 });
  }
}
