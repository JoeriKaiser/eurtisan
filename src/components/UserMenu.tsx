import { Link, useRouter } from '@tanstack/react-router'
import { LogOut, Settings, Shield, Sparkles, Store, User } from 'lucide-react'
import { useState } from 'react'

import { authClient } from '#/lib/auth-client'
import { useAuth } from '#/lib/auth-hooks'
import { becomeCreator } from '#/lib/server-auth'
import { m } from '#/paraglide/messages'

export default function UserMenu() {
  const router = useRouter()
  const { user, isPending } = useAuth()
  const [open, setOpen] = useState(false)
  const [upgrading, setUpgrading] = useState(false)

  if (isPending) {
    return <div className='h-8 w-8 rounded-full bg-neutral-100 dark:bg-neutral-800 animate-pulse' />
  }

  if (!user) {
    return (
      <Link
        to='/signin'
        className='h-9 px-4 text-sm font-medium bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-50 border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors inline-flex items-center'
      >
        {m.nav_sign_in()}
      </Link>
    )
  }

  const handleSignOut = () => {
    void authClient.signOut()
    setOpen(false)
  }

  const handleBecomeCreator = async () => {
    setUpgrading(true)
    try {
      await becomeCreator({ data: {} })
      await router.invalidate()
      // Force a full reload so better-auth's session cache refreshes
      // immediately and the UI shows the updated role without delay.
      window.location.reload()
    } catch {
      // Error handled by UI; user can retry
    } finally {
      setUpgrading(false)
    }
  }

  const initials = user.name?.charAt(0).toUpperCase() || 'U'

  return (
    <div className='relative'>
      <button
        type='button'
        onClick={() => setOpen(!open)}
        className='flex items-center gap-2 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-2 py-1 text-sm text-[var(--sea-ink)] shadow-[0_8px_24px_rgba(30,90,72,0.08)] transition hover:bg-[var(--link-bg-hover)]'
        aria-haspopup='menu'
        aria-expanded={open}
      >
        {user.image ? (
          <img src={user.image} alt='' className='h-6 w-6 rounded-full object-cover' />
        ) : (
          <div className='h-6 w-6 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center'>
            <span className='text-xs font-medium text-neutral-600 dark:text-neutral-400'>
              {initials}
            </span>
          </div>
        )}
        <span className='max-w-[120px] truncate hidden sm:inline'>{user.name}</span>
        <span className='sr-only'>{m.sr_user_menu()}</span>
      </button>

      {open && (
        <>
          <div className='fixed inset-0 z-40' onClick={() => setOpen(false)} aria-hidden='true' />
          <div
            className='absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-[var(--line)] bg-[var(--header-bg)] p-1.5 shadow-lg backdrop-blur-lg'
            role='menu'
          >
            <div className='px-3 py-2 text-xs font-medium text-[var(--sea-ink-soft)]'>
              {user.email}
            </div>
            <div className='my-1 h-px bg-[var(--line)]' />

            <Link
              to='/account'
              className='flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--sea-ink)] transition hover:bg-[var(--link-bg-hover)]'
              onClick={() => setOpen(false)}
              role='menuitem'
            >
              <User size={16} />
              {m.nav_account()}
            </Link>

            {user.role === 'customer' && (
              <button
                type='button'
                onClick={handleBecomeCreator}
                disabled={upgrading}
                className='flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[var(--sea-ink)] transition hover:bg-[var(--link-bg-hover)] disabled:opacity-50'
                role='menuitem'
              >
                <Sparkles size={16} />
                {upgrading ? m.become_creator_loading() : m.become_creator()}
              </button>
            )}

            {(user.role === 'creator' || user.role === 'admin') && (
              <Link
                to='/studio'
                className='flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--sea-ink)] transition hover:bg-[var(--link-bg-hover)]'
                onClick={() => setOpen(false)}
                role='menuitem'
              >
                <Store size={16} />
                {m.nav_studio()}
              </Link>
            )}

            {user.role === 'admin' && (
              <Link
                to='/admin'
                className='flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--sea-ink)] transition hover:bg-[var(--link-bg-hover)]'
                onClick={() => setOpen(false)}
                role='menuitem'
              >
                <Shield size={16} />
                {m.nav_admin()}
              </Link>
            )}

            <div className='my-1 h-px bg-[var(--line)]' />

            <Link
              to='/account/settings'
              className='flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--sea-ink)] transition hover:bg-[var(--link-bg-hover)]'
              onClick={() => setOpen(false)}
              role='menuitem'
            >
              <Settings size={16} />
              {m.nav_settings()}
            </Link>

            <button
              type='button'
              onClick={handleSignOut}
              className='flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 dark:text-red-400 transition hover:bg-red-50 dark:hover:bg-red-900/20'
              role='menuitem'
            >
              <LogOut size={16} />
              {m.nav_sign_out()}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
