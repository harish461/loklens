/**
 * Profile (no login yet): app identity from /settings, social links, contact, policy pages (rendered
 * in-app from /pages), offline-cache control and app version.
 */
import Ionicons from '@expo/vector-icons/Ionicons'
import Constants from 'expo-constants'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { useState } from 'react'
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { TAB_BAR_SPACE } from '@/components/FloatingTabBar'
import { SITE_URL } from '@/lib/api/client'
import { useSettings } from '@/lib/api/queries'
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

const POLICY_LABELS: { key: 'about' | 'contact' | 'privacy' | 'terms' | 'editorial' | 'corrections' | 'disclaimer'; label: string; icon: IconName }[] = [
  { key: 'about', label: 'हमारे बारे में', icon: 'information-circle-outline' },
  { key: 'contact', label: 'संपर्क करें', icon: 'call-outline' },
  { key: 'editorial', label: 'संपादकीय नीति', icon: 'newspaper-outline' },
  { key: 'corrections', label: 'सुधार नीति', icon: 'create-outline' },
  { key: 'privacy', label: 'गोपनीयता नीति', icon: 'lock-closed-outline' },
  { key: 'terms', label: 'नियम व शर्तें', icon: 'document-text-outline' },
  { key: 'disclaimer', label: 'अस्वीकरण', icon: 'alert-circle-outline' },
]

const DEFAULT_POLICIES = {
  about: '/about',
  contact: '/contact',
  privacy: '/privacy-policy',
  terms: '/terms',
  editorial: '/editorial-policy',
  corrections: '/corrections-policy',
  disclaimer: '/disclaimer',
}

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

export default function ProfileScreen() {
  const t = useTheme()
  const { data: settings } = useSettings()
  const [cleared, setCleared] = useState(false)
  const policies = settings?.policies ?? DEFAULT_POLICIES

  const openPolicy = (path: string) => {
    const slug = path.replace(/^\/+|\/+$/g, '')
    if (/^[a-z0-9-]+$/.test(slug)) router.push({ pathname: '/page/[slug]', params: { slug } })
    else void Linking.openURL(path.startsWith('http') ? path : `${SITE_URL}${path}`)
  }

  const clearCache = async () => {
    queryClient.clear()
    await persister.removeClient()
    setCleared(true)
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: t.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: TAB_BAR_SPACE }}>
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

        <Group title="संपर्क">
          {settings?.contact?.email ? <Row icon="mail-outline" label={settings.contact.email} onPress={() => void Linking.openURL(`mailto:${settings.contact.email}`)} /> : null}
          {settings?.contact?.whatsapp ? (
            <Row icon="logo-whatsapp" label={settings.contact.whatsapp} onPress={() => void Linking.openURL(`https://wa.me/${settings.contact.whatsapp?.replace(/\D/g, '')}`)} />
          ) : null}
          <Row icon="globe-outline" label="वेबसाइट देखें" value="loklensnews.com" onPress={() => void Linking.openURL(SITE_URL)} />
        </Group>

        <Group title="जानकारी">
          {POLICY_LABELS.map((p) => (
            <Row key={p.key} icon={p.icon} label={p.label} onPress={() => openPolicy(policies[p.key])} />
          ))}
        </Group>

        <Group title="ऐप">
          <Row icon="trash-outline" label={cleared ? 'सहेजी गई खबरें साफ़ हो गईं' : 'ऑफ़लाइन कैश साफ़ करें'} onPress={cleared ? undefined : clearCache} />
          <Row icon="phone-portrait-outline" label="संस्करण" value={Constants.expoConfig?.version ?? ''} />
        </Group>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
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
