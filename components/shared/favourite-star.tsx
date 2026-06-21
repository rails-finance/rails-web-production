"use client";

// Favourite (star) toggle for a wallet, designed to live inside a listing
// card's identity cluster. Favouriting keys off the *wallet*, not the
// position — so every card for the same owner (e.g. several Aave spokes)
// reflects the same starred state, and favourites surface in the search
// dropdown's Favourites tab.
//
// Colour: deliberately neutral (filled foreground when favourited, muted
// outline when not). A favourite is an affordance state, not a risk/value
// signal — so it stays out of the valence palette (no green/red, no amber).

import { useEffect, useState } from "react";
import { isFavourite, toggleFavourite, SESSIONS_CHANGED_EVENT, type SessionProtocol } from "@/lib/shared/sessions";

export function FavouriteStar({
  wallet,
  ensName,
  protocol,
  size = 13,
}: {
  wallet: string;
  ensName: string | null;
  protocol: SessionProtocol;
  size?: number;
}) {
  const [fav, setFav] = useState(false);

  // Subscribe so every star for the same wallet stays in sync after a toggle
  // anywhere (another card on the page, the dropdown's remove action, or a
  // change in another tab via the native `storage` event).
  useEffect(() => {
    const sync = () => setFav(isFavourite(wallet, protocol));
    sync();
    window.addEventListener(SESSIONS_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SESSIONS_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [wallet, protocol]);

  return (
    <button
      type="button"
      onClick={(e) => {
        // The card is wrapped in a Next <Link>; stop the click bubbling so
        // favouriting never navigates.
        e.preventDefault();
        e.stopPropagation();
        setFav(toggleFavourite(wallet, ensName, protocol));
      }}
      aria-pressed={fav}
      aria-label={fav ? "Remove wallet from favourites" : "Add wallet to favourites"}
      title={fav ? "Favourited — click to remove" : "Favourite this wallet"}
      className={`shrink-0 inline-flex items-center cursor-pointer transition-colors ${
        fav ? "text-foreground hover:text-rb-500" : "text-rb-500 hover:text-foreground"
      }`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={fav ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    </button>
  );
}
