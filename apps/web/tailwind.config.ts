import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        "eco-deep": "#0b3d2e",
        "eco-mint": "#dcfce7",
        "eco-sky": "#dbeafe"
      }
    }
  },
  plugins: []
};

export default config;

