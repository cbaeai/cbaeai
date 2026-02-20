/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink:   "#09090e",
        ink2:  "#111118",
        ink3:  "#18181f",
        rim:   "#222230",
        rim2:  "#2e2e40",
        fog:   "#55556e",
        mist:  "#8888a8",
        text1: "#eaeaf2",
        text2: "#b0b0c8",
        gold:  "#c8a96e",
        gold2: "#e0c48a",
        teal:  "#4ecdc4",
      },
      fontFamily: {
        sans:  ["DM Sans", "sans-serif"],
        serif: ["DM Serif Display", "serif"],
      },
    },
  },
  plugins: [],
}
