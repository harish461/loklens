/**
 * Profile: account card, app identity from /settings, social links, contact, policy pages (rendered
 * in-app from /pages), offline-cache control and app version.
 */
import Ionicons from '@expo/vector-icons/Ionicons'
import Constants from 'expo-constants'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { useState } from 'react'
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Text } from '@/components/AppText'
import { SafeAreaView } from 'react-native-safe-area-context'

import { TAB_BAR_SPACE } from '@/components/FloatingTabBar'
import { ScreenBackground } from '@/components/ScreenBackground'
import { SITE_URL } from '@/lib/api/client'
import { useSettings } from '@/lib/api/queries'
import { logout } from '@/lib/auth/client'
import { unregisterThisDevice } from '@/lib/push/notifications'
import type { InfoSlug } from '@/lib/content/infoPages'
import { useSession } from '@/lib/auth/session'
import { persister, queryClient } from '@/lib/queryClient'
import { colors, fonts, radius, spacing, type, useTheme } from '@/theme'

const LOGO = require('../../../assets/brand/logo-144.webp')

type IconName = keyof typeof Ionicons.glyphMap
const SOCIAL_ICONS: Record<string, IconName> = {
  facebook: 'logo-facebook',
  x: 'logo-twitter',
  instagram: 'logo-instagram',
  youtube: 'logo-youtube',
  linkedin: 'logo-linkedin',
  whatsapp: 'logo-whatsapp',
  website: 'globe-outline',
}

// Text lives in the app (src/lib/content/infoPages.ts). Editorial, corrections and disclaimer are left out for now.
const INFO_ROWS: { slug: InfoSlug; label: string; icon: IconName }[] = [
  { slug: 'about', label: 'About us', icon: 'information-circle-outline' },
  { slug: 'contact', label: 'Contact us', icon: 'call-outline' },
  { slug: 'privacy', label: 'Privacy policy', icon: 'lock-closed-outline' },
  { slug: 'terms', label: 'Terms & conditions', icon: 'document-text-outline' },
]

function Row({ icon, label, onPress, value }: { icon: IconName; label: string; onPress?: () => void; value?: string }) {
  const t = useTheme()
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.row, pressed && { backgroundColor: t.raised }]} accessibilityRole={onPress ? 'button' : undefined}>
      <View style={[styles.rowIcon, { backgroundColor: t.bg }]}>
        <Ionicons name={icon} size={18} color={t.text} />
      </View>
      <Text style={[styles.rowLabel, { color: t.text }]}>{label}</Text>
      {value ? <Text style={[type.meta, { color: t.muted }]}>{value}</Text> : null}
      {onPress ? <Ionicons name="chevron-forward" size={16} color={t.muted} /> : null}
    </Pressable>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  const t = useTheme()
  return (
    <View style={{ marginTop: spacing.xl }}>
      <Text style={[type.label, { color: t.muted, marginBottom: spacing.sm, paddingHorizontal: spacing.xs }]}>{title}</Text>
      <View style={[styles.group, { backgroundColor: t.surface }]}>{children}</View>
    </View>
  )
}

/** Sign-out: stop push to this device first (needs the session), then end the session. */
async function signOut(): Promise<void> {
  await unregisterThisDevice()
  await logout()
}

/** Account block: sign in / register when signed out; name, email and sign-out when signed in. */
function AccountCard() {
  const t = useTheme()
  const { user, token } = useSession()
  if (!token || !user) {
    return (
      <View style={[styles.group, { backgroundColor: t.surface, padding: spacing.lg, marginBottom: spacing.lg }]}>
        <Text style={[type.title, { color: t.text }]}>Your account</Text>
        <Text style={[type.meta, { color: t.muted, marginTop: spacing.xs, marginBottom: spacing.lg }]}>Keep your bookmarks and preferences in your account.</Text>
        <Pressable onPress={() => router.push('/sign-in')} style={[styles.accountBtn, { backgroundColor: t.pill }]} accessibilityRole="button">
          <Text style={[styles.accountBtnText, { color: t.pillText }]}>Sign in</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/register')} style={styles.accountLink} accessibilityRole="link">
          <Text style={styles.accountLinkText}>Create an account</Text>
        </Pressable>
      </View>
    )
  }
  return (
    <View style={[styles.group, { backgroundColor: t.surface, padding: spacing.lg, marginBottom: spacing.lg }]}>
      <Text style={[type.title, { color: t.text }]}>{user.name}</Text>
      <Text style={[type.meta, { color: t.muted, marginTop: spacing.xs, marginBottom: spacing.lg }]}>{user.email}</Text>
      <Pressable onPress={() => void signOut()} style={[styles.accountBtn, { backgroundColor: t.raised }]} accessibilityRole="button">
        <Text style={[styles.accountBtnText, { color: t.text }]}>Log out</Text>
      </Pressable>
      <Pressable onPress={() => router.push('/delete-account')} style={styles.accountLink} accessibilityRole="link">
        <Text style={[styles.accountLinkText, { color: t.muted }]}>Delete account</Text>
      </Pressable>
    </View>
  )
}

export default function ProfileScreen() {
  const t = useTheme()
  const { data: settings } = useSettings()
  const [cleared, setCleared] = useState(false)

  const clearCache = async () => {
    queryClient.clear()
    await persister.removeClient()
    setCleared(true)
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScreenBackground />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: TAB_BAR_SPACE }}>
        <AccountCard />
        <View style={styles.card}>
          <Image source={LOGO} style={styles.logo} contentFit="cover" />
          <Text style={[type.display, { textAlign: 'center' }]}>{settings?.name ?? 'लोक Lens न्यूज़'}</Text>
          <Text style={[type.bodySmall, { textAlign: 'center', color: colors.muted }]}>{settings?.tagline ?? 'आपकी आवाज़, आपकी खबर'}</Text>
          {settings?.social?.length ? (
            <View style={styles.social}>
              {settings.social.map((s) => (
                <Pressable key={s.platform + s.url} onPress={() => void Linking.openURL(s.url)} style={styles.socialButton} accessibilityRole="link" accessibilityLabel={s.platform}>
                  <Ionicons name={SOCIAL_ICONS[s.platform] ?? 'link-outline'} size={18} color={colors.white} />
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        <Group title="Contact">
          {settings?.contact?.email ? <Row icon="mail-outline" label={settings.contact.email} onPress={() => void Linking.openURL(`mailto:${settings.contact.email}`)} /> : null}
          {settings?.contact?.whatsapp ? (
            <Row icon="logo-whatsapp" label={settings.contact.whatsapp} onPress={() => void Linking.openURL(`https://wa.me/${settings.contact.whatsapp?.replace(/\D/g, '')}`)} />
          ) : null}
          <Row icon="globe-outline" label="Visit website" value="loklensnews.com" onPress={() => void Linking.openURL(SITE_URL)} />
        </Group>

        <Group title="Information">
          {INFO_ROWS.map((p) => (
            <Row key={p.slug} icon={p.icon} label={p.label} onPress={() => router.push({ pathname: '/info/[slug]', params: { slug: p.slug } })} />
          ))}
        </Group>

        <Group title="App">
          <Row icon="notifications-outline" label="Notifications" onPress={() => router.push('/notification-settings')} />
          <Row icon="trash-outline" label={cleared ? 'Saved news cleared' : 'Clear offline cache'} onPress={cleared ? undefined : clearCache} />
          <Row icon="phone-portrait-outline" label="Version" value={Constants.expoConfig?.version ?? ''} />
        </Group>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  accountBtn: { borderRadius: radius.pill, paddingVertical: 12, alignItems: 'center' },
  accountBtnText: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 23 },
  accountLink: { alignItems: 'center', paddingVertical: spacing.md },
  accountLinkText: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 22, color: colors.primary },
  screen: { flex: 1 },
  card: { alignItems: 'center', gap: spacing.xs, backgroundColor: '#FFF1C1', borderRadius: radius.xl, padding: spacing.xl },
  logo: { width: 72, height: 72, borderRadius: 36, marginBottom: spacing.sm },
  social: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.md },
  socialButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.pill, alignItems: 'center', justifyContent: 'center' },
  group: { borderRadius: radius.lg, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  rowIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, fontFamily: fonts.medium, fontSize: 15, lineHeight: 23 },
})
