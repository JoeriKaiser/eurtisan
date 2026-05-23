import { Menu } from '@base-ui-components/react/menu'
import type * as React from 'react'
import { cn } from '#/lib/cn'

export const DropdownMenu = Menu.Root
export const DropdownMenuTrigger = Menu.Trigger
export const DropdownMenuPortal = Menu.Portal
export const DropdownMenuSeparator = Menu.Separator
export const DropdownMenuGroup = Menu.Group
export const DropdownMenuGroupLabel = Menu.GroupLabel

export function DropdownMenuPopup({
  className,
  ref,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { ref?: React.Ref<HTMLDivElement> }) {
  return (
    <Menu.Positioner className='z-sticky' sideOffset={6}>
      <Menu.Popup
        ref={ref}
        className={cn(
          'w-56 rounded-xl border border-border-default bg-surface-default p-1.5 shadow-lg',
          'outline-none',
          'transition-all duration-fast ease-out',
          'data-[ending-style]:opacity-0 data-[ending-style]:scale-95',
          'data-[starting-style]:opacity-0 data-[starting-style]:scale-95',
          className,
        )}
        {...props}
      />
    </Menu.Positioner>
  )
}

export interface DropdownMenuItemProps extends React.HTMLAttributes<HTMLDivElement> {
  disabled?: boolean
  ref?: React.Ref<HTMLDivElement>
}

export function DropdownMenuItem({ className, disabled, ref, ...props }: DropdownMenuItemProps) {
  return (
    <Menu.Item
      ref={ref}
      disabled={disabled}
      className={cn(
        'flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-primary',
        'outline-none transition-colors duration-fast ease-out',
        'hover:bg-bg-inset focus-visible:bg-bg-inset',
        'data-[disabled]:opacity-40 data-[disabled]:cursor-not-allowed',
        className,
      )}
      {...props}
    />
  )
}
