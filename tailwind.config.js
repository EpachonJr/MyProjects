/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        status: {
          bg: '#121418',
          card: '#1b1e24',
          cardHover: '#23272f',
          border: '#2b303b',
          accent: '#00d09c',
          amber: '#f59e0b',
          orange: '#f97316',
          blue: '#3b82f6',
          purple: '#a855f7',
          danger: '#ef4444',
          success: '#10b981',
        }
      }
    },
  },
  plugins: [],
}
