## Overview
Add a complete password-reset flow using Supabase's built-in magic-link recovery. A "Forgot Password?" link on the login screen sends a recovery email; a dedicated `/reset-password` page lets the user set a new password after clicking the email link.

## What will be built

### 1. Forgot-password trigger on LoginPage
- Add a **"Forgot Password?"** link below the password field on the Email tab of `LoginPage.tsx`.
- Clicking it opens a small inline form (or dialog) that asks for the user's email.
- On submit, call:
  ```ts
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`
  });
  ```
- Show a toast: *"Check your email for a password reset link."*

### 2. Reset Password page (`src/pages/ResetPasswordPage.tsx`)
- **Public route** — no auth required.
- On mount, parse the URL hash for `type=recovery` and extract the `access_token`.
- Call `supabase.auth.getSessionFromUrl({ storeSession: true })` (or equivalent hash parsing) to establish the temporary recovery session.
- Show a form with:
  - New Password input (with show/hide toggle, minLength 6)
  - Confirm Password input
- On submit, if passwords match:
  ```ts
  await supabase.auth.updateUser({ password: newPassword });
  ```
  Then show success toast and redirect to `/login`.
- If the hash is missing/invalid, show an error state: *"Invalid or expired reset link."* with a button to go back to login.

### 3. Route wiring in App.tsx
- Add `<Route path="/reset-password" element={<ResetPasswordPage />} />` in the **Public routes** section (above the protected routes).
- Ensure it is NOT wrapped in `<ProtectedRoute>`.

## Files to modify / create
| File | Action |
|------|--------|
| `src/pages/LoginPage.tsx` | Add "Forgot Password?" link + email input handler |
| `src/pages/ResetPasswordPage.tsx` | **Create** — recovery hash parser + new-password form |
| `src/App.tsx` | Add `/reset-password` public route |

## No backend changes needed
Supabase Auth handles the email delivery and token validation automatically.