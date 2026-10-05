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
  height?: number
  className?: string
}

export function FunnelChart({ data, height = 400, className }: FunnelChartProps) {
  const maxCount = Math.max(...data.map((d) => d.count))

  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <div className="flex flex-col items-center gap-4">
        {data.map((item, index) => {
          const width = (item.count / maxCount) * 100
          const prevCount = index > 0 ? data[index - 1].count : item.count
          const rate = prevCount > 0 ? ((item.count / prevCount) * 100).toFixed(1) : '100'

          return (
            <div
              key={item.stage}
              className="w-full max-w-md flex flex-col items-center gap-1 transition-all duration-500"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div
                className="w-full bg-base-200 dark:bg-base-700 rounded-xl overflow-hidden relative"
                style={{ width: `${width}%`, minWidth: '60px' }}
              >
                <div
                  className="h-12 bg-accent-500 flex items-center justify-center px-4"
                  style={{ width: '100%' }}
                >
                  <span className="text-label-md font-medium text-white text-center truncate">
                    {item.stage}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4 w-full max-w-md px-2">
                <span className="text-body-sm font-medium text-ink-900 dark:text-ink-100 w-24 text-right">
                  {item.count}
                </span>
                {index > 0 && (
                  <span className="text-body-xs text-ink-500 dark:text-ink-400">
                    {rate}% from previous
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}