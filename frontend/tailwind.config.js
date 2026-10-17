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
        // BRAND: #ff6000 orange. Primary actions, active states, links (use 600-700 for text on light).
        brand: {
          50:  '#fff6ee',
          100: '#ffe8d4',
          200: '#ffcda6',
          300: '#ffab70',
          400: '#ff8333',
          500: '#ff6000',
          600: '#f26419',
          700: '#c24a0c',
          800: '#963a0a',
          900: '#5f2506',
          950: '#341303',
        },

        // ACCENT: deep amber. Reserved for AI results and scores so they read apart from actions.
        accent: {
          50:  '#fff4ec',
          100: '#ffe3d0',
          200: '#fdc7a1',
          300: '#f9a46d',
          400: '#f58340',
          500: '#f26419',
          600: '#c24a0c',
          700: '#963a0a',
          800: '#6b2a08',
          900: '#3e1805',
          950: '#240d02',
        },

        // CLAY: orange tints for selection, highlights and avatars.
        clay: {
          50:  '#fff4ec',
          100: '#ffe5d1',
          200: '#ffc8a0',
          300: '#ffa468',
          400: '#ff6000',
          500: '#e04f00',
          600: '#b83f00',
          700: '#8f3300',
          800: '#5c2100',
        },

        // FOREST: warm charcoal. Ink, the sidebar and dark surfaces.
        forest: {
          50:  '#f5f3f0',
          100: '#e7e4df',
          200: '#c9c4bc',
          300: '#a29c93',
          400: '#6f6a63',
          500: '#1c1917',
          600: '#26211d',
          700: '#2e2823',
          800: '#171310',
          900: '#0e0c0a',
        },

        // NEUTRALS: warm greys that sit next to orange without turning yellow.
        base: {
          0:   '#ffffff',
          50:  '#faf7ec',
          100: '#f3eedb',
          200: '#e8e2cc',
          300: '#d4cdb4',
          400: '#a8a08f',
          500: '#7d766a',
          600: '#5f594e',
          700: '#46413a',
          800: '#2e2a26',
          900: '#1d1b19',
          950: '#100f0d',
        },

        surface: {
          light:            '#ffffff',
          'light-elevated': '#ffffff',
          'light-secondary':'#faf7ec',
          dark:             '#151210',
          'dark-card':      '#1e1a17',
          'dark-elevated':  '#2a2420',
          'dark-sidebar':   '#181411',
          'dark-input':     '#14110f',
        },

        // SEMANTIC: no greens anywhere. Positive outcomes are blue, informational states indigo.
        success: {
          50:  '#eff6ff',
          100: '#dbeafe',
          400: '#60a5fa',
          500: '#2f7fd0',
          600: '#1f64ab',
          900: '#12325a',
        },
        warning: {
          50:  '#fefbea',
          100: '#fdf3c4',
          400: '#f0c23c',
          500: '#d9a406',
          600: '#a67c00',
          900: '#4a3600',
        },
        error: {
          50:  '#fff1f3',
          100: '#ffe0e5',
          200: '#ffc2cc',
          400: '#f0627d',
          500: '#d1203f',
          600: '#b0183a',
          800: '#7a1128',
          900: '#4d0b19',
        },
        info: {
          50:  '#f1f0ff',
          100: '#e2e0ff',
          400: '#8b86f0',
          500: '#6558d6',
          600: '#4f43b8',
          900: '#272066',
        },

        // TEXT SCALE: charcoal on light, warm off-white on dark.
        ink: {
          50:  '#ffffff',
          100: '#f5f2ec',
          200: '#e3ded5',
          300: '#c7c1b6',
          400: '#8a847a',
          500: '#6b665d',
          600: '#57524a',
          700: '#433e37',
          800: '#2e2a25',
          900: '#1c1917',
          950: '#100f0d',
        },
      },

      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Text', 'Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
        display: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
      },

      fontSize: {
        'display-xl': ['4.5rem', { lineHeight: '1.02', letterSpacing: '-0.03em' }],
        'display-lg': ['3.75rem', { lineHeight: '1.04', letterSpacing: '-0.03em' }],
        'display-md': ['3rem',    { lineHeight: '1.08', letterSpacing: '-0.03em' }],
        'display-sm': ['2.25rem', { lineHeight: '1.12', letterSpacing: '-0.025em' }],
        'heading-xl': ['2rem',    { lineHeight: '1.15', letterSpacing: '-0.022em' }],
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
      // Apple-style: generous radii. Cards are xl, controls lg, small chips md.
      borderRadius: {
        'none': '0',
        'xs':   '4px',
        'sm':   '6px',
        'md':   '8px',
        'lg':   '12px',
        'xl':   '18px',
        '2xl':  '24px',
        '3xl':  '32px',
        'full': '9999px',
      },

      // Soft, diffuse and layered, the way Apple lifts a card off the page.
      boxShadow: {
        'card-light':       '0 1px 2px rgba(29,27,25,0.05), 0 8px 24px -10px rgba(29,27,25,0.12)',
        'card-dark':        '0 1px 2px rgba(0,0,0,0.4), 0 10px 28px -10px rgba(0,0,0,0.55)',
        'card-hover-light': '0 2px 4px rgba(29,27,25,0.06), 0 18px 40px -12px rgba(29,27,25,0.22)',
        'card-hover-dark':  '0 2px 4px rgba(0,0,0,0.5), 0 18px 40px -12px rgba(0,0,0,0.7)',
        'accent':           '0 1px 2px rgba(120,40,0,0.25), inset 0 1px 0 rgba(255,255,255,0.28)',
        'soft':             '0 1px 2px rgba(29,27,25,0.05)',
        'pop':              '0 30px 70px -20px rgba(29,27,25,0.45)',
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
