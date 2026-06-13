import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { m } from '#/paraglide/messages'
import Logo from '../Logo'

interface Props {
  title: string
  description?: string
  children: React.ReactNode
}

export function AuthShell({ title, description, children }: Props) {
  return (
    <main className='relative flex min-h-[calc(100vh-380px)] flex-col items-center justify-start overflow-hidden bg-gradient-to-b from-surface-default via-surface-default to-accent-primary/5 px-4 pt-4 pb-8 sm:pt-6 sm:pb-12'>
      {/* Background radial highlight */}
      <div className='pointer-events-none absolute -top-1/2 left-1/2 size-[1000px] -translate-x-1/2 rounded-full bg-radial from-accent-primary/5 to-transparent blur-3xl' />

      <div className='relative w-full max-w-md'>
        {/* Back Link */}
        <div className='mb-4 flex justify-start'>
          <Link
            to='/'
            className='inline-flex items-center gap-2 text-sm text-text-muted hover:text-text-primary transition-colors duration-fast ease-out'
          >
            <ArrowLeft size={16} />
            <span>{m.button_back_to_home()}</span>
          </Link>
        </div>

        {/* Card Shell */}
        <div className='island-shell relative rounded-2xl border border-border-default bg-surface-default/80 pt-5 pb-6 px-5 shadow-xl backdrop-blur-md sm:pt-6 sm:pb-8 sm:px-8'>
          {/* Logo & Header */}
          <div className='mb-4 flex flex-col items-center text-center'>
            <Logo className='mb-2 justify-center' textClassName='text-3xl' />
            <h1 className='text-2xl font-semibold tracking-tight text-text-primary'>{title}</h1>
            {description && <p className='mt-1 text-sm text-text-secondary'>{description}</p>}
          </div>

          {children}
        </div>
      </div>
    </main>
  )
}
