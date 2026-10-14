import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Area } from 'recharts'
import { cn } from '@/utils/helpers'

interface ChartData {
  name: string
  [key: string]: string | number
}

interface LineChartProps {
  data: ChartData[]
  keys: string[]
  labels: Record<string, string>
  colors: string[]
  height?: number
  className?: string
  index?: string
  area?: boolean
  showDots?: boolean
}

export function LineChartComponent({
  data,
  keys,
  labels,
  colors,
  height = 300,
  className,
  index = 'name',
  area = false,
  showDots = false,
}: LineChartProps) {
  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E8E2CC" vertical={false} />
          <XAxis
            dataKey={index}
            tick={{ fill: '#9A9070', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#9A9070', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#37322B',
              border: 'none',
              borderRadius: '12px',
              boxShadow: '12px 12px 24px rgba(55, 50, 43, 0.12)',
              color: '#FAFAF9',
            }}
            labelStyle={{ color: '#A3A3A3', fontSize: '12px' }}
            formatter={(value: number, name: string) => [value, labels[name] || name]}
          />
          <Legend
            wrapperStyle={{ paddingTop: '10px' }}
            iconType="circle"
            iconSize={8}
            formatter={(name) => labels[name] || name}
          />
          {keys.map((key, i) => (
            <>
              {area && (
                <Area
                  key={`${key}-area`}
                  type="monotone"
                  dataKey={key}
                  name={key}
                  stroke={colors[i % colors.length]}
                  fill={colors[i % colors.length]}
                  fillOpacity={0.1}
                  strokeWidth={2}
                  dot={showDots}
                  activeDot={{ r: 6, strokeWidth: 2 }}
                />
              )}
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                name={key}
                stroke={colors[i % colors.length]}
                strokeWidth={2}
                dot={showDots}
                activeDot={{ r: 6, strokeWidth: 2 }}
              />
            </>
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

interface FunnelChartProps {
  data: { stage: string; count: number; conversionRate?: number }[]
  height?: number  // kept for API compatibility, no longer used for fixed height
  className?: string
}

export function FunnelChart({ data, className }: FunnelChartProps) {
  const maxCount = Math.max(...data.map((d) => d.count), 1)

  return (
    <div className={cn('w-full', className)}>
      <div className="flex flex-col gap-2">
        {data.map((item, index) => {
          const widthPct = Math.max((item.count / maxCount) * 100, 12)
          const prevCount = index > 0 ? data[index - 1].count : item.count
          const rate = prevCount > 0 ? ((item.count / prevCount) * 100).toFixed(1) : '100'

          return (
            <div key={item.stage} className="w-full">
              {/* Stage label + meta row — always full width, always visible */}
              <div className="flex items-baseline justify-between mb-1 px-1">
                <span className="text-label-sm font-semibold text-ink-800 dark:text-ink-200">
                  {item.stage}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-label-sm font-bold text-ink-900 dark:text-ink-100">
                    {item.count}
                  </span>
                  {index > 0 && (
                    <span className="text-body-xs text-ink-500 dark:text-ink-400">
                      {rate}% from previous
                    </span>
                  )}
                </div>
              </div>
              {/* Funnel bar — width shrinks to show funnel shape */}
              <div className="w-full bg-glass-200 dark:bg-glass-dark-300 rounded-lg h-8 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-lavender-500 to-lavender-400 dark:from-lavender-600 dark:to-lavender-500 rounded-lg transition-all duration-500"
                  style={{ width: `${widthPct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}