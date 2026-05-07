/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./*.html"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0B6B4F',
          dark:    '#094d39',
          light:   '#0d8562',
          50:      '#f0faf5',
          100:     '#d0f0e4',
        },
        secondary: {
          DEFAULT: '#0A2540',
          light:   '#0d3060',
        },
        neutral: '#F8F9FA',
      },
      fontFamily: {
        heading: ['Poppins', 'sans-serif'],
        body:    ['Inter',   'sans-serif'],
      },
    },
  },
  plugins: [],
};
