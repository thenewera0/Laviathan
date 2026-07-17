import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        abyss: "#04080a",
        trench: "#0b1e20",
        lumen: "#67e8dd",
        iris: "#8f7bf0",
        glint: "#e0a95e",
        foam: "#9fb8b2",
        cold: "#4f6b8f",
      },
      fontFamily: {
        voice: ["var(--font-voice)", "serif"],
        data: ["var(--font-data)", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
