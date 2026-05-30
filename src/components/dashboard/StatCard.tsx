import { Link } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'

interface StatCardProps {
  title: string
  value: string
  icon: React.ReactNode
  href: string
}

export function StatCard({ title, value, icon, href }: StatCardProps) {
  return (
    <Link to={href} className='no-underline'>
      <Card className='h-full transition hover:border-border-strong hover:bg-bg-inset'>
        <CardHeader className='pb-2'>
          <div className='flex items-center justify-between'>
            <CardTitle className='text-sm font-medium text-text-secondary'>{title}</CardTitle>
            <div className='flex size-6 items-center justify-center rounded-full bg-surface-inset text-text-muted'>
              {icon}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className='text-2xl font-bold text-text-primary'>{value}</p>
        </CardContent>
      </Card>
    </Link>
  )
}
