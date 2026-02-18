import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        sidebar: {
          bg: "#020817",
          border: "#111827"
        },
        action: {
          DEFAULT: "#4f46e5",
          foreground: "#f8fafc"
        }
      }
    }
  },
  plugins: []
};

export default config;

