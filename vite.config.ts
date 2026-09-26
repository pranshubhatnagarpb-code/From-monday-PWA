import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  // Env files live in ./.env/ (e.g. .env/.env) rather than the project root.
  envDir: ".env",
  plugins: [react(), tailwindcss(), tsConfigPaths()],
});