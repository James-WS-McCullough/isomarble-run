import type { Piece } from "./track";

/** A portal's place in the pairs: which pair, and the portal it leads to */
export interface PortalLink {
  pair: number;
  twin: Piece | undefined;
}

/**
 * Portals link up in the order they were placed: the first with the second,
 * the third with the fourth, and so on. An odd one out has no twin yet.
 */
export function portalLinks(pieces: Piece[]): Map<string, PortalLink> {
  const portals = pieces.filter((piece) => piece.kind === "portal");
  const links = new Map<string, PortalLink>();
  portals.forEach((portal, i) => {
    const pair = Math.floor(i / 2);
    const twin = portals[i % 2 === 0 ? i + 1 : i - 1];
    links.set(portal.id, { pair, twin });
  });
  return links;
}
