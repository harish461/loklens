/** Create a reader account (name, email, password). */
import { router } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Field, FormError, PrimaryButton, TextLink } from '@/components/AuthForm'
import { ScreenBackground } from '@/components/ScreenBackground'
import { TopBar } from '@/components/TopBar'
import { AuthError, register } from '@/lib/auth/client'
import { spacing, type, useTheme } from '@/theme'

export default function RegisterScreen() {
  const t = useTheme()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!name.trim()) return setError('कृपया अपना नाम लिखें।')
    if (!email.trim()) return setError('कृपया ईमेल लिखें।')
    if (password.length < 8) return setError('पासवर्ड कम से कम 8 अक्षर का होना चाहिए।')
    setError('')
    setBusy(true)
    try {
      await register(name.trim(), email.trim(), password)
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
      <TopBar title="नया खाता" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[type.display, { color: t.text }]}>खाता बनाएं</Text>
        <Text style={[type.bodySmall, { color: t.muted, marginTop: spacing.xs, marginBottom: spacing.xxl }]}>
          बुकमार्क और पसंद अपने खाते में सुरक्षित रखें।
        </Text>

        <Field label="नाम" value={name} onChangeText={setName} autoCapitalize="words" textContentType="name" />
        <Field label="ईमेल" value={email} onChangeText={setEmail} keyboardType="email-address" textContentType="emailAddress" />
        <Field label="पासवर्ड (कम से कम 8 अक्षर)" value={password} onChangeText={setPassword} secureTextEntry textContentType="newPassword" />

        <FormError message={error} />
        <PrimaryButton label="खाता बनाएं" onPress={submit} busy={busy} />

        <TextLink label="पहले से खाता है? साइन इन करें" onPress={() => router.replace('/sign-in')} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl, paddingTop: spacing.lg },
})
