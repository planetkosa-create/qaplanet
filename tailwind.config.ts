import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: "#10223f",
          blue: "#2563eb",
          sky: "#dcecff",
          teal: "#0f766e",
          mint: "#dff7ef"
        }
      },
      boxShadow: {
        soft: "0 12px 40px rgba(16, 34, 63, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
