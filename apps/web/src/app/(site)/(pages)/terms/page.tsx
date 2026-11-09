import { StaticPage, staticPageMetadata } from '@/components/PageTemplate'

export const revalidate = 300

export const generateMetadata = () => staticPageMetadata('terms')

export default function Page() {
  return <StaticPage slug="terms" />
}
