import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "#070a12",
        surface: "#101629",
        muted: "#8d99b5",
        border: "rgba(148, 163, 184, 0.13)",
        accent: "#7c8ff0",
        accent2: "#55d6a0"
      },
      boxShadow: {
        glow: "0 24px 70px rgba(67, 82, 180, 0.16)",
        card: "0 18px 50px rgba(0, 0, 0, 0.18)"
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"]
      },
      borderRadius: {
        xl: "0.9rem",
        "2xl": "1.15rem",
        "3xl": "1.5rem"
      }
    }
  },
  plugins: []
};

export default config;
