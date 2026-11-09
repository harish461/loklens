import { StaticPage, staticPageMetadata } from '@/components/PageTemplate'

export const revalidate = 300

export const generateMetadata = () => staticPageMetadata('advertise')

export default function Page() {
  return <StaticPage slug="advertise" />
}
