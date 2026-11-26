/**
 * Device registration and preferences for /api/v1/push/* (api-contract §8). Every function takes the user ID
 * from the verified session (currentAppUser), never from the request body.
 */
import type { Payload } from 'payload'

import { AuthApiError } from '@/lib/auth/appUsers'

import { normalizeStoredPreferences, type Platform, type PushPreferences } from './rules'

export interface DeviceView {
  id: number
  platform: Platform
  active: boolean
  preferences: PushPreferences
}

type DeviceDoc = {
  id: number
  platform: Platform
  active?: boolean | null
  appUser?: number | { id: number } | null
  preferences?: unknown
}

const ownerId = (d: DeviceDoc): number | null => (typeof d.appUser === 'object' && d.appUser ? d.appUser.id : (d.appUser ?? null))

export const toDeviceView = (d: DeviceDoc): DeviceView => ({
  id: d.id,
  platform: d.platform,
  active: d.active !== false,
  preferences: normalizeStoredPreferences(d.preferences),
})

async function findByToken(payload: Payload, token: string): Promise<DeviceDoc | null> {
  const res = await payload.find({
    collection: 'push-devices',
    where: { token: { equals: token } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return (res.docs[0] as DeviceDoc | undefined) ?? null
}

/** The device for this token, only if it belongs to the signed-in user (404 otherwise). */
export async function ownDevice(payload: Payload, userId: number, token: string): Promise<DeviceDoc> {
  const device = await findByToken(payload, token)
  if (!device || ownerId(device) !== userId) throw new AuthApiError(404, 'NOT_FOUND', 'Device not registered.')
  return device
}

export interface RegisterInput {
  token: string
  platform: Platform
  deviceId?: string
  appVersion?: string
}

/**
 * One record per token: registering again refreshes it (and moves it to the current account if another
 * account had it, e.g. after signing in with a different account on the same phone). Preferences are kept.
 */
export async function registerDevice(payload: Payload, userId: number, input: RegisterInput): Promise<DeviceView> {
  const data = {
    appUser: userId,
    platform: input.platform,
    deviceId: input.deviceId ?? null,
    appVersion: input.appVersion ?? null,
    active: true,
    deactivatedReason: null,
    lastSeenAt: new Date().toISOString(),
  }
  const existing = await findByToken(payload, input.token)
  if (existing) {
    const updated = await payload.update({ collection: 'push-devices', id: existing.id, data, depth: 0, overrideAccess: true })
    return toDeviceView(updated as DeviceDoc)
  }
  try {
    const created = await payload.create({ collection: 'push-devices', data: { token: input.token, ...data }, depth: 0, overrideAccess: true })
    return toDeviceView(created as DeviceDoc)
  } catch (err) {
    // Two registrations raced and the unique token index stopped the second: update the winner instead.
    const winner = await findByToken(payload, input.token)
    if (!winner) throw err
    const updated = await payload.update({ collection: 'push-devices', id: winner.id, data, depth: 0, overrideAccess: true })
    return toDeviceView(updated as DeviceDoc)
  }
}

/** Sign-out: stop sending to this device. The row is kept (inactive) so history stays intact. */
export async function unregisterDevice(payload: Payload, userId: number, token: string): Promise<void> {
  const device = await ownDevice(payload, userId, token)
  await payload.update({
    collection: 'push-devices',
    id: device.id,
    data: { active: false, deactivatedReason: 'SignedOut' },
    overrideAccess: true,
  })
}

export async function savePreferences(payload: Payload, userId: number, token: string, preferences: PushPreferences): Promise<PushPreferences> {
  const device = await ownDevice(payload, userId, token)
  const updated = await payload.update({
    collection: 'push-devices',
    id: device.id,
    data: { preferences, lastSeenAt: new Date().toISOString() },
    depth: 0,
    overrideAccess: true,
  })
  return toDeviceView(updated as DeviceDoc).preferences
}
