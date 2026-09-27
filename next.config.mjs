import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // A stray package-lock.json in the home folder otherwise makes Next guess the wrong root.
  turbopack: { root },
  async headers() {
    return [
      {
        // Characters and animations are ~5 MB; let browsers keep them for a week.
        source: "/models/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }],
      },
    ];
  },
};

export default nextConfig;
