import { Tabs } from 'expo-router'

import { FloatingTabBar } from '@/components/FloatingTabBar'
import { colors } from '@/theme'

const TITLES: Record<string, string> = {
  index: 'होम',
  categories: 'श्रेणियाँ',
  shorts: 'शॉर्ट्स',
  bookmarks: 'बुकमार्क',
  profile: 'प्रोफ़ाइल',
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.background } }}
    >
      {Object.entries(TITLES).map(([name, title]) => (
        <Tabs.Screen key={name} name={name} options={{ title }} />
      ))}
    </Tabs>
  )
}
