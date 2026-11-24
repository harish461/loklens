/**
 * Google ID token verification (lib/auth/google.ts). Uses locally generated keys in place of Google's, so the
 * signature, issuer, audience, expiry and email checks run for real without network access.
 */
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWK, type KeyLike } from 'jose'
import { beforeAll, describe, expect, it } from 'vitest'

import { GoogleTokenError, verifyGoogleIdentityToken } from '../../src/lib/auth/google'

const WEB_CLIENT = '484114320365-2f3aqeqa2shf5c36jnk6cvltv2ev5vh3.apps.googleusercontent.com'
const ANDROID_CLIENT = '484114320365-k5tt09am9so8mldercr650upth27656p.apps.googleusercontent.com'

let privateKey: KeyLike
let otherKey: KeyLike
let keys: ReturnType<typeof createLocalJWKSet>

async function sign(claims: Record<string, unknown>, opts: { key?: KeyLike; iss?: string; aud?: string; exp?: number } = {}) {
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setIssuer(opts.iss ?? 'https://accounts.google.com')
    .setAudience(opts.aud ?? WEB_CLIENT)
    .setIssuedAt(now)
    .setExpirationTime(opts.exp ?? now + 3600)
    .setSubject(typeof claims.sub === 'string' ? claims.sub : '')
    .sign(opts.key ?? privateKey)
}

const good = { sub: '10987654321', email: 'Reader@Example.com', email_verified: true, name: 'Asha Verma' }

beforeAll(async () => {
  const pair = await generateKeyPair('RS256', { extractable: true })
  privateKey = pair.privateKey
  otherKey = (await generateKeyPair('RS256')).privateKey
  const publicJwk: JWK = { ...(await exportJWK(pair.publicKey)), kid: 'test-key', alg: 'RS256', use: 'sig' }
  keys = createLocalJWKSet({ keys: [publicJwk] })
})

const verify = (token: string) => verifyGoogleIdentityToken(token, { audiences: [WEB_CLIENT], keys })

describe('verifyGoogleIdentityToken', () => {
  it('accepts a valid token and returns a normalised identity', async () => {
    const identity = await verify(await sign(good))
    expect(identity).toEqual({ sub: '10987654321', email: 'reader@example.com', name: 'Asha Verma' })
  })

  it('accepts the bare Google issuer as well', async () => {
    await expect(verify(await sign(good, { iss: 'accounts.google.com' }))).resolves.toMatchObject({ sub: good.sub })
  })

  it('rejects a token issued for another client (audience check)', async () => {
    await expect(verify(await sign(good, { aud: ANDROID_CLIENT }))).rejects.toBeInstanceOf(GoogleTokenError)
  })

  it('rejects a token from another issuer', async () => {
    await expect(verify(await sign(good, { iss: 'https://evil.example.com' }))).rejects.toBeInstanceOf(GoogleTokenError)
  })

  it('rejects an expired token', async () => {
    const past = Math.floor(Date.now() / 1000) - 3600
    await expect(verify(await sign(good, { exp: past }))).rejects.toBeInstanceOf(GoogleTokenError)
  })

  it('rejects a forged signature (signed with a different key)', async () => {
    await expect(verify(await sign(good, { key: otherKey }))).rejects.toBeInstanceOf(GoogleTokenError)
  })

  it('rejects an unverified Google email', async () => {
    await expect(verify(await sign({ ...good, email_verified: false }))).rejects.toThrow(/not verified/)
  })

  it('accepts email_verified sent as the string "true"', async () => {
    await expect(verify(await sign({ ...good, email_verified: 'true' }))).resolves.toMatchObject({ sub: good.sub })
  })

  it('rejects a token without a subject', async () => {
    await expect(verify(await sign({ ...good, sub: '' }))).rejects.toBeInstanceOf(GoogleTokenError)
  })

  it('rejects garbage input', async () => {
    await expect(verify('not-a-jwt')).rejects.toBeInstanceOf(GoogleTokenError)
  })

  it('refuses to run without any configured audience', async () => {
    await expect(verifyGoogleIdentityToken(await sign(good), { audiences: [], keys })).rejects.toThrow(/not configured/)
  })
})
