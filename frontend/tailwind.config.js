/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // BRAND: olive leaf. Primary actions, active states, links.
        // (palette 100..900 inverted to the Tailwind convention: 50 lightest, 950 darkest)
        brand: {
          50:  '#f2f4e6',
          100: '#e2e7d1',
          200: '#c5d0a3',
          300: '#a9b876',
          400: '#88994f',
          500: '#606c38',
          600: '#4c562c',
          700: '#394121',
          800: '#262b16',
          900: '#13160b',
          950: '#0b0d06',
        },

        // ACCENT: copperwood. AI results, scores, emphasis.
        accent: {
          50:  '#fbf0e4',
          100: '#f6e1cf',
          200: '#ecc3a0',
          300: '#e3a570',
          400: '#d98840',
          500: '#bc6c25',
          600: '#96561e',
          700: '#704016',
          800: '#4b2b0f',
          900: '#251507',
          950: '#170d04',
        },

        // CLAY: sunlit clay. Highlights, selection, chart secondary.
        clay: {
          50:  '#f8ecdf',
          100: '#f1dabf',
          200: '#ebc79f',
          300: '#e4b57f',
          400: '#dda15e',
          500: '#d1842c',
          600: '#9d6321',
          700: '#684216',
          800: '#34210b',
        },

        // FOREST: black forest. Ink, navigation band, dark surfaces.
        forest: {
          50:  '#eaf2df',
          100: '#d5e4c3',
          200: '#aac987',
          300: '#80ac4d',
          400: '#547133',
          500: '#283618',
          600: '#1f2a13',
          700: '#18200e',
          800: '#101509',
          900: '#080b05',
        },

        // NEUTRALS: cornsilk-tinted, never cold grey.
        base: {
          0:   '#fffef9',
          50:  '#f8f4d9',
          100: '#f1edcc',
          200: '#e5e1bd',
          300: '#d3cfa8',
          400: '#a9a98a',
          500: '#7d8064',
          600: '#5b6347',
          700: '#444d32',
          800: '#2f3a1f',
          900: '#1f2914',
          950: '#101509',
        },

        surface: {
          light:            '#fffdf3',
          'light-elevated': '#fffef9',
          'light-secondary':'#f8f4d9',
          dark:             '#101509',
          'dark-card':      '#18200e',
          'dark-elevated':  '#1f2a13',
          'dark-sidebar':   '#0b0f06',
          'dark-input':     '#0c1007',
        },

        // SEMANTIC (the palette has no red, blue or true green, so these are tuned to sit beside it)
        success: {
          50:  '#eef7ec',
          100: '#d8ecd3',
          400: '#6aa869',
          500: '#3d7a3a',
          600: '#2f6230',
          900: '#17301a',
        },
        warning: {
          50:  '#fbf1e3',
          100: '#f6e2c5',
          400: '#dda15e',
          500: '#c98524',
          600: '#9d6321',
          900: '#34210b',
        },
        error: {
          50:  '#fbeeea',
          100: '#f6d9d1',
          200: '#efbfb2',
          400: '#d9755d',
          500: '#b9462f',
          600: '#983523',
          800: '#6b2616',
          900: '#4a1a10',
        },
        info: {
          50:  '#ebf4f3',
          100: '#d3e6e4',
          400: '#5aa3a0',
          500: '#3d8582',
          600: '#2e6866',
          900: '#12302f',
        },

        // TEXT SCALE: green-black ink on cornsilk, cornsilk on forest.
        ink: {
          50:  '#fffef9',
          100: '#fefae0',
          200: '#e8e5c9',
          300: '#c9c8a8',
          400: '#8f9378',
          500: '#6a7152',
          600: '#525b3c',
          700: '#3d4a2a',
          800: '#2f3d1d',
          900: '#283618',
          950: '#18200e',
        },
      },

      fontFamily: {
        sans: ['Instrument Sans', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Bricolage Grotesque', 'Instrument Sans', 'system-ui', 'sans-serif'],
      },

      fontSize: {
        'display-xl': ['4.5rem', { lineHeight: '1.02', letterSpacing: '-0.035em' }],
        'display-lg': ['3.75rem', { lineHeight: '1.04', letterSpacing: '-0.03em' }],
        'display-md': ['3rem',    { lineHeight: '1.08', letterSpacing: '-0.03em' }],
        'display-sm': ['2.25rem', { lineHeight: '1.12', letterSpacing: '-0.025em' }],
        'heading-xl': ['2.125rem',{ lineHeight: '1.12', letterSpacing: '-0.03em' }],
        'heading-lg': ['1.5rem',  { lineHeight: '1.2',  letterSpacing: '-0.02em' }],
        'heading-md': ['1.25rem', { lineHeight: '1.3',  letterSpacing: '-0.015em' }],
        'heading-sm': ['1.0625rem',{ lineHeight: '1.4', letterSpacing: '-0.01em' }],
        'body-lg':    ['1.125rem',{ lineHeight: '1.65', letterSpacing: '0' }],
        'body-md':    ['1rem',    { lineHeight: '1.6',  letterSpacing: '0' }],
        'body-sm':    ['0.875rem',{ lineHeight: '1.55', letterSpacing: '0' }],
        'body-xs':    ['0.75rem', { lineHeight: '1.5',  letterSpacing: '0.005em' }],
        'label-lg':   ['1rem',    { lineHeight: '1.5',  letterSpacing: '0', fontWeight: '600' }],
        'label-md':   ['0.875rem',{ lineHeight: '1.5',  letterSpacing: '0', fontWeight: '600' }],
        'label-sm':   ['0.8125rem',{ lineHeight: '1.5', letterSpacing: '0', fontWeight: '600' }],
        'label-xs':   ['0.75rem', { lineHeight: '1.5',  letterSpacing: '0', fontWeight: '600' }],
      },

      spacing: {
        '0':  '0',
        '1':  '0.25rem',
        '2':  '0.5rem',
        '3':  '0.75rem',
        '4':  '1rem',
        '5':  '1.25rem',
        '6':  '1.5rem',
        '7':  '1.75rem',
        '8':  '2rem',
        '9':  '2.25rem',
        '10': '2.5rem',
        '11': '2.75rem',
        '12': '3rem',
        '14': '3.5rem',
        '16': '4rem',
        '20': '5rem',
        '24': '6rem',
      },

      // Tighter than before: controls are 6px, panels 10px. Only avatars and dots are fully round.
      borderRadius: {
        'none': '0',
        'xs':   '3px',
        'sm':   '4px',
        'md':   '5px',
        'lg':   '6px',
        'xl':   '10px',
        '2xl':  '14px',
        '3xl':  '20px',
        'full': '9999px',
      },

      // Flat by default: structure comes from borders, not shadows.
      boxShadow: {
        'card-light':       '0 1px 0 rgba(40,54,24,0.05)',
        'card-dark':        '0 1px 0 rgba(0,0,0,0.35)',
        'card-hover-light': '0 8px 20px -10px rgba(40,54,24,0.35)',
        'card-hover-dark':  '0 8px 20px -10px rgba(0,0,0,0.7)',
        'accent':           'inset 0 -2px 0 rgba(19,22,11,0.28)',
        'soft':             '0 1px 0 rgba(40,54,24,0.05)',
        'pop':              '0 18px 40px -16px rgba(19,22,11,0.45)',
      },

      transitionDuration: {
        'fast':   '150ms',
        'normal': '200ms',
        'slow':   '300ms',
        'slower': '400ms',
      },

      transitionTimingFunction: {
        'ease-out-expo':    'cubic-bezier(0.16, 1, 0.3, 1)',
        'ease-in-out-expo': 'cubic-bezier(0.87, 0, 0.13, 1)',
        'spring':           'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },

      zIndex: {
        'dropdown': '100',
        'sticky':   '200',
        'modal':    '300',
        'popover':  '400',
        'tooltip':  '500',
        'toast':    '600',
      },
    },
  },
  plugins: [],
}
