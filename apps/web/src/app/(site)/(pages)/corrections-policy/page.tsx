import { StaticPage, staticPageMetadata } from '@/components/PageTemplate'

export const dynamic = 'force-dynamic'
export const revalidate = 300

export const generateMetadata = () => staticPageMetadata('corrections-policy')

export default function Page() {
  return <StaticPage slug="corrections-policy" />
}
