/** One Google sign-in flow for every screen: get the ID token, send it to the server, store the session. */
import { AuthError, googleLogin } from './client'
import { GoogleSignInUnavailable, signInWithGoogleNative } from './googleNative'

/** Resolves 'ok' when signed in, 'cancelled' when the user backed out. Throws with a Hindi message on failure. */
export async function googleSignInFlow(): Promise<'ok' | 'cancelled'> {
  try {
    const idToken = await signInWithGoogleNative()
    if (!idToken) return 'cancelled'
    await googleLogin(idToken)
    return 'ok'
  } catch (err) {
    throw new Error(googleErrorMessage(err))
  }
}

export function googleErrorMessage(err: unknown): string {
  if (err instanceof GoogleSignInUnavailable) return 'Google से साइन इन इस ऐप वर्ज़न में उपलब्ध नहीं है। कृपया ईमेल से साइन इन करें।'
  if (err instanceof AuthError) return err.message
  if (err instanceof Error && err.message) return err.message
  return 'Google से साइन इन नहीं हो सका। कृपया फिर कोशिश करें।'
}
