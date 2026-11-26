/** Shared pieces for the sign-in, register and reset screens. */
import Ionicons from '@expo/vector-icons/Ionicons'
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native'

import { colors, fonts, radius, spacing, useTheme } from '@/theme'

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const t = useTheme()
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: t.text }]}>{label}</Text>
      <TextInput
        placeholderTextColor={t.subtle}
        autoCapitalize="none"
        autoCorrect={false}
        style={[styles.input, { backgroundColor: t.surface, color: t.text, borderColor: t.border }]}
        {...props}
      />
    </View>
  )
}

export function PrimaryButton({ label, onPress, busy = false, disabled = false }: { label: string; onPress: () => void; busy?: boolean; disabled?: boolean }) {
  const t = useTheme()
  return (
    <Pressable
      onPress={onPress}
      disabled={busy || disabled}
      style={({ pressed }) => [styles.button, { backgroundColor: t.pill }, (pressed || busy || disabled) && { opacity: 0.7 }]}
      accessibilityRole="button"
    >
      {busy ? <ActivityIndicator color={t.pillText} /> : <Text style={[styles.buttonText, { color: t.pillText }]}>{label}</Text>}
    </Pressable>
  )
}

/** Divider with the word "or" between the password form and the Google button. */
export function OrDivider() {
  const t = useTheme()
  return (
    <View style={styles.or}>
      <View style={[styles.orLine, { backgroundColor: t.border }]} />
      <Text style={[styles.orText, { color: t.muted }]}>or</Text>
      <View style={[styles.orLine, { backgroundColor: t.border }]} />
    </View>
  )
}

/** Google sign-in button (white, Google icon). The server verifies the ID token; no secret is in the app. */
export function GoogleButton({ onPress, busy = false }: { onPress: () => void; busy?: boolean }) {
  const t = useTheme()
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => [styles.google, { backgroundColor: t.surface, borderColor: t.border }, (pressed || busy) && { opacity: 0.7 }]}
      accessibilityRole="button"
      accessibilityLabel="Continue with Google"
    >
      {busy ? <ActivityIndicator color={t.text} /> : <Ionicons name="logo-google" size={18} color={t.text} />}
      <Text style={[styles.googleText, { color: t.text }]}>Continue with Google</Text>
    </Pressable>
  )
}

export function FormError({ message }: { message: string }) {
  if (!message) return null
  return (
    <Text accessibilityRole="alert" style={styles.error}>
      {message}
    </Text>
  )
}

export function TextLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="link" style={styles.link}>
      <Text style={styles.linkText}>{label}</Text>
    </Pressable>
  )
}

export function Notice({ message }: { message: string }) {
  const t = useTheme()
  return (
    <View style={[styles.notice, { backgroundColor: t.surface }]}>
      <Text style={[styles.noticeText, { color: t.text }]}>{message}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs, marginBottom: spacing.lg },
  label: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 22 },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: 12, fontFamily: fonts.medium, fontSize: 16 },
  button: { borderRadius: radius.pill, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm },
  buttonText: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 24 },
  error: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 22, color: colors.primary, marginBottom: spacing.md },
  link: { alignSelf: 'center', paddingVertical: spacing.sm },
  linkText: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 22, color: colors.primary },
  or: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: spacing.lg },
  orLine: { flex: 1, height: 1 },
  orText: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 20 },
  google: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: radius.pill, borderWidth: 1, paddingVertical: 14 },
  googleText: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 23 },
  notice: { borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.lg },
  noticeText: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 24 },
})
