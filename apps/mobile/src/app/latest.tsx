/** "सभी देखें" from Home: every published story, newest first (infinite). */
import { StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ArticleFeed } from '@/components/ArticleFeed'
import { TopBar } from '@/components/TopBar'
import { useTheme } from '@/theme'

export default function LatestScreen() {
  const t = useTheme()
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: t.bg }]} edges={['top']}>
      <TopBar title="सभी खबरें" />
      <ArticleFeed params={{}} />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
})
