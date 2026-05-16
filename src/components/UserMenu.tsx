import { Link, useRouter } from '@tanstack/react-router'
import { LogOut, Settings, Shield, Sparkles, Store, User } from 'lucide-react'
import { useState } from 'react'

import { authClient } from '#/lib/auth-client'
import { useAuth } from '#/lib/auth-hooks'
import { becomeCreator } from '#/lib/server-auth'
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
} from './ui/primitives'

export default function UserMenu() {
  const router = useRouter()
  const { user } = useAuth()
  const [upgrading, setUpgrading] = useState(false)

  if (!user) {
    return (
      <Link
        to='/signin'
        className='inline-flex items-center rounded-lg px-2 py-1.5 text-sm font-medium text-text-primary transition-colors duration-fast ease-out hover:bg-bg-inset'
      >
        {m.nav_sign_in()}
      </Link>
    )
  }

  const handleSignOut = () => {
    void authClient.signOut()
  }

  const handleBecomeCreator = async () => {
    setUpgrading(true)
    try {
      await becomeCreator({ data: {} })
      await router.invalidate()
      window.location.reload()
    } catch {
      // Error handled by UI; user can retry
    } finally {
      setUpgrading(false)
    }
  }

  const initials = user.name?.charAt(0).toUpperCase() || 'U'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className='flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-text-primary transition-colors duration-fast ease-out hover:bg-bg-inset'
        aria-haspopup='menu'
      >
        {user.image ? (
          <img src={user.image} alt='' className='h-5 w-5 rounded-full object-cover' />
        ) : (
          <div className='flex h-5 w-5 items-center justify-center rounded-full bg-surface-inset'>
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
            <DropdownMenuItem disabled={upgrading} onClick={handleBecomeCreator}>
              <Sparkles size={16} />
              {upgrading ? m.become_creator_loading() : m.become_creator()}
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
