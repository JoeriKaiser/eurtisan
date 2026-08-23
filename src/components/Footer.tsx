import { Link } from '@tanstack/react-router'
import { m } from '#/paraglide/messages'
import LocaleDropdown from './LocaleDropdown'
import Logo from './Logo'

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className='border-t border-border-subtle bg-bg-elevated mt-20 px-6 pb-12 pt-16 text-text-secondary'>
      <div className='max-w-7xl mx-auto grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5'>
        {/* Left Column: Brand & Tagline */}
        <div className='flex flex-col gap-4 lg:col-span-2'>
          <Logo textClassName='text-2xl' />
          <p className='text-sm text-text-secondary leading-relaxed max-w-xs'>
            {m.footer_tagline()}
          </p>
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
            <li>
              <Link
                to='/imprint'
                className='text-sm text-text-secondary hover:text-text-primary no-underline transition-colors'
              >
                {m.imprint_footer_link()}
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
