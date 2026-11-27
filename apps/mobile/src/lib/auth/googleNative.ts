/**
 * Native Google sign-in (Android). Returns a Google ID token for the backend to verify; no client secret is used
 * in the app. The library is loaded only when the button is pressed, so the web preview and Expo Go do not
 * crash on import (the native module is missing there and sign-in reports it cleanly).
 */
import Constants from 'expo-constants'
import { TurboModuleRegistry } from 'react-native'

const extra = (Constants.expoConfig?.extra ?? {}) as { googleWebClientId?: string }

export class GoogleSignInUnavailable extends Error {
  constructor() {
    super('Google sign-in is not available in this build.')
    this.name = 'GoogleSignInUnavailable'
  }
}

let configured = false

/**
 * Returns the Google ID token, or null if the user cancelled. Throws GoogleSignInUnavailable when the native
 * module is not in this build, and a plain Error for other failures.
 */
export async function signInWithGoogleNative(): Promise<string | null> {
  const webClientId = extra.googleWebClientId
  if (!webClientId) throw new Error('Google sign-in is not configured in this app.')

  // Check for the native module first: in Expo Go it is missing, and requiring the library there raises a
  // fatal red-box error before any try/catch around require() can handle it.
  if (!TurboModuleRegistry.get('RNGoogleSignin')) throw new GoogleSignInUnavailable()

  let lib: typeof import('@react-native-google-signin/google-signin')
  try {
    lib = require('@react-native-google-signin/google-signin')
  } catch {
    throw new GoogleSignInUnavailable()
  }

  if (!configured) {
    // The Web client ID is what the server verifies (as the token audience). It is public, not a secret.
    lib.GoogleSignin.configure({ webClientId, offlineAccess: false })
    configured = true
  }

  await lib.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })
  const response = await lib.GoogleSignin.signIn()
  if (lib.isCancelledResponse(response)) return null
  if (!lib.isSuccessResponse(response) || !response.data.idToken) {
    throw new Error('Google did not return a sign-in token. Please try again.')
  }
  return response.data.idToken
}
