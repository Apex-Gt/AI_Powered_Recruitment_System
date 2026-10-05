import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { cn } from '@/utils/helpers'

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
  const defaultColors = [
    '#FE5D26', // accent-500
    '#22C55E', // success-500
    '#F59E0B', // warning-500
    '#3B82F6', // info-500
    '#8B5CF6', // purple-500
    '#EF4444', // error-500
    '#EC4899', // pink-500
    '#06B6D4', // cyan-500
  ]

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
            fill="#E8E2CC"
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
              contentStyle={{
                backgroundColor: '#37322B',
                border: 'none',
                borderRadius: '12px',
                boxShadow: '12px 12px 24px rgba(55, 50, 43, 0.12)',
                color: '#FAFAF9',
              }}
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
            fill="#E8E2CC"
            paddingAngle={3}
            dataKey="value"
            nameKey="name"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color || defaultColors[index % defaultColors.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: '#37322B',
              border: 'none',
              borderRadius: '12px',
              boxShadow: '12px 12px 24px rgba(55, 50, 43, 0.12)',
              color: '#FAFAF9',
            }}
            formatter={(value: number, name: string) => [value, name]}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-display-sm font-bold text-ink-900 dark:text-ink-100">{totalValue}</span>
        <span className="text-body-sm text-ink-500 dark:text-ink-400">{totalLabel}</span>
      </div>
    </div>
  )
}

const defaultColors = [
  '#FE5D26', '#22C55E', '#F59E0B', '#3B82F6',
  '#8B5CF6', '#EF4444', '#EC4899', '#06B6D4',
]