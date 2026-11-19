import { SiteLoadingCard } from '@/components/layout/SiteLoader'
import styles from '@/components/layout/SiteLoader.module.css'

export default function SiteLoading() {
  return (
    <div className={styles.pageLoaderWrap}>
      <SiteLoadingCard />
    </div>
  )
}
