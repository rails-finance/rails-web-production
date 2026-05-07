import batchManagersData from "@/data/batch-managers.json";

export interface BatchManager {
  name: string;
  address: string;
  description: string;
  website: string;
}

const BY_ADDR = new Map<string, BatchManager>(
  batchManagersData.batch_managers.map(bm => [bm.address.toLowerCase(), bm as BatchManager])
);

export function getBatchManagerByAddress(address: string): BatchManager | undefined {
  return BY_ADDR.get(address.toLowerCase());
}

export function getBatchManagerName(address: string): string {
  return BY_ADDR.get(address.toLowerCase())?.name ?? address.slice(0, 8) + "…" + address.slice(-4);
}
