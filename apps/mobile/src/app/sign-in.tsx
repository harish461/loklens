/** Sign in with email and password. News stays readable without an account; this only unlocks personal features. */
import { router } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Field, FormError, GoogleButton, OrDivider, PrimaryButton, TextLink } from '@/components/AuthForm'
import { ScreenBackground } from '@/components/ScreenBackground'
import { TopBar } from '@/components/TopBar'
import { AuthError, login } from '@/lib/auth/client'
import { googleErrorMessage, googleSignInFlow } from '@/lib/auth/googleFlow'
import { spacing, type, useTheme } from '@/theme'

export default function SignInScreen() {
  const t = useTheme()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const google = async () => {
    setError('')
    setBusy(true)
    try {
      const result = await googleSignInFlow()
      if (result === 'ok') router.replace('/')
    } catch (err) {
      setError(googleErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const submit = async () => {
    if (!email.trim() || !password) return setError('Enter your email and password.')
    setError('')
    setBusy(true)
    try {
      await login(email.trim(), password)
      router.replace('/')
    } catch (err) {
      setError(err instanceof AuthError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <ScreenBackground />
      <TopBar title="Sign in" back={false} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[type.display, { color: t.text }]}>Welcome back</Text>
        <Text style={[type.bodySmall, { color: t.muted, marginTop: spacing.xs, marginBottom: spacing.xxl }]}>
          Sign in to your account.
        </Text>

        <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" textContentType="emailAddress" autoComplete="email" />
        <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry textContentType="password" autoComplete="password" />

        <FormError message={error} />
        <PrimaryButton label="Sign in" onPress={submit} busy={busy} />
        <OrDivider />
        <GoogleButton onPress={google} busy={busy} />

        <TextLink label="Forgot password?" onPress={() => router.push('/forgot')} />
        <TextLink label="Create an account" onPress={() => router.push('/register')} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl, paddingTop: spacing.lg, gap: 0 },
})
