import { Link, useRouter } from '@tanstack/react-router'
import { LogOut, Settings, Shield, Sparkles, Store, User } from 'lucide-react'

import { authClient } from '#/lib/auth-client'
import { useAuth } from '#/lib/auth-hooks'
import { m } from '#/paraglide/messages'
import {
  DropdownMenu,
  DropdownMenuGroup,
  DropdownMenuGroupLabel,
  DropdownMenuItem,
  DropdownMenuPopup,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/primitives/dropdown-menu'

export default function UserMenu() {
  const router = useRouter()
  const { user } = useAuth()

  if (!user) {
    return (
      <Link
        to='/signin'
        className='inline-flex items-center rounded-lg px-2 py-1.5 text-sm font-medium text-text-primary transition-colors duration-fast ease-out hover:bg-bg-inset whitespace-nowrap flex-shrink-0'
        style={{ whiteSpace: 'nowrap' }}
      >
        {m.nav_sign_in()}
      </Link>
    )
  }

  const handleSignOut = () => {
    void authClient.signOut()
  }

  const initials = user.name?.charAt(0).toUpperCase() || 'U'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className='flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-text-primary transition-colors duration-fast ease-out hover:bg-bg-inset'
        aria-haspopup='menu'
      >
        {user.image ? (
          <img src={user.image} alt='' className='size-5 rounded-full object-cover' />
        ) : (
          <div className='flex size-5 items-center justify-center rounded-full bg-surface-inset'>
            <span className='text-xs font-medium text-text-secondary'>{initials}</span>
          </div>
        )}
        <span className='hidden max-w-[100px] truncate sm:inline'>{user.name}</span>
        <span className='sr-only'>{m.sr_user_menu()}</span>
      </DropdownMenuTrigger>

      <DropdownMenuPortal>
        <DropdownMenuPopup>
          <DropdownMenuGroup>
            <DropdownMenuGroupLabel className='px-3 py-2 text-xs font-medium text-text-muted'>
              {user.email}
            </DropdownMenuGroupLabel>
          </DropdownMenuGroup>

          <DropdownMenuSeparator className='mx-1 my-1 h-px bg-border-default' />

          <DropdownMenuItem onClick={() => router.navigate({ to: '/account' })}>
            <User size={16} />
            {m.nav_account()}
          </DropdownMenuItem>

          {user.role === 'customer' && (
            <DropdownMenuItem onClick={() => router.navigate({ to: '/sell' })}>
              <Sparkles size={16} />
              {m.become_creator()}
            </DropdownMenuItem>
          )}

          {(user.role === 'creator' || user.role === 'admin') && (
            <DropdownMenuItem onClick={() => router.navigate({ to: '/studio' })}>
              <Store size={16} />
              {m.nav_studio()}
            </DropdownMenuItem>
          )}

          {user.role === 'admin' && (
            <DropdownMenuItem onClick={() => router.navigate({ to: '/admin' })}>
              <Shield size={16} />
              {m.nav_admin()}
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator className='mx-1 my-1 h-px bg-border-default' />

          <DropdownMenuItem onClick={() => router.navigate({ to: '/account/settings' })}>
            <Settings size={16} />
            {m.nav_settings()}
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={handleSignOut}
            className='text-error hover:bg-error-subtle focus-visible:bg-error-subtle'
          >
            <LogOut size={16} />
            {m.nav_sign_out()}
          </DropdownMenuItem>
        </DropdownMenuPopup>
      </DropdownMenuPortal>
    </DropdownMenu>
  )
}
