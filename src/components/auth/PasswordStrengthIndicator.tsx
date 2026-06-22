import { Check, X } from 'lucide-react'
import { useMemo } from 'react'
import { m } from '#/paraglide/messages'

interface Props {
  password?: string
}

export function PasswordStrengthIndicator({ password = '' }: Props) {
  const criteria = useMemo(() => {
    return [
      {
        id: 'length',
        label: m.password_rule_length(),
        test: (pwd: string) => pwd.length >= 8,
      },
      {
        id: 'uppercase',
        label: m.password_rule_uppercase(),
        test: (pwd: string) => /[A-Z]/.test(pwd),
      },
      {
        id: 'lowercase',
        label: m.password_rule_lowercase(),
        test: (pwd: string) => /[a-z]/.test(pwd),
      },
      {
        id: 'number',
        label: m.password_rule_number(),
        test: (pwd: string) => /[0-9]/.test(pwd),
      },
      {
        id: 'special',
        label: m.password_rule_special(),
        test: (pwd: string) => /[^A-Za-z0-9]/.test(pwd),
      },
    ]
  }, [])

  const results = useMemo(() => {
    return criteria.map((c) => ({
      ...c,
      valid: c.test(password),
    }))
  }, [password, criteria])

  const score = useMemo(() => {
    if (!password) return 0
    return results.filter((r) => r.valid).length
  }, [password, results])

  const strength = useMemo(() => {
    if (!password)
      return { label: '', color: 'bg-surface-inset', textClass: 'text-text-muted', percent: 0 }
    if (score <= 1) {
      return {
        label: m.password_strength_weak(),
        color: 'bg-error',
        textClass: 'text-error',
        percent: 20,
      }
    }
    if (score === 2) {
      return {
        label: m.password_strength_fair(),
        color: 'bg-warning',
        textClass: 'text-warning',
        percent: 45,
      }
    }
    if (score <= 4) {
      return {
        label: m.password_strength_good(),
        color: 'bg-accent-primary',
        textClass: 'text-accent-primary',
        percent: 75,
      }
    }
    return {
      label: m.password_strength_strong(),
      color: 'bg-success',
      textClass: 'text-success',
      percent: 100,
    }
  }, [password, score])

  if (!password) return null

  return (
    <div className='mt-1.5 space-y-2' aria-live='polite'>
      {/* Visual Indicator Bar */}
      <div>
        <div className='flex items-center justify-between text-xs mb-0.5'>
          <span className='text-text-muted'>{m.password_strength_label()}</span>
          <span className={`font-semibold ${strength.textClass}`}>{strength.label}</span>
        </div>
        <div className='h-1.5 w-full rounded-full bg-surface-inset overflow-hidden'>
          <div
            className={`h-full rounded-full transition-all duration-300 ease-out ${strength.color}`}
            style={{ width: `${strength.percent}%` }}
          />
        </div>
      </div>

      {/* Rules Checklist */}
      <ul
        className='grid grid-cols-1 gap-1 text-xs sm:grid-cols-2'
        aria-label='Password requirements'
      >
        {results.map((r) => (
          <li
            key={r.id}
            className={`flex items-center gap-1.5 transition-colors ${
              r.valid ? 'text-success' : 'text-text-muted'
            }`}
          >
            {r.valid ? (
              <Check size={14} className='shrink-0 text-success' />
            ) : (
              <X size={14} className='shrink-0 text-text-muted/60' />
            )}
            <span>{r.label}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
