import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    // Bind all interfaces, not Vite's default loopback. Without this the server
    // comes up on [::1] only and is unreachable from any other machine, so the
    // console can't be opened from a laptop or phone on the same network.
    // Previously worked around with `npm run dev -- --host`, which had to be
    // remembered every time and was silently lost on a plain `npm run dev`.
    host: true,
  },
});
