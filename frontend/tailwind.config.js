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
        // Neumorphic base colors - #F7F3E3 as primary background
        base: {
          50: '#FEFDFB',   // Lightest highlight
          100: '#F7F3E3',  // Primary background
          200: '#E8E2CC',  // Subtle borders/dividers
          300: '#D9D1B5',  // Muted borders
          400: '#CAC09E',  // Disabled/placeholder
          500: '#BBB087',  // Secondary text
          600: '#9A9070',  // Body text
          700: '#797059',  // Primary text
          800: '#585042',  // Headings
          900: '#37322B',  // High emphasis
          950: '#1C1813',  // Dark mode base
        },
        // Text colors - warm charcoal
        ink: {
          50: '#FAFAF9',
          100: '#F4F4F4',
          200: '#E8E8E8',
          300: '#D0D0D0',
          400: '#A3A3A3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#171717',
          950: '#0A0A0A',
        },
        // Primary accent - #FE5D26
        accent: {
          50: '#FFF4F1',
          100: '#FFE4DD',
          200: '#FFC9BA',
          300: '#FF9F7A',
          400: '#FE7A45',
          500: '#FE5D26',  // Primary accent
          600: '#E84A1E',
          700: '#C43A1A',
          800: '#9D2E16',
          900: '#7D2513',
          950: '#41120A',
        },
        // Semantic colors - derived from base palette
        success: {
          50: '#F0FDF4',
          100: '#DCFCE7',
          200: '#BBF7D0',
          300: '#86EFAC',
          400: '#4ADE80',
          500: '#22C55E',
          600: '#16A34A',
          700: '#15803D',
          800: '#166534',
          900: '#14532D',
          950: '#052E16',
        },
        warning: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
          800: '#92400E',
          900: '#78350F',
          950: '#451A03',
        },
        error: {
          50: '#FEF2F2',
          100: '#FEE2E2',
          200: '#FECACA',
          300: '#FCA5A5',
          400: '#F87171',
          500: '#EF4444',
          600: '#DC2626',
          700: '#B91C1C',
          800: '#991B1B',
          900: '#7F1D1D',
          950: '#450A0A',
        },
        info: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A',
          950: '#172554',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display-xl': ['4.5rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'display-lg': ['3.75rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'display-md': ['3rem', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
        'display-sm': ['2.25rem', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
        'heading-xl': ['1.875rem', { lineHeight: '1.3', letterSpacing: '-0.01em' }],
        'heading-lg': ['1.5rem', { lineHeight: '1.3', letterSpacing: '-0.01em' }],
        'heading-md': ['1.25rem', { lineHeight: '1.4', letterSpacing: '0' }],
        'heading-sm': ['1.125rem', { lineHeight: '1.4', letterSpacing: '0' }],
        'body-lg': ['1.125rem', { lineHeight: '1.6', letterSpacing: '0' }],
        'body-md': ['1rem', { lineHeight: '1.6', letterSpacing: '0' }],
        'body-sm': ['0.875rem', { lineHeight: '1.5', letterSpacing: '0' }],
        'body-xs': ['0.75rem', { lineHeight: '1.5', letterSpacing: '0' }],
        'label-lg': ['1rem', { lineHeight: '1.5', letterSpacing: '0.01em', fontWeight: '500' }],
        'label-md': ['0.875rem', { lineHeight: '1.5', letterSpacing: '0.01em', fontWeight: '500' }],
        'label-sm': ['0.75rem', { lineHeight: '1.5', letterSpacing: '0.02em', fontWeight: '500' }],
        'label-xs': ['0.625rem', { lineHeight: '1.5', letterSpacing: '0.02em', fontWeight: '500' }],
      },
      spacing: {
        '0': '0',
        '1': '0.25rem',  // 4px
        '2': '0.5rem',   // 8px
        '3': '0.75rem',  // 12px
        '4': '1rem',     // 16px
        '5': '1.25rem',  // 20px
        '6': '1.5rem',   // 24px
        '7': '1.75rem',  // 28px
        '8': '2rem',     // 32px
        '9': '2.25rem',  // 36px
        '10': '2.5rem',  // 40px
        '11': '2.75rem', // 44px
        '12': '3rem',    // 48px
        '14': '3.5rem',  // 56px
        '16': '4rem',    // 64px
        '20': '5rem',    // 80px
        '24': '6rem',    // 96px
      },
      borderRadius: {
        'none': '0',
        'xs': '4px',
        'sm': '8px',
        'md': '12px',
        'lg': '16px',
        'xl': '20px',
        '2xl': '24px',
        'full': '9999px',
      },
      boxShadow: {
        // Neumorphic elevation system - subtle, diffuse, realistic
        // Level 0: Flat background (no shadow)
        // Level 1: Subtle raised components
        'neo-1': '2px 2px 4px rgba(55, 50, 43, 0.08), -2px -2px 4px rgba(255, 255, 255, 0.8)',
        'neo-1-hover': '4px 4px 8px rgba(55, 50, 43, 0.1), -4px -4px 8px rgba(255, 255, 255, 0.9)',
        // Level 2: Important cards / containers
        'neo-2': '4px 4px 8px rgba(55, 50, 43, 0.1), -4px -4px 8px rgba(255, 255, 255, 0.85)',
        'neo-2-hover': '8px 8px 16px rgba(55, 50, 43, 0.12), -8px -8px 16px rgba(255, 255, 255, 0.9)',
        // Level 3: Modals / floating elements
        'neo-3': '12px 12px 24px rgba(55, 50, 43, 0.12), -12px -12px 24px rgba(255, 255, 255, 0.85)',
        // Inset/pressed states
        'neo-inset': 'inset 2px 2px 4px rgba(55, 50, 43, 0.1), inset -2px -2px 4px rgba(255, 255, 255, 0.7)',
        'neo-inset-strong': 'inset 4px 4px 8px rgba(55, 50, 43, 0.12), inset -4px -4px 8px rgba(255, 255, 255, 0.6)',
        // Accent shadows for primary actions
        'neo-accent': '2px 2px 4px rgba(254, 93, 38, 0.2), -2px -2px 4px rgba(255, 255, 255, 0.8)',
        'neo-accent-hover': '4px 4px 8px rgba(254, 93, 38, 0.25), -4px -4px 8px rgba(255, 255, 255, 0.9)',
        'neo-accent-pressed': 'inset 2px 2px 4px rgba(254, 93, 38, 0.3), inset -2px -2px 4px rgba(255, 255, 255, 0.5)',
      },
      transitionDuration: {
        'fast': '150ms',
        'normal': '200ms',
        'slow': '250ms',
      },
      transitionTimingFunction: {
        'ease-out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'ease-in-out-expo': 'cubic-bezier(0.87, 0, 0.13, 1)',
      },
      zIndex: {
        'dropdown': '100',
        'sticky': '200',
        'modal': '300',
        'popover': '400',
        'tooltip': '500',
        'toast': '600',
      },
      backgroundImage: {
        'neo-gradient': 'linear-gradient(145deg, #F7F3E3 0%, #E8E2CC 100%)',
        'neo-gradient-hover': 'linear-gradient(145deg, #E8E2CC 0%, #D9D1B5 100%)',
        'neo-gradient-pressed': 'linear-gradient(145deg, #D9D1B5 0%, #CAC09E 100%)',
      },
    },
  },
  plugins: [],
}