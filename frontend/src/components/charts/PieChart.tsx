import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { cn } from '@/utils/helpers'
import { useChartTheme } from './theme'

interface PieData {
  name: string
  value: number
  color?: string
}

interface PieChartProps {
  data: PieData[]
  height?: number
  className?: string
  innerRadius?: number
  showLegend?: boolean
  showTooltip?: boolean
}

export function PieChartComponent({
  data,
  height = 300,
  className,
  innerRadius = 60,
  showLegend = true,
  showTooltip = true,
}: PieChartProps) {
  const { tooltipStyle, series: defaultColors } = useChartTheme()

  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={100}
            fill="var(--color-surface-elevated)"
            paddingAngle={2}
            dataKey="value"
            nameKey="name"
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            labelLine={false}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color || defaultColors[index % defaultColors.length]} />
            ))}
          </Pie>
          {showTooltip && (
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value: number, name: string) => [value, name]}
            />
          )}
          {showLegend && (
            <Legend
              layout="vertical"
              align="right"
              verticalAlign="middle"
              wrapperStyle={{ paddingRight: '20px' }}
              iconType="circle"
              iconSize={8}
            />
          )}
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

interface DonutChartProps {
  data: PieData[]
  height?: number
  className?: string
  total?: number
  totalLabel?: string
}

export function DonutChart({ data, height = 200, className, total, totalLabel = 'Total' }: DonutChartProps) {
  const totalValue = total ?? data.reduce((sum, d) => sum + d.value, 0)
  const { tooltipStyle, series: defaultColors } = useChartTheme()

  return (
    <div className={cn('relative w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={70}
            outerRadius={90}
            fill="var(--color-surface-elevated)"
            paddingAngle={3}
            dataKey="value"
            nameKey="name"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color || defaultColors[index % defaultColors.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value: number, name: string) => [value, name]}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="font-display text-display-sm font-bold tabular text-ink-900 dark:text-ink-100">{totalValue}</span>
        <span className="text-body-sm text-ink-600 dark:text-ink-400">{totalLabel}</span>
      </div>
    </div>
  )
}
