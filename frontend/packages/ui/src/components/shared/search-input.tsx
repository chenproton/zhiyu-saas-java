'use client'

import * as React from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export interface SearchInputProps
  extends Omit<React.ComponentProps<'input'>, 'type' | 'onChange' | 'onKeyDown' | 'className'> {
  value: string
  onChange: (value: string) => void
  onSearch?: () => void
  searchButton?: React.ReactNode
  icon?: React.ReactNode
  wrapperClassName?: string
  iconClassName?: string
  inputClassName?: string
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>
}

export function SearchInput({
  value,
  onChange,
  onSearch,
  searchButton,
  icon,
  wrapperClassName,
  iconClassName,
  inputClassName,
  onKeyDown,
  ...props
}: SearchInputProps) {
  return (
    <div className={cn('relative', wrapperClassName)}>
      <span
        className={cn(
          'pointer-events-none',
          iconClassName ??
            'absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground',
        )}
      >
        {icon ? (
          React.cloneElement(icon as React.ReactElement<{ className?: string }>, {
            className: cn(
              'h-full w-full',
              (icon as React.ReactElement<{ className?: string }>).props?.className,
            ),
          })
        ) : (
          <Search className="h-full w-full" />
        )}
      </span>
      <Input
        type="search"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          onKeyDown?.(e)
          if (e.key === 'Enter') onSearch?.()
        }}
        className={cn('pl-9', inputClassName)}
        {...props}
      />
      {searchButton && (
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2">{searchButton}</div>
      )}
    </div>
  )
}
