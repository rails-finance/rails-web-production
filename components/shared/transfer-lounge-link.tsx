// Stub for rails-explorer's "Rails Index" link in the event-card footer.
//
// rails-explorer renders a small badge linking to the umbrella explorer's
// transfer-lounge page. There is no equivalent surface on the focused
// rails-web-mig deployment, so this returns null — the footer collapses
// to gas + Etherscan + tx-hash badge, which is exactly what we want.

export function TransferLoungeLink(_props: { wallet: string; txHash: string }) {
  return null;
}
