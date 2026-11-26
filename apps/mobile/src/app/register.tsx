/** Create a reader account (name, email, password). */
import { router } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet } from 'react-native'
import { Text } from '@/components/AppText'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Field, FormError, GoogleButton, OrDivider, PrimaryButton, TextLink } from '@/components/AuthForm'
import { ScreenBackground } from '@/components/ScreenBackground'
import { goBack, TopBar } from '@/components/TopBar'
import { AuthError, register } from '@/lib/auth/client'
import { googleErrorMessage, googleSignInFlow } from '@/lib/auth/googleFlow'
import { spacing, type, useTheme } from '@/theme'

export default function RegisterScreen() {
  const t = useTheme()
  const [name, setName] = useState('')
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
    if (!name.trim()) return setError('Please enter your name.')
    if (!email.trim()) return setError('Please enter your email.')
    if (password.length < 8) return setError('Password must be at least 8 characters.')
    setError('')
    setBusy(true)
    try {
      await register(name.trim(), email.trim(), password)
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
      <TopBar title="Create account" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[type.display, { color: t.text }]}>Create an account</Text>
        <Text style={[type.bodySmall, { color: t.muted, marginTop: spacing.xs, marginBottom: spacing.xxl }]}>
          Keep your bookmarks and preferences safe in your account.
        </Text>

        <Field label="Name" value={name} onChangeText={setName} autoCapitalize="words" textContentType="name" />
        <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" textContentType="emailAddress" />
        <Field label="Password (at least 8 characters)" value={password} onChangeText={setPassword} secureTextEntry textContentType="newPassword" />

        <FormError message={error} />
        <PrimaryButton label="Create account" onPress={submit} busy={busy} />
        <OrDivider />
        <GoogleButton onPress={google} busy={busy} />

        <TextLink label="Already have an account? Sign in" onPress={goBack} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl, paddingTop: spacing.lg },
})
