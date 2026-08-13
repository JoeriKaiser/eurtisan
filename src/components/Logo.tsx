import { Link } from '@tanstack/react-router'
import { m } from '#/paraglide/messages'

interface LogoProps {
  className?: string
  iconClassName?: string
  textClassName?: string
  showText?: boolean
  variant?: 'default' | 'minimal' | 'monochrome'
  onClick?: () => void
}

export default function Logo({
  className = '',
  iconClassName = '',
  textClassName = '',
  showText = true,
  variant = 'default',
  onClick,
}: LogoProps) {
  // Determine fill color based on variant
  const fillColor =
    variant === 'default'
      ? 'var(--ds-text-brand)'
      : variant === 'minimal'
        ? 'var(--ds-text-primary)'
        : 'currentColor'

  const textColor =
    variant === 'default'
      ? 'text-text-brand'
      : variant === 'minimal'
        ? 'text-text-primary'
        : 'text-current'

  const svgIcon = (
    <svg
      className={`size-6 flex-shrink-0 transition-transform duration-fast ease-out group-hover:scale-105 ${iconClassName}`}
      viewBox='0 0 32 32'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
      aria-hidden='true'
    >
      {/* Modern Brick/Masonry Monogram 'E' - Shifted by -1.25px vertically for perfect vertical centering */}
      {/* Top horizontal brick */}
      <rect x='6' y='1.75' width='20' height='4.5' fill={fillColor} rx='0.75' />
      {/* Upper vertical connector brick */}
      <rect x='6' y='7.25' width='5.5' height='5.5' fill={fillColor} rx='0.75' />
      {/* Middle horizontal brick (slightly shorter for visual balance) */}
      <rect x='6' y='13.75' width='16' height='4.5' fill={fillColor} rx='0.75' />
      {/* Lower vertical connector brick */}
      <rect x='6' y='19.25' width='5.5' height='5.5' fill={fillColor} rx='0.75' />
      {/* Bottom horizontal brick */}
      <rect x='6' y='25.75' width='20' height='4.5' fill={fillColor} rx='0.75' />
    </svg>
  )

  return (
    <Link
      to='/'
      onClick={onClick}
      className={`group flex-shrink-0 flex items-center gap-2 no-underline transition-all duration-fast ease-out hover:opacity-95 ${className}`}
    >
      {svgIcon}
      {showText && (
        <span
          className={`font-display text-xl font-bold tracking-tight ${textColor} ${textClassName}`}
        >
          {m.nav_logo()}
        </span>
      )}
    </Link>
  )
}
