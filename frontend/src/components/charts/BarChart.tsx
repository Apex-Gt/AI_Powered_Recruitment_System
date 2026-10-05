import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { cn } from '@/utils/helpers'

interface ChartData {
  name: string
  [key: string]: string | number
}

interface BarChartProps {
  data: ChartData[]
  keys: string[]
  labels: Record<string, string>
  colors: string[]
  height?: number
  className?: string
  index?: string
  stacked?: boolean
}

export function BarChartComponent({
  data,
  keys,
  labels,
  colors,
  height = 300,
  className,
  index = 'name',
  stacked = false,
}: BarChartProps) {
  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E8E2CC" vertical={false} />
          <XAxis type="number" tick={{ fill: '#9A9070', fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis
            type="category"
            dataKey={index}
            tick={{ fill: '#797059', fontSize: 12, fontWeight: 500 }}
            axisLine={false}
            tickLine={false}
            width={120}
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
            <Bar
              key={key}
              dataKey={key}
              name={key}
              fill={colors[i % colors.length]}
              radius={[0, 4, 4, 0]}
              stackId={stacked ? 'a' : undefined}
              maxBarSize={32}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

interface HorizontalBarChartProps {
  data: ChartData[]
  key: string
  label: string
  color: string
  height?: number
  className?: string
  index?: string
}

export function HorizontalBarChart({
  data,
  key,
  label,
  color,
  height = 300,
  className,
  index = 'name',
}: HorizontalBarChartProps) {
  return (
    <BarChartComponent
      data={data}
      keys={[key]}
      labels={{ [key]: label }}
      colors={[color]}
      height={height}
      className={className}
      index={index}
    />
  )
}