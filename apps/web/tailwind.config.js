/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f4ff',
          100: '#e0ebff',
          200: '#c7dbff',
          300: '#a3c3ff',
          400: '#79a3ff',
          500: '#5b7fff',
          600: '#4560ff',
          700: '#3949e0',
          800: '#2f3eb3',
          900: '#2b3586',
        },
      },
    },
  },
  plugins: [],
};