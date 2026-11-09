'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

/** Link that marks itself `aria-current="page"` for the current section; styling hooks off that. */
export function NavLink({
  href,
  className,
  children,
  exact = false,
}: {
  href: string
  className?: string
  children: ReactNode
  exact?: boolean
}) {
  const pathname = usePathname() ?? '/'
  const active = exact || href === '/' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
  return (
    <Link href={href} className={className} aria-current={active ? 'page' : undefined}>
      {children}
    </Link>
  )
}
