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
          navy: "#111827",
          deep: "#0f3d91",
          blue: "#2563eb",
          sky: "#dcecff",
          teal: "#0f766e",
          mint: "#dff7ef"
        }
      },
      boxShadow: {
        soft: "0 10px 30px rgba(15, 23, 42, 0.07)"
      }
    }
  },
  plugins: []
};

export default config;
