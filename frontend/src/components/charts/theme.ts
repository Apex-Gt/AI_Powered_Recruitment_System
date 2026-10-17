import { useTheme } from '@/context/ThemeContext'

/** Categorical series colours, ordered so neighbouring slices stay distinguishable. */
export const SERIES_LIGHT = ['#606c38', '#dda15e', '#3d8582', '#bc6c25', '#283618', '#b9462f', '#a9a98a']
export const SERIES_DARK = ['#88994f', '#dda15e', '#5aa3a0', '#d98840', '#fefae0', '#d9755d', '#8f9378']

/** Meaning-bearing colours for score bands, best to worst. */
export const SCORE_BANDS = ['#3d7a3a', '#88994f', '#dda15e', '#b9462f']

export function useChartTheme() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const grid = isDark ? '#2c3a1c' : '#dedab9'
  return {
    isDark,
    grid,
    tick: isDark ? '#b4b896' : '#5b6347',
    series: isDark ? SERIES_DARK : SERIES_LIGHT,
    tooltipStyle: {
      backgroundColor: isDark ? '#1f2a13' : '#fffef9',
      border: `1px solid ${grid}`,
      borderRadius: 8,
      color: isDark ? '#fefae0' : '#283618',
      fontSize: 12,
    },
  }
}
