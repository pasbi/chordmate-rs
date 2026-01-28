import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "/",
  test: {
    globals: true, // use global `describe`, `it`, `expect`
    environment: "jsdom", // browser-like environment
    include: ["**/*.test.ts", "**/*.test.tsx"], // which files to run
  },
});
