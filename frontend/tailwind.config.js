/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],

  /* No usamos dark mode por clase, el nuevo diseño es siempre oscuro */
  darkMode: 'class',

  theme: {
    extend: {
      /* Fuentes personalizadas */
      fontFamily: {
        sans: ['Inter', 'Space Grotesk', 'sans-serif'],
      },

      /* Colores del design system */
      colors: {
        brand: {
          DEFAULT: '#0ea5e9',
          dark:    '#0284c7',
          light:   '#38bdf8',
        },
        accent: {
          DEFAULT: '#f59e0b',
          dark:    '#d97706',
        },
        surface: {
          DEFAULT: '#0a1121',
          deep:    '#060d1a',
          card:    '#0d1526',
        },
      },

      /* Animaciones extendidas */
      animation: {
        'float':      'float 4s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 2.5s ease-in-out infinite',
        'slide-up':   'slide-up 0.5s ease-out forwards',
        'spin-slow':  'spin-slow 12s linear infinite',
        'toast-in':   'toast-in 0.25s ease-out forwards',
      },

      /* Keyframes referenciados en index.css */
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
          '50%':      { transform: 'translateY(-12px) rotate(2deg)' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 12px rgba(14,165,233,0.2)' },
          '50%':      { boxShadow: '0 0 28px rgba(14,165,233,0.55)' },
        },
        'slide-up': {
          from: { opacity: 0, transform: 'translateY(20px)' },
          to:   { opacity: 1, transform: 'translateY(0)' },
        },
        'spin-slow': {
          from: { transform: 'rotate(0deg)' },
          to:   { transform: 'rotate(360deg)' },
        },
        'toast-in': {
          from: { opacity: 0, transform: 'translateY(-8px) scale(0.97)' },
          to:   { opacity: 1, transform: 'translateY(0) scale(1)' },
        },
      },
    },
  },

  plugins: [],
}
