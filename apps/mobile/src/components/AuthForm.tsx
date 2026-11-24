/** Shared pieces for the sign-in, register and reset screens. */
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
  notice: { borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.lg },
  noticeText: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 24 },
})
