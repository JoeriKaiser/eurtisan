# PRD: Production-Ready Authentication System

> **Ticket:** `AUTH-PROD-001`  
> **Status:** Draft — Ready for Review  
> **Priority:** High  
> **Target Release:** v1.0  
> **Author:** Engineering  
> **Last Updated:** 2026-05-21  

---

## 1. Executive Summary

The Eurtisan authentication system currently operates using a basic email and password form inside a single route (`/signin`). While it handles login and signup functions via the Better Auth client, it lacks the professional visual polish, accessibility compliance, internationalization coverage, robust user validation feedback, and structural workflows (such as email verification, account recovery, and preparations for future OAuth integrations) expected of a production-grade European custom merchandise marketplace.

This PRD defines the requirements to elevate Eurtisan's authentication system to a premium, production-ready standard. It specifies a unified auth shell, advanced form states (such as password strength checking and toggleable visibility), forgot-password flows, email verification setups, and future-proof hooks for social logins (Google, GitHub, Apple) through Better Auth.

---

## 2. Current State Analysis

### 2.1 What Exists Today

| File / Component | Status | Notes |
|------------------|--------|-------|
| `/signin` Route | ⚠️ Basic | Single route toggling sign-in/up via local React state. Uses default inputs. |
| `Better Auth` Server | ✅ Configured | `src/lib/auth.ts` supports `emailAndPassword` + merges local guest carts on login. |
| `Better Auth` Client | ✅ Configured | `src/lib/auth-client.ts` exports `authClient`. |
| DB Schema | ✅ Active | Includes Drizzle schemas for `user`, `session`, `account`, and `verification` tables. |
| Rate Limiting | ✅ Active | `assertAuthRateLimit` on `/api/auth/*` POST requests. |

### 2.2 Quality Gaps (Relative to Onboarding Wizard Standard)

| Gap | Severity | Reference Standard |
|-----|----------|-------------------|
| **No dedicated recovery flow** — no forgot-password or password-reset interfaces exist | 🔴 High | Core authentication requirement |
| **No email verification flow** — users can log in with unverified emails; no verification screen exists | 🔴 High | Security best practices |
| **No social OAuth options** — interface only has email/password fields with no visual placeholders or future integration hooks | 🔴 High | Premium marketplace standard |
| **Basic UI Polish** — plain layouts, no modern typography/gradients, no micro-animations, or loading/error states comparable to `WizardShell` | 🔴 High | Brand consistency |
| **No password strength verification** — users can sign up with weak passwords; no feedback/requirements displayed | 🟡 Medium | Security |
| **No show/hide password toggle** — users cannot inspect password characters before submission | 🟡 Medium | UX accessibility |
| **Partial i18n support** — key auth strings are hardcoded or miss dynamic message values | 🟡 Medium | Paraglide compilation rules |
| **Incomplete input autocomplete metadata** — standard autocomplete hints for browser managers are missing | 🟡 Medium | Forms accessibility |

---

## 3. Goals & Non-Goals

### 3.1 Goals

1. **Unified Auth Layout / UI Polish** — Implement a responsive, brand-aligned visual container (`AuthShell.tsx`) featuring smooth CSS gradients, card container styling, and subtle micro-animations for interactions.
2. **Forgot & Reset Password Flows** — Add `/forgot-password` and `/reset-password` routes with forms configured with Better Auth client API endpoints, plus database token support.
3. **Email Verification Hooks** — Implement a `/verify-email` screen showing a check-your-inbox illustration, verification instructions, and a "Resend Link" button with an active countdown timer.
4. **Enhanced Form States & Validation** — Real-time validation, a live password strength indicator (length, case complexity, digits, special characters) on signup, and a toggle to show/hide passwords.
5. **Future OAuth hooks** — Render visually styled buttons for Google, GitHub, and Apple OAuth sign-in beneath the standard email forms, disabled or hidden based on an environment config (`VITE_ENABLE_OAUTH`).
6. **Accessibility Compliance** — Keyboard-navigable form fields, correct autofill tags, ARIA attributes for validation/errors, and screen-reader announcements on state changes.
7. **Production Error & Loading States** — Elegant loading skeletons, inline spinners, dynamic error banners matching the marketplace's alert component styles.

### 3.2 Non-Goals

- **Granular RBAC profiles** — This ticket handles authentication and access verification, but does not add new roles beyond `customer`, `creator`, and `admin`.
- **Active OAuth setups on the server** — We will prepare the client UI and client function bindings, but server configuration of OAuth keys is outside this ticket's scope.
- **Passkeys/WebAuthn support** — Not required for v1.0.

---

## 4. Detailed Feature Specifications

### 4.1 Auth Shell Layout (`AuthShell.tsx`)

**File:** `src/components/auth/AuthShell.tsx` [NEW]

**Behavior:**
- Serves as the visual frame for all auth routes (`/signin`, `/forgot-password`, `/reset-password`, `/verify-email`).
- **Desktop:** Centered cards (`450px` max width) utilizing glassmorphic backdrop filters, custom shadow levels (`shadow-xl`), and rounded boundaries (`rounded-2xl`). Includes a clean header showing the Eurtisan logo and a "Back to home" link.
- **Mobile:** Stretches to fill viewport height, preserving padding (`px-4 py-8`) and displaying a simplified, responsive container.
- **Visual:** Incorporates subtle gradients (`from-accent-primary/5 via-transparent to-accent-primary/5`) to match the premium aesthetics of the onboarding wizard.

---

### 4.2 Sign In Route (`/signin`)

**File:** `src/routes/signin.tsx` [MODIFY]

**UI & Interactive Elements:**
- Form fields: Email input and Password input.
- **Autofill support:** Add `autoComplete="username email"` and `autoComplete="current-password"`.
- **Show/Hide password:** Interactive icon button inside the password container to toggle visibility.
- **Links:** "Forgot password?" link shifting to `/forgot-password`, and "Create an account" link toggling to the signup state.
- **Button:** Submitting triggers a loading state spinner. The button is disabled during submission.
- **Social OAuth section:** Placed below the primary form with a subtle divider reading "Or continue with". Includes Google, GitHub, and Apple buttons. Under current development phase, clicking shows a toast "Social login coming soon" (or redirects to Better Auth if enabled).

---

### 4.3 Sign Up State

**File:** `src/routes/signin.tsx` [MODIFY]

**UI & Interactive Elements:**
- Form fields: Name, Email, Password, and Confirm Password inputs.
- **Password Strength Indicator:**
  - Real-time visual bar below the password field displaying strength level: *Weak*, *Fair*, *Good*, *Strong*.
  - Color-coded indicator bar (red/yellow/orange/green).
  - List of criteria checklists showing which rules are met (e.g., minimum 8 characters, at least 1 number, at least 1 special char).
- **Show/Hide password:** Reusable toggle button on both password fields.
- **Autofill support:** Add `autoComplete="name"`, `autoComplete="username email"`, and `autoComplete="new-password"`.
- **Validation:**
  - Standard client validation using Zod.
  - Verification that Password and Confirm Password match.

---

### 4.4 Forgot & Reset Password Routes [NEW]

**Files:**
- `src/routes/forgot-password.tsx`
- `src/routes/reset-password.tsx`

#### 4.4.1 Forgot Password
- Form requesting the user's email address.
- Triggers Better Auth's `authClient.forgetPassword` API.
- **Success state:** Replaces the form with a success message instructing the user to check their email for a reset link. Includes a button to resend the email after a 60-second cooldown timer.

#### 4.4.2 Reset Password
- Route requires a `token` search parameter (e.g., `/reset-password?token=XYZ`).
- If token is missing, displays an error boundary screen prompting the user to request a new link.
- Form fields: New Password, Confirm New Password.
- Displays the password strength indicator.
- Triggers Better Auth's `authClient.resetPassword` API.
- **Success state:** Shows a success banner and a button redirecting the user to `/signin`.

---

### 4.5 Email Verification Route [NEW]

**File:** `src/routes/verify-email.tsx`

**UI & Behavior:**
- Shown automatically after Sign Up if email verification is enabled.
- Displays an email notification illustration with descriptive text.
- Includes a "Resend verification email" action button.
- Restricts resending via a 60-second client-side cooldown timer displaying a count down (e.g., "Resend email in 45s").
- Intercepts verification callback links sent by the server, verifies the token, and guides the user to a success screen before forwarding them to their target destination.

---

## 5. Technical & Database Architecture

### 5.1 Verification Email Dispatch Configuration

Better Auth requires a custom sender to dispatch verification and password reset emails. We will configure an email plugin/hook within the server configuration `src/lib/auth.ts`.

```typescript
// Proposed updates in src/lib/auth.ts
export const auth = betterAuth({
  // ...
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true, // Enable if required
    sendVerificationEmail: async ({ user, url }) => {
      // Dispatch email using nodemailer/SMTP integration
    },
    sendResetPassword: async ({ user, url }) => {
      // Dispatch password reset email
    }
  }
})
```

### 5.2 Server Functions & API Endpoints

We will leverage Better Auth's standard endpoint patterns:
- **Sign In:** `authClient.signIn.email({ email, password })`
- **Sign Up:** `authClient.signUp.email({ email, password, name })`
- **Forgot Password:** `authClient.forgetPassword({ email, redirectTo: "/reset-password" })`
- **Reset Password:** `authClient.resetPassword({ newPassword, token })`
- **Verify Email:** Handles token callback directly through Better Auth handlers.

---

## 6. Design & Accessibility Standards

### 6.1 Color Tokens & Theming
- Ensure support for dark and light modes using project HSL variables:
  - Text: `text-text-primary`, `text-text-secondary`
  - Input border: `border-border-default`
  - Background card: `bg-surface-default` with `shadow-xl`
  - Button states: `bg-accent-primary` (hover: `bg-accent-primary/90`)
- Use existing components from `src/components/ui/` (`Input`, `Button`, `Label`, `Card`).

### 6.2 Autocomplete Mappings
- **Sign In Form:**
  - Email: `autoComplete="username email"`
  - Password: `autoComplete="current-password"`
- **Sign Up Form:**
  - Name: `autoComplete="name"`
  - Email: `autoComplete="username email"`
  - Password: `autoComplete="new-password"`
  - Confirm Password: `autoComplete="new-password"`

### 6.3 Screen Reader & ARIA Specifications
- Input error fields must link to their text messages via `aria-describedby`.
- Error wrappers must use `role="alert"` and `aria-live="assertive"`.
- Buttons must use `aria-busy="true"` and `disabled` attributes during active submissions.
- Password show/hide button must have an explicit `aria-label` (e.g., "Show password" or "Hide password").

---

## 7. Verification Plan

### 7.1 Automated Testing

#### Unit Tests
- Add unit tests validating password strength calculation logic (`src/lib/auth-validation.test.ts`).
- Verify input Zod schema validation rules (min length, pattern matching).

#### Component Tests
- Test that form inputs display inline validation errors when submitting empty fields.
- Test that the show/hide password button toggles input visibility types (`type="password"` vs. `type="text"`).

### 7.2 Manual Verification
- Verify layouts display correctly on mobile breakpoints (375px) and desktop (1280px).
- Verify dark/light mode switches.
- Test password strength bar color-coding and checklists.
- Test tab-key navigation ordering across sign-in and sign-up fields.
