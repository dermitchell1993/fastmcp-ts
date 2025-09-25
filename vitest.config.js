import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["**/fixtures.test.ts"],
    poolOptions: {
      forks: { execArgv: ["--experimental-eventsource"] },
    },
  },
});
