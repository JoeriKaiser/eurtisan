import { Link, useLocation } from '@tanstack/react-router'
import { Bell, Package, Settings, User } from 'lucide-react'
import { m } from '#/paraglide/messages'

export interface BreadcrumbItem {
  label: string
  to?: string
}

interface AccountBreadcrumbsProps {
  items: BreadcrumbItem[]
}

export function AccountBreadcrumbs({ items }: AccountBreadcrumbsProps) {
  return (
    <nav aria-label={m.account_breadcrumb_label()}>
      <ol className='flex flex-wrap items-center gap-2 text-sm text-text-secondary'>
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <li key={`${item.label}-${item.to ?? 'current'}`} className='flex items-center gap-2'>
              {index > 0 && <span aria-hidden='true'>/</span>}
              {item.to && !isLast ? (
                <Link
                  to={item.to as never}
                  className='text-text-secondary transition-colors hover:text-text-primary no-underline'
                >
                  {item.label}
                </Link>
              ) : (
                <span className={isLast ? 'font-medium text-text-primary' : undefined}>
                  {item.label}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

interface AccountSubNavItem {
  to: string
  label: string
  icon: React.ReactNode
}

function useActiveSubNav(pathname: string): (to: string) => boolean {
  return (to: string) => {
    if (to === '/account') {
      return pathname === '/account' || pathname === '/account/'
    }
    return pathname.startsWith(to)
  }
}

export function AccountSubNav() {
  const { pathname } = useLocation()
  const isActive = useActiveSubNav(pathname)

  const items: AccountSubNavItem[] = [
    {
      to: '/account',
      label: m.account_title(),
      icon: <User size={16} aria-hidden='true' />,
    },
    {
      to: '/account/orders',
      label: m.account_orders(),
      icon: <Package size={16} aria-hidden='true' />,
    },
    {
      to: '/account/settings',
      label: m.account_settings(),
      icon: <Settings size={16} aria-hidden='true' />,
    },
    {
      to: '/notifications',
      label: m.notifications_title(),
      icon: <Bell size={16} aria-hidden='true' />,
    },
  ]

  return (
    <nav aria-label={m.account_subnav_label()}>
      <ul className='flex flex-wrap gap-2 border-b border-border-default'>
        {items.map((item) => {
          const active = isActive(item.to)
          return (
            <li key={item.to}>
              <Link
                to={item.to as never}
                className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors no-underline ${
                  active
                    ? 'border-accent-primary text-text-primary'
                    : 'border-transparent text-text-secondary hover:border-border-strong hover:text-text-primary'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                {item.icon}
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

interface AccountShellProps {
  children: React.ReactNode
  breadcrumbs: BreadcrumbItem[]
}

export function AccountShell({ children, breadcrumbs }: AccountShellProps) {
  return (
    <div className='page-wrap px-4 py-3 sm:py-4'>
      <div className='mx-auto max-w-5xl space-y-2'>
        <AccountBreadcrumbs items={breadcrumbs} />
        <AccountSubNav />
        <div>{children}</div>
      </div>
    </div>
  )
}
