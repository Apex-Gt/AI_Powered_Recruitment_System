import { ReactNode, TableHTMLAttributes, ThHTMLAttributes, TdHTMLAttributes } from 'react'
import { cn } from '@/utils/helpers'

interface Column<T> {
  key: string
  header: string
  render?: (row: T, index: number) => ReactNode
  className?: string
  headerClassName?: string
  width?: string
}

interface TableProps<T> {
  columns?: Column<T>[]
  data?: T[]
  keyExtractor?: (row: T) => string
  rowClassName?: (row: T) => string
  emptyMessage?: string
  loading?: boolean
  loadingRows?: number
  onRowClick?: (row: T) => void
  striped?: boolean
  hoverable?: boolean
  children?: ReactNode
}

export function Table<T>({
  columns,
  data,
  keyExtractor,
  rowClassName,
  emptyMessage = 'No data available',
  loading = false,
  loadingRows = 5,
  onRowClick,
  striped = false,
  hoverable = true,
  children,
}: TableProps<T>) {
  // If children are provided, render them directly (legacy/composable pattern)
  if (children) {
    return (
      <div className="table-container">
        <table className="table" role="grid">
          {children}
        </table>
      </div>
    )
  }

  // Data-driven pattern
  if (!columns || !data || !keyExtractor) {
    throw new Error('Table requires columns, data, and keyExtractor when not using children')
  }

  const renderLoadingRows = () =>
    Array.from({ length: loadingRows }, (_, i) => (
      <tr key={`loading-${i}`}>
        {columns.map((col) => (
          <td key={col.key} className="px-4 py-3">
            <div className="skeleton-text h-5 w-full" />
          </td>
        ))}
      </tr>
    ))

  if (loading) {
    return (
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn('px-4 py-3 text-label-sm text-ink-500 dark:text-ink-400 font-medium bg-glass-50 dark:bg-glass-dark-50 border-b border-glass-200 dark:border-glass-dark-200', col.headerClassName)}
                  style={{ width: col.width }}
                >
                  <div className="skeleton-text h-4 w-3/4" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{renderLoadingRows()}</tbody>
        </table>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn('px-4 py-3 text-label-sm text-ink-500 dark:text-ink-400 font-medium bg-glass-50 dark:bg-glass-dark-50 border-b border-glass-200 dark:border-glass-dark-200', col.headerClassName)}
                  style={{ width: col.width }}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center text-ink-500 dark:text-ink-400">
                {emptyMessage}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="table-container">
      <table className="table" role="grid">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn('px-4 py-3 text-label-sm text-ink-500 dark:text-ink-400 font-medium bg-glass-50 dark:bg-glass-dark-50 border-b border-glass-200 dark:border-glass-dark-200', col.headerClassName)}
                style={{ width: col.width }}
                scope="col"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr
              key={keyExtractor(row)}
              className={cn(
                rowClassName?.(row),
                striped && rowIndex % 2 === 0 && 'bg-glass-50 dark:bg-glass-dark-50',
                hoverable && 'hover:bg-glass-100 dark:hover:bg-glass-dark-100',
                onRowClick && 'cursor-pointer'
              )}
              onClick={() => onRowClick?.(row)}
              tabIndex={onRowClick ? 0 : undefined}
              onKeyDown={(e) => {
                if (onRowClick && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault()
                  onRowClick(row)
                }
              }}
              role={onRowClick ? 'button' : undefined}
              aria-pressed={onRowClick ? 'false' : undefined}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn('px-4 py-3 text-body-sm text-ink-900 dark:text-ink-100 border-b border-glass-100 dark:border-glass-dark-100', col.className)}
                >
                  {col.render ? col.render(row, rowIndex) : (row as Record<string, unknown>)[col.key] as ReactNode}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function TableHeader({ className, children, ...props }: ThHTMLAttributes<HTMLTableHeaderCellElement>) {
  return (
    <th className={cn('px-4 py-3 text-label-sm text-ink-500 dark:text-ink-400 font-medium bg-glass-50 dark:bg-glass-dark-50 border-b border-glass-200 dark:border-glass-dark-200', className)} {...props}>
      {children}
    </th>
  )
}

export function TableCell({ className, children, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn('px-4 py-3 text-body-sm text-ink-900 dark:text-ink-100 border-b border-glass-100 dark:border-glass-dark-100', className)} {...props}>
      {children}
    </td>
  )
}

export function TableRow({ className, children, ...props }: TableHTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('', className)} {...props}>{children}</tr>
}

export function TableBody({ className, children, ...props }: TableHTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('', className)} {...props}>{children}</tbody>
}

export function TableHead({ className, children, ...props }: TableHTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('', className)} {...props}>{children}</thead>
}

export function TableFooter({ className, children, ...props }: TableHTMLAttributes<HTMLTableSectionElement>) {
  return <tfoot className={cn('', className)} {...props}>{children}</tfoot>
}