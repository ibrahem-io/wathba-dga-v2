/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        border: '#e5e7eb',
        background: '#ffffff',
        foreground: '#111827',
      },
    },
  },
  plugins: [],
};