import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          'bg-gradient-to-r from-[#4f46e5] to-[#7c3aed] text-white shadow-md shadow-[#4f46e5]/20 hover:from-[#4338ca] hover:to-[#6d28d9]',
        destructive:
          'bg-gradient-to-r from-[#f43f5e] to-[#e11d48] text-white shadow-md shadow-[#f43f5e]/20 hover:from-[#e11d48] hover:to-[#be123c]',
        outline:
          'border-2 border-[#c7d2fe] bg-white text-[#4f46e5] shadow-xs hover:border-[#a5b4fc] hover:bg-[#eef2ff]',
        secondary:
          'bg-gradient-to-r from-[#06b6d4] to-[#14b8a6] text-white shadow-md shadow-[#06b6d4]/20 hover:from-[#0891b2] hover:to-[#0d9488]',
        ghost: 'text-[#4f46e5] hover:bg-[#eef2ff] hover:text-[#4338ca]',
        link: 'text-[#4f46e5] underline-offset-4 hover:text-[#7c3aed] hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
        icon: 'size-9',
        'icon-sm': 'size-8',
        'icon-lg': 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
