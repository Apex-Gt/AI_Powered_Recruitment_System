import { useTheme } from '@/context/ThemeContext'

/** Categorical series colours: orange leads, then neutrals and cool hues so slices stay distinguishable. */
export const SERIES_LIGHT = ['#ff6000', '#1c1917', '#2f7fd0', '#d97706', '#6558d6', '#d1203f', '#a39d92']
export const SERIES_DARK = ['#ff8133', '#f5f2ec', '#60a5fa', '#f59e0b', '#8b86f0', '#f0627d', '#8a847a']

/** Meaning-bearing colours for score bands, best to worst. */
export const SCORE_BANDS = ['#2f7fd0', '#d9a406', '#ff6000', '#d1203f']

export function useChartTheme() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const grid = isDark ? '#332e29' : '#e6e1d8'
  return {
    isDark,
    grid,
    tick: isDark ? '#b5aea3' : '#57524a',
    series: isDark ? SERIES_DARK : SERIES_LIGHT,
    tooltipStyle: {
      backgroundColor: isDark ? '#26211d' : '#ffffff',
      border: `1px solid ${grid}`,
      borderRadius: 8,
      color: isDark ? '#f5f2ec' : '#1c1917',
      fontSize: 12,
    },
  }
}
