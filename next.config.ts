import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build a fully static site into `out/` so it can be hosted on GitHub Pages
  output: "export",
  // Set when the site is served from a sub-path, e.g. "/isomarble-run"
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
};

export default nextConfig;
