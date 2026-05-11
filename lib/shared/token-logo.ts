// Trust Wallet GitHub assets — case-sensitive: requires EIP-55 checksum on
// the address. Use viem's getAddress (already a dep) instead of pulling in
// @noble/hashes for keccak.
//
// Source URL pattern matches what rails-explorer uses, so any token icon
// that resolves there will look identical between the two surfaces.

import { getAddress } from "viem";

export function getTokenLogoUrl(address: string): string {
  // viem throws if the address isn't 20 bytes / 0x-hex; for our use the input
  // is always from a curated TOKEN_ADDRESSES entry (or the API's verified
  // reserve catalog), so a malformed address is a programming error.
  return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/${getAddress(address)}/logo.png`;
}
