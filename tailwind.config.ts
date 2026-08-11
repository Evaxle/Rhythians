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
        background: "#0b0f19",
        surface: "#12182c",
        muted: "#7b8aaf",
        border: "#1d263b",
        accent: "#7289da",
        accent2: "#42b983"
      },
      boxShadow: {
        glow: "0 20px 60px rgba(46, 74, 196, 0.12)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
