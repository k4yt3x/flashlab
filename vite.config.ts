import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const { version } = JSON.parse(readFileSync("./package.json", "utf8")) as { version: string };

/**
 * The commit this build came from, or nothing when there is no way to know.
 *
 * A CI runner states it outright; anywhere else it comes from git. A copy of the source with no
 * repository around it still builds, and simply says nothing about which commit it is.
 */
function commit(): string {
  const stated = process.env.GITHUB_SHA;
  if (stated) {
    return stated.slice(0, 7);
  }
  try {
    return execSync("git rev-parse --short HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return "";
  }
}

// The site is served from the root of its own domain, which GitHub Pages is told about in the
// repository settings rather than by a CNAME file in the artifact. Building for a project page
// under github.io instead would want `base: "/flashlab/"`.
export default defineConfig({
  plugins: [react()],
  // Stamped onto `import.meta.env` rather than onto bare globals. Vite replaces this form in dev
  // and in a build alike, and an unreplaced one reads as `undefined` rather than throwing, so a
  // stamp that fails to land costs a line of text and not the whole page.
  define: {
    "import.meta.env.VITE_VERSION": JSON.stringify(version),
    "import.meta.env.VITE_COMMIT": JSON.stringify(commit()),
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
