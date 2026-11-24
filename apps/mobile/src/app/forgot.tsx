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
    if (!email.trim()) return setError('कृपया ईमेल लिखें।')
    setError('')
    setBusy(true)
    try {
      await requestPasswordReset(email.trim())
      setSent(true)
    } catch (err) {
      setError(err instanceof AuthError ? err.message : 'कुछ गड़बड़ हो गई।')
    } finally {
      setBusy(false)
    }
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <ScreenBackground />
      <TopBar title="पासवर्ड भूल गए" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[type.display, { color: t.text }]}>पासवर्ड रीसेट</Text>
        <Text style={[type.bodySmall, { color: t.muted, marginTop: spacing.xs, marginBottom: spacing.xxl }]}>
          अपना ईमेल लिखें। हम आपको पासवर्ड बदलने का लिंक भेजेंगे।
        </Text>

        {sent ? (
          <>
            <Notice message="अगर यह ईमेल हमारे पास है, तो रीसेट लिंक भेज दिया गया है। अपना ईमेल (और स्पैम फ़ोल्डर) देखें।" />
            <PrimaryButton label="साइन इन पर वापस जाएं" onPress={() => router.replace('/sign-in')} />
          </>
        ) : (
          <>
            <Field label="ईमेल" value={email} onChangeText={setEmail} keyboardType="email-address" textContentType="emailAddress" />
            <FormError message={error} />
            <PrimaryButton label="लिंक भेजें" onPress={submit} busy={busy} />
            <TextLink label="साइन इन पर वापस जाएं" onPress={() => router.replace('/sign-in')} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl, paddingTop: spacing.lg },
})
