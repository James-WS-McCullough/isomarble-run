import type { HotbarItem } from "@/lib/hotbar";
import { isPiece } from "@/lib/hotbar";
import { PieceIcon } from "./PieceIcon";

/** The icon for anything that can go in the hotbar */
export function ItemIcon({
  item,
  rotation = 0,
}: {
  item: HotbarItem;
  /** How the piece in hand is turned, so the icon shows it */
  rotation?: number;
}) {
  if (isPiece(item)) return <PieceIcon kind={item} rotation={rotation} />;
  if (item === "marble") return <MarbleIcon />;
  return (
    <span className="text-2xl leading-none" aria-hidden="true">
      {item === "move" ? "✋" : "🧽"}
    </span>
  );
}

function MarbleIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <radialGradient id="marble-glass" cx="0.35" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#bfe3ff" />
          <stop offset="0.6" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#1e3a8a" />
        </radialGradient>
      </defs>
      <circle cx="20" cy="20" r="12" fill="url(#marble-glass)" />
      <path
        d="M11 23 C 16 14, 22 28, 29 17"
        stroke="#f8fafc"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="16" cy="15" r="2.5" fill="#ffffff" opacity="0.8" />
    </svg>
  );
}
