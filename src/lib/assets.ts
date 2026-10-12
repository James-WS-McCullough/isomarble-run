/**
 * Base path the site is served from, e.g. "/isomarble-run" on GitHub Pages.
 * Empty when running locally.
 */
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/**
 * Prefix a path in `public/` with the base path so plain <img>/<audio>
 * URLs keep working when the site is hosted under a sub-path.
 */
export function assetPath(path: string): string {
  return `${BASE_PATH}${path}`;
}
