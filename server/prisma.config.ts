import "dotenv/config";
import { defineConfig } from "prisma/config";

const directUrl = process.env.DIRECT_URL?.trim();
const runtimeUrl = process.env.DATABASE_URL?.trim();

if (!directUrl && !runtimeUrl) {
  throw new Error(
    "Set DIRECT_URL (preferred) or DATABASE_URL before running Prisma CLI commands.",
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: directUrl || runtimeUrl!,
  },
});
