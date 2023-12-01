/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./resources/**/*.{edge,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        heading: ['heading', 'sans-serif'],
        extend: {},
      },
      colors: {
        main: '#001F3F',
        secondary: '#F5F3EE'
      }
    }
  },
  plugins: []
}
