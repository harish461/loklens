/** About us, Contact us, Privacy policy and Terms & conditions, drawn natively from src/lib/content/infoPages.ts. */
import Ionicons from '@expo/vector-icons/Ionicons'
import { useLocalSearchParams } from 'expo-router'
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Text } from '@/components/AppText'
import { SafeAreaView } from 'react-native-safe-area-context'

import { EmptyState } from '@/components/States'
import { TopBar } from '@/components/TopBar'
import { type InfoLink, type InfoPage, type InfoSection, INFO_PAGES, isInfoSlug } from '@/lib/content/infoPages'
import { colors, fonts, radius, spacing, type, useTheme } from '@/theme'

function LinkRow({ link }: { link: InfoLink }) {
  const t = useTheme()
  return (
    <Pressable
      onPress={() => void Linking.openURL(link.href)}
      style={({ pressed }) => [styles.link, { backgroundColor: t.surface }, pressed && { opacity: 0.7 }]}
      accessibilityRole="link"
      accessibilityLabel={link.label ? `${link.label}: ${link.value}` : link.value}
    >
      <View style={[styles.linkIcon, { backgroundColor: t.bg }]}>
        <Ionicons name={link.icon} size={18} color={t.text} />
      </View>
      <View style={{ flex: 1 }}>
        {link.label ? <Text style={[type.meta, { color: t.muted }]}>{link.label}</Text> : null}
        <Text style={[styles.linkValue, { color: colors.primary }]}>{link.value}</Text>
      </View>
      <Ionicons name="open-outline" size={16} color={t.muted} />
    </Pressable>
  )
}

function Section({ section }: { section: InfoSection }) {
  const t = useTheme()
  return (
    <View style={styles.section}>
      {section.title ? (
        <Text style={[type.headline, { color: t.text }]}>
          {section.number ? `${section.number} ` : ''}
          {section.title}
        </Text>
      ) : null}
      {section.subtitle ? <Text style={[styles.subtitle, { color: colors.primary }]}>{section.subtitle}</Text> : null}
      {section.paragraphs?.map((p, i) => (
        <Text key={i} style={[type.body, styles.paragraph, { color: t.text }]}>
          {p}
        </Text>
      ))}
      {section.links?.length ? (
        <View style={styles.links}>
          {section.links.map((l, i) => (
            <LinkRow key={`${l.href}-${i}`} link={l} />
          ))}
        </View>
      ) : null}
    </View>
  )
}

function PageBody({ page }: { page: InfoPage }) {
  const t = useTheme()
  return (
    <ScrollView contentContainerStyle={styles.content}>
      {page.title ? <Text style={[type.display, { color: t.text }]}>{page.title}</Text> : null}
      {page.meta ? <Text style={[type.meta, styles.meta, { color: t.muted }]}>{page.meta}</Text> : null}
      {page.intro?.map((p, i) => (
        <Text key={i} style={[type.body, styles.paragraph, { color: t.text }]}>
          {p}
        </Text>
      ))}
      {page.sections.map((s, i) => (
        <Section key={i} section={s} />
      ))}
    </ScrollView>
  )
}

export default function InfoScreen() {
  const t = useTheme()
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const page: InfoPage | null = isInfoSlug(slug) ? INFO_PAGES[slug] : null
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: t.bg }]} edges={['top']}>
      <TopBar title={page?.screenTitle} />
      {page ? <PageBody page={page} /> : <EmptyState icon="document-text-outline" title="Page not found" />}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl * 2 },
  meta: { marginTop: spacing.xs, marginBottom: spacing.md },
  section: { marginTop: spacing.xl },
  subtitle: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 24, marginTop: spacing.xs },
  paragraph: { marginTop: spacing.md },
  links: { gap: spacing.sm, marginTop: spacing.md },
  link: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  linkIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  linkValue: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 23 },
})
