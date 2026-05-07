import { NextRequest, NextResponse } from "next/server";
import { createAuthFetchOptions } from "@/lib/api/fetch-with-auth";
import type { BaseActivityEvent } from "@/lib/shared/types/event-shape";

const RAILS_API_URL = process.env.RAILS_API_URL;

interface TimelineResponse {
  troveId: string;
  collateralType: string;
  owner: string | null;
  events: BaseActivityEvent[];
  totalEvents: number;
  pagination: { limit: number; offset: number; hasMore: boolean };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ collateralType: string; troveId: string }> },
) {
  const { collateralType, troveId } = await context.params;

  if (!RAILS_API_URL) {
    console.error("RAILS_API_URL environment variable is not set");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const url = `${RAILS_API_URL}/api/trove/${collateralType}/${troveId}/timeline${
      searchParams.toString() ? `?${searchParams.toString()}` : ""
    }`;

    const response = await fetch(url, createAuthFetchOptions());

    if (!response.ok) {
      console.error(`Backend API error: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        { error: `Backend error: ${response.statusText}` },
        { status: response.status },
      );
    }

    const data: TimelineResponse = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching trove timeline from backend:", error);
    return NextResponse.json({ error: "Failed to fetch timeline" }, { status: 500 });
  }
}
