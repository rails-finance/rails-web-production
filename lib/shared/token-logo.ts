// Token-logo CDN URL builders. Two tiers, tried in order by the chip
// component:
//   1. Trust Wallet — broad coverage, checksum-cased path.
//   2. DeFiLlama — covers newer DeFi-native assets Trust Wallet hasn't
//      indexed (cbBTC, rsETH, LBTC at time of writing). Lowercase address.
// Anything that fails both falls to UnknownTokenSvg.

import { getAddress } from "viem";

export function getTokenLogoUrl(address: string): string {
  // viem throws if the address isn't 20 bytes / 0x-hex; for our use the input
  // is always from a curated TOKEN_ADDRESSES entry (or the API's verified
  // reserve catalog), so a malformed address is a programming error.
  return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/${getAddress(address)}/logo.png`;
}

export function getDefiLlamaLogoUrl(address: string): string {
  return `https://token-icons.llamao.fi/icons/tokens/1/${address.toLowerCase()}?h=24&w=24`;
}
