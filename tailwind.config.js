/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./resources/**/*.{edge,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        heading: ['heading', 'sans-serif'],
        extend: {},
      },
      colors: {
        main: '#001F3F',
        secondary: '#F5F3EE',
      },
    },
  },
  safelist: [
    'hover:bg-cyan-700',
    'border-cyan-700',
    'text-cyan-700',
    'hover:bg-green-700',
    'border-green-700',
    'text-green-700',
  ],
  plugins: [],
}
