# Google OAuth setup

Rhythians uses Google OAuth directly with the existing Rhythians session system.

## Google Cloud Console

1. Open Google Cloud Console and select or create the project you want to use for Rhythians.
2. Open Google Auth Platform and configure the OAuth consent screen.
3. Set the app name to `Rhythians` and add your support/developer contact email.
4. Add `rhythians.vercel.app` as an authorized domain if Google asks for one.
5. Create an OAuth client ID with application type `Web application`.
6. Add this Authorized JavaScript origin:
   - `https://rhythians.vercel.app`
7. Add this Authorized redirect URI exactly:
   - `https://rhythians.vercel.app/api/auth/google/callback`
8. Copy the generated Client ID and Client Secret.

## Vercel environment variables

Add these variables to the `rhythians` Vercel project for Production. Add them to Preview too if you want Google sign-in available on preview deployments.

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://rhythians.vercel.app/api/auth/google/callback
```

After changing Vercel environment variables, redeploy the latest `main` deployment so the new values are available to the application.

## Behavior

- Existing Rhythians accounts are matched using the verified email returned by Google.
- If the verified email does not already exist, Rhythians automatically creates a new account.
- Google-created accounts do not require a password.
- Users can still use Discord and username/password authentication independently.
- Suspended Rhythians accounts cannot bypass suspension by signing in with Google.
