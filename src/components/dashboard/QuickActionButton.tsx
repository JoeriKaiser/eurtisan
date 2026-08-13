import { Link } from '@tanstack/react-router'

interface QuickActionButtonProps {
  label: string
  icon: React.ReactNode
  to: string
}

export function QuickActionButton({ label, icon, to }: QuickActionButtonProps) {
  return (
    <Link
      to={to}
      className='flex flex-col items-center gap-2 rounded-xl border border-border-default bg-surface-default p-4 text-center transition hover:border-border-strong hover:bg-bg-inset no-underline'
    >
      <div className='flex size-10 items-center justify-center rounded-full bg-surface-inset text-text-muted'>
        {icon}
      </div>
      <span className='text-sm font-medium text-text-primary'>{label}</span>
    </Link>
  )
}
