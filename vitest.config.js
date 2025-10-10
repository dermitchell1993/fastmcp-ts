import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["**/node_modules/**", "**/fixtures.ts"],
    poolOptions: {
      forks: { execArgv: ["--experimental-eventsource"] },
    },
  },
});
