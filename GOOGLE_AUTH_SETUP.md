# Google OAuth setup

Rhythians uses Google OAuth directly with the existing Rhythians session system.

## Google Cloud Console

1. Open Google Cloud Console and select or create the project you want to use for Rhythians.
2. Open Google Auth Platform and configure the OAuth consent screen.
3. Set the app name to `Rhythians` and add your support/developer contact email.
4. Create an OAuth client ID with application type `Web application`.
5. Add this Authorized JavaScript origin:
   - `https://rhythians.vercel.app`
6. Add this Authorized redirect URI exactly:
   - `https://rhythians.vercel.app/api/auth/google/callback`
7. Copy the generated Client ID and Client Secret.

If Google requires an Authorized Domain that you must verify ownership of for branding or production verification, use a custom domain that you own and connect it to Rhythians. Do not attempt to verify ownership of `vercel.app`. After moving authentication to a custom domain, update the OAuth origin, redirect URI, and `GOOGLE_REDIRECT_URI` to use that domain.

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
