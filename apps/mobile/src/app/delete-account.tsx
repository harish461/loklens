/**
 * Delete account (api-contract §7; required by Google Play). Explains what is deleted, asks password accounts
 * for their password, and requires typing DELETE. On success the session is cleared and the router sends the
 * reader to sign-in.
 */
import Ionicons from '@expo/vector-icons/Ionicons'
import { useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Text } from '@/components/AppText'
import { Field, FormError } from '@/components/AuthForm'
import { TopBar } from '@/components/TopBar'
import { AuthError, deleteAccount } from '@/lib/auth/client'
import { useSession } from '@/lib/auth/session'
import { forgetPushToken } from '@/lib/push/notifications'
import { colors, fonts, radius, spacing, useTheme } from '@/theme'

const DELETED = [
  'Your account: name, email and sign-in details',
  'Notification settings and the registration of your devices',
  'The record of which notifications you opened',
]

export default function DeleteAccountScreen() {
  const t = useTheme()
  const { user } = useSession()
  const needsPassword = user?.provider !== 'google'
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const ready = confirm.trim() === 'DELETE' && (!needsPassword || password.length > 0)

  const submit = async () => {
    if (!ready || busy) return
    setBusy(true)
    setError('')
    try {
      await deleteAccount(needsPassword ? password : undefined)
      await forgetPushToken()
      // clearSession() inside deleteAccount makes the router show sign-in.
    } catch (err) {
      setError(err instanceof AuthError ? err.message : 'Could not delete your account. Please try again.')
      setBusy(false)
    }
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: t.bg }]} edges={['top']}>
      <TopBar title="Delete account" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={[styles.warning, { backgroundColor: t.surface }]}>
            <Ionicons name="warning-outline" size={26} color={colors.primary} />
            <Text style={[styles.warningTitle, { color: t.text }]}>This permanently deletes your account</Text>
            <Text style={[styles.text, { color: t.muted }]}>It cannot be undone. You can still read news by creating a new account later.</Text>
          </View>

          <Text style={[styles.heading, { color: t.text }]}>What will be deleted</Text>
          {DELETED.map((line) => (
            <View key={line} style={styles.bullet}>
              <Ionicons name="checkmark-circle-outline" size={18} color={t.muted} />
              <Text style={[styles.text, { color: t.text, flex: 1 }]}>{line}</Text>
            </View>
          ))}
          <Text style={[styles.text, { color: t.muted, marginTop: spacing.sm }]}>
            Bookmarks are stored only on this phone and are not affected. Notification totals shown to the newsroom keep
            their numbers but are no longer linked to you.
          </Text>

          <View style={{ marginTop: spacing.xl }}>
            {needsPassword ? (
              <Field label="Your password" value={password} onChangeText={setPassword} secureTextEntry textContentType="password" autoComplete="password" />
            ) : null}
            <Field label="Type DELETE to confirm" value={confirm} onChangeText={setConfirm} autoCapitalize="characters" placeholder="DELETE" />
            <FormError message={error} />
            <Pressable
              onPress={submit}
              disabled={!ready || busy}
              style={({ pressed }) => [styles.danger, (!ready || busy) && { opacity: 0.5 }, pressed && { opacity: 0.8 }]}
              accessibilityRole="button"
              accessibilityState={{ disabled: !ready || busy }}
            >
              {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.dangerText}>Delete my account</Text>}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl * 2 },
  warning: { alignItems: 'center', gap: spacing.sm, borderRadius: radius.lg, padding: spacing.xl },
  warningTitle: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 27, textAlign: 'center' },
  heading: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 23, marginTop: spacing.xl, marginBottom: spacing.sm },
  text: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 22 },
  bullet: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.xs },
  danger: { marginTop: spacing.sm, borderRadius: radius.pill, paddingVertical: 15, alignItems: 'center', backgroundColor: '#B42318' },
  dangerText: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 23, color: '#FFFFFF' },
})
