import { Link } from '@tanstack/react-router'
import { m } from '#/paraglide/messages'
import LocaleDropdown from './LocaleDropdown'

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className='border-t border-border-subtle bg-bg-elevated mt-20 px-6 pb-12 pt-16 text-text-secondary'>
      <div className='max-w-7xl mx-auto grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5'>
        {/* Left Column: Brand & Tagline */}
        <div className='flex flex-col gap-4 lg:col-span-2'>
          <Link
            to='/'
            className='font-display text-2xl font-bold tracking-tight text-text-primary no-underline hover:text-accent-primary transition-colors'
          >
            {m.nav_logo()}
          </Link>
          <p className='text-sm text-text-secondary leading-relaxed max-w-xs'>
            {m.footer_tagline()}
          </p>
          <div className='flex gap-3 mt-2'>
            <a
              href='https://x.com/tan_stack'
              target='_blank'
              rel='noreferrer'
              className='rounded-xl p-2 text-text-secondary transition-colors duration-fast ease-out hover:bg-bg-inset hover:text-text-primary'
            >
              <span className='sr-only'>{m.sr_follow_x()}</span>
              <svg viewBox='0 0 16 16' aria-hidden='true' width='20' height='20'>
                <path
                  fill='currentColor'
                  d='M12.6 1h2.2L10 6.48 15.64 15h-4.41L7.78 9.82 3.23 15H1l5.14-5.84L.72 1h4.52l3.12 4.73L12.6 1zm-.77 12.67h1.22L4.57 2.26H3.26l8.57 11.41z'
                />
              </svg>
            </a>
            <a
              href='https://github.com/TanStack'
              target='_blank'
              rel='noreferrer'
              className='rounded-xl p-2 text-text-secondary transition-colors duration-fast ease-out hover:bg-bg-inset hover:text-text-primary'
            >
              <span className='sr-only'>{m.sr_github()}</span>
              <svg viewBox='0 0 16 16' aria-hidden='true' width='20' height='20'>
                <path
                  fill='currentColor'
                  d='M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z'
                />
              </svg>
            </a>
          </div>
        </div>

        {/* Column 2: Marketplace */}
        <div className='flex flex-col gap-3'>
          <h3 className='text-xs font-semibold uppercase tracking-wider text-text-primary'>
            {m.nav_main()}
          </h3>
          <ul className='list-none p-0 m-0 flex flex-col gap-2'>
            <li>
              <Link
                to='/search'
                className='text-sm text-text-secondary hover:text-text-primary no-underline transition-colors'
              >
                {m.footer_nav_browse()}
              </Link>
            </li>
            <li>
              <Link
                to='/category/all'
                className='text-sm text-text-secondary hover:text-text-primary no-underline transition-colors'
              >
                {m.nav_categories()}
              </Link>
            </li>
            <li>
              <Link
                to='/about'
                className='text-sm text-text-secondary hover:text-text-primary no-underline transition-colors'
              >
                {m.footer_nav_about()}
              </Link>
            </li>
          </ul>
        </div>

        {/* Column 3: Artisans */}
        <div className='flex flex-col gap-3'>
          <h3 className='text-xs font-semibold uppercase tracking-wider text-text-primary'>
            {m.home_makers_kicker()}
          </h3>
          <ul className='list-none p-0 m-0 flex flex-col gap-2'>
            <li>
              <Link
                to='/sell'
                className='text-sm text-text-secondary hover:text-text-primary no-underline transition-colors'
              >
                {m.footer_nav_sell()}
              </Link>
            </li>
          </ul>
        </div>

        {/* Column 4: Legal */}
        <div className='flex flex-col gap-3'>
          <h3 className='text-xs font-semibold uppercase tracking-wider text-text-primary'>
            Legal
          </h3>
          <ul className='list-none p-0 m-0 flex flex-col gap-2'>
            <li>
              <Link
                to='/privacy'
                className='text-sm text-text-secondary hover:text-text-primary no-underline transition-colors'
              >
                {m.footer_legal_privacy()}
              </Link>
            </li>
            <li>
              <Link
                to='/terms'
                className='text-sm text-text-secondary hover:text-text-primary no-underline transition-colors'
              >
                {m.footer_legal_terms()}
              </Link>
            </li>
            <li>
              <Link
                to='/cookies'
                className='text-sm text-text-secondary hover:text-text-primary no-underline transition-colors'
              >
                {m.footer_legal_cookies()}
              </Link>
            </li>
          </ul>
        </div>
      </div>

      {/* Bottom Section */}
      <div className='max-w-7xl mx-auto mt-12 pt-8 border-t border-border-subtle flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left'>
        <div className='flex flex-col sm:flex-row items-center gap-2 sm:gap-6'>
          <p className='m-0 text-xs'>{m.footer_copyright({ year: year.toString() })}</p>
          <span className='hidden sm:inline text-border-strong'>|</span>
          <p className='m-0 text-xs font-medium tracking-wide text-text-muted'>
            {m.footer_built_with()}
          </p>
        </div>
        <div className='flex items-center gap-4'>
          <LocaleDropdown />
        </div>
      </div>
    </footer>
  )
}
