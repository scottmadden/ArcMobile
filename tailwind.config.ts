import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./pages/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#004C97",
        accent: "#1A73E8",
        surface: "#F7F9FC",
        muted: "#6B7280",
        success: "#28A745",
        warning: "#F9A825",
        danger: "#DC3545",
      },
      borderRadius: {
        '2xl': '1rem',
      }
    },
  },
  plugins: [],
};
export default config;
