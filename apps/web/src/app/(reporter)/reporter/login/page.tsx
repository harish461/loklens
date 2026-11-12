import type { Metadata } from 'next'
import Image from 'next/image'
import { redirect } from 'next/navigation'

import styles from '@/components/reporter/reporter.module.css'
import { checkReporter } from '@/lib/reporter/session'

import { LoginForm } from './LoginForm'

export const metadata: Metadata = { title: 'Sign in' }

type Props = { searchParams: Promise<{ error?: string }> }

export default async function ReporterLoginPage({ searchParams }: Props) {
  const check = await checkReporter()
  if (check.ok) redirect('/reporter')
  if (!check.ok && check.reason === 'staff') redirect('/admin')
  const { error } = await searchParams

  return (
    <div className={styles.loginPage}>
      <div className={styles.loginCard}>
        <div className={styles.loginBrand}>
          <Image src="/brand/logo-96.webp" width={40} height={40} alt="" unoptimized />
          <div>
            <strong>LokLens News</strong>
            <span>Reporter Desk</span>
          </div>
        </div>
        <h1 className={styles.loginTitle}>Sign in</h1>
        <p className={styles.loginSub}>
          Use the email and password your LokLens admin gave you. Accounts are created by the admin only.
        </p>
        {error === 'inactive' && (
          <div className={`${styles.alert} ${styles.alertDanger}`} role="alert">
            This account has been deactivated. Contact the LokLens admin.
          </div>
        )}
        <LoginForm />
      </div>
    </div>
  )
}
