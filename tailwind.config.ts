import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Noto Sans'", "'Noto Sans Thai'", "sans-serif"],
      },
      colors: {
        brand: {
          black: "#0a0a0a",
          white: "#fafafa",
          gray: "#888780",
        },
      },
    },
  },
  plugins: [],
};

export default config;
