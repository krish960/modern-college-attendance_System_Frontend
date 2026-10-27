/*
 * Vite build and dev-server settings for the React app.
 * Run `npm run dev` to start it on http://127.0.0.1:5173.
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Lets Vite understand JSX and gives fast refresh while editing.
  plugins: [react()],
  // /s/<code> is the plain student notes page: the server (not the app) answers it, here and in production.
  server: { port: 5173, host: "127.0.0.1", proxy: { "^/s/": "http://127.0.0.1:8000" } },
});
