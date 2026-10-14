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
        // ORANGE ACCENT SCALE
        accent: {
          50:  '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          300: '#FDB785',
          400: '#FB923C',
          500: '#F97316',
          600: '#EA580C',
          700: '#C2410C',
          800: '#9A3412',
          900: '#7C2D12',
          950: '#431407',
        },

        // NEUTRAL BASE SCALE (warm-grey)
        base: {
          0:   '#FFFFFF',
          50:  '#FAFAF9',
          100: '#F5F5F4',
          200: '#E7E5E4',
          300: '#D6D3D1',
          400: '#A8A29E',
          500: '#78716C',
          600: '#57534E',
          700: '#44403C',
          800: '#292524',
          900: '#1C1917',
          950: '#0C0A09',
        },

        // SURFACE TOKENS
        surface: {
          light:            '#FFFFFF',
          'light-elevated': '#F8FAFC',
          'light-secondary':'#FFF7ED',
          dark:             '#141414',
          'dark-card':      '#1E1E1E',
          'dark-elevated':  '#282828',
          'dark-sidebar':   '#111111',
          'dark-input':     '#191919',
        },

        // SEMANTIC — SUCCESS
        success: {
          50:  '#ECFDF5',
          100: '#D1FAE5',
          400: '#34D399',
          500: '#10B981',
          600: '#059669',
          900: '#064E3B',
        },

        // SEMANTIC — WARNING
        warning: {
          50:  '#FFFBEB',
          100: '#FEF3C7',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
          900: '#78350F',
        },

        // SEMANTIC — ERROR
        error: {
          50:  '#FFF1F2',
          100: '#FFE4E6',
          400: '#FB7185',
          500: '#F43F5E',
          600: '#E11D48',
          900: '#881337',
        },

        // SEMANTIC — INFO
        info: {
          50:  '#EFF6FF',
          100: '#DBEAFE',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',
          900: '#1E3A8A',
        },

        // TEXT SCALE — keep existing ink scale (warm charcoal, maps well to design)
        ink: {
          50:  '#FAFAFA',
          100: '#F4F4F4',
          200: '#E8E8E8',
          300: '#D0D0D0',
          400: '#A3A3A3',
          500: '#787878',
          600: '#5A5A5A',
          700: '#424242',
          800: '#2E2E2E',
          900: '#1F1F1F',
          950: '#141414',
        },
      },

      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
      },

      fontSize: {
        'display-xl': ['4.5rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'display-lg': ['3.75rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'display-md': ['3rem',    { lineHeight: '1.2', letterSpacing: '-0.01em' }],
        'display-sm': ['2.25rem', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
        'heading-xl': ['1.875rem',{ lineHeight: '1.3', letterSpacing: '-0.01em' }],
        'heading-lg': ['1.5rem',  { lineHeight: '1.3', letterSpacing: '-0.01em' }],
        'heading-md': ['1.25rem', { lineHeight: '1.4', letterSpacing: '0' }],
        'heading-sm': ['1.125rem',{ lineHeight: '1.4', letterSpacing: '0' }],
        'body-lg':    ['1.125rem',{ lineHeight: '1.6', letterSpacing: '0' }],
        'body-md':    ['1rem',    { lineHeight: '1.6', letterSpacing: '0' }],
        'body-sm':    ['0.875rem',{ lineHeight: '1.5', letterSpacing: '0' }],
        'body-xs':    ['0.75rem', { lineHeight: '1.5', letterSpacing: '0' }],
        'label-lg':   ['1rem',    { lineHeight: '1.5', letterSpacing: '0.01em', fontWeight: '500' }],
        'label-md':   ['0.875rem',{ lineHeight: '1.5', letterSpacing: '0.01em', fontWeight: '500' }],
        'label-sm':   ['0.75rem', { lineHeight: '1.5', letterSpacing: '0.02em', fontWeight: '500' }],
        'label-xs':   ['0.625rem',{ lineHeight: '1.5', letterSpacing: '0.02em', fontWeight: '500' }],
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

      borderRadius: {
        'none': '0',
        'xs':   '6px',
        'sm':   '10px',
        'md':   '14px',
        'lg':   '18px',
        'xl':   '24px',
        '2xl':  '32px',
        '3xl':  '40px',
        'full': '9999px',
      },

      boxShadow: {
        'card-light':       '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
        'card-dark':        '0 1px 3px rgba(0,0,0,0.3),  0 1px 2px rgba(0,0,0,0.2)',
        'card-hover-light': '0 4px 12px rgba(0,0,0,0.1)',
        'card-hover-dark':  '0 4px 12px rgba(0,0,0,0.4)',
        'accent':           '0 2px 8px rgba(249,115,22,0.25)',
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
