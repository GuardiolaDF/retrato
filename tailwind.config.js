/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'pure-red': '#FF0000',
        'pure-green': '#00FF00',
        'pure-blue': '#0000FF',
        'pure-black': '#000000',
        'pure-white': '#FFFFFF',
      },
      fontFamily: {
        mono: ['"Space Mono"', '"Courier New"', 'monospace'],
        sans: ['Inter', 'sans-serif'],
      },
      gridTemplateColumns: {
        '16': 'repeat(16, minmax(0, 1fr))',
      },
      gridTemplateRows: {
        '16': 'repeat(16, minmax(0, 1fr))',
      }
    },
  },
  plugins: [],
}
