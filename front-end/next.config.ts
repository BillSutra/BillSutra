import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const projectRoot = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = dirname(projectRoot);

const nextConfig: NextConfig = {
  turbopack: {
    root: workspaceRoot,
  },
};

export default nextConfig;
