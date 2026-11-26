/**
 * Forgot password: sends a reset link by email. The reset itself happens on the website's reset page
 * (the link in the email), which keeps the password form out of the app.
 */
import { router } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Field, FormError, Notice, PrimaryButton, TextLink } from '@/components/AuthForm'
import { ScreenBackground } from '@/components/ScreenBackground'
import { TopBar } from '@/components/TopBar'
import { AuthError, requestPasswordReset } from '@/lib/auth/client'
import { spacing, type, useTheme } from '@/theme'

export default function ForgotScreen() {
  const t = useTheme()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!email.trim()) return setError('Please enter your email.')
    setError('')
    setBusy(true)
    try {
      await requestPasswordReset(email.trim())
      setSent(true)
    } catch (err) {
      setError(err instanceof AuthError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <ScreenBackground />
      <TopBar title="Forgot password" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[type.display, { color: t.text }]}>Reset password</Text>
        <Text style={[type.bodySmall, { color: t.muted, marginTop: spacing.xs, marginBottom: spacing.xxl }]}>
          Enter your email and we will send you a link to reset your password.
        </Text>

        {sent ? (
          <>
            <Notice message="If this email is registered with us, a reset link has been sent. Check your inbox (and spam folder)." />
            <PrimaryButton label="Back to sign in" onPress={() => router.replace('/sign-in')} />
          </>
        ) : (
          <>
            <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" textContentType="emailAddress" />
            <FormError message={error} />
            <PrimaryButton label="Send link" onPress={submit} busy={busy} />
            <TextLink label="Back to sign in" onPress={() => router.replace('/sign-in')} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl, paddingTop: spacing.lg },
})
