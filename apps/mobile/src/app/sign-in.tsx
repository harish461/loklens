/** Sign in with email and password. News stays readable without an account; this only unlocks personal features. */
import { router } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Field, FormError, PrimaryButton, TextLink } from '@/components/AuthForm'
import { ScreenBackground } from '@/components/ScreenBackground'
import { TopBar } from '@/components/TopBar'
import { AuthError, login } from '@/lib/auth/client'
import { spacing, type, useTheme } from '@/theme'

export default function SignInScreen() {
  const t = useTheme()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!email.trim() || !password) return setError('ईमेल और पासवर्ड लिखें।')
    setError('')
    setBusy(true)
    try {
      await login(email.trim(), password)
      router.replace('/(tabs)/profile')
    } catch (err) {
      setError(err instanceof AuthError ? err.message : 'कुछ गड़बड़ हो गई।')
    } finally {
      setBusy(false)
    }
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <ScreenBackground />
      <TopBar title="साइन इन" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[type.display, { color: t.text }]}>वापस स्वागत है</Text>
        <Text style={[type.bodySmall, { color: t.muted, marginTop: spacing.xs, marginBottom: spacing.xxl }]}>
          अपने खाते से साइन इन करें।
        </Text>

        <Field label="ईमेल" value={email} onChangeText={setEmail} keyboardType="email-address" textContentType="emailAddress" autoComplete="email" />
        <Field label="पासवर्ड" value={password} onChangeText={setPassword} secureTextEntry textContentType="password" autoComplete="password" />

        <FormError message={error} />
        <PrimaryButton label="साइन इन करें" onPress={submit} busy={busy} />

        <TextLink label="पासवर्ड भूल गए?" onPress={() => router.push('/forgot')} />
        <TextLink label="नया खाता बनाएं" onPress={() => router.replace('/register')} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl, paddingTop: spacing.lg, gap: 0 },
})
