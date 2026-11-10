/**
 * LokLens admin dashboard (Payload home view). Server component: numbers come from dashboard-data.ts and
 * the charts are inline SVG, so the page needs no client JavaScript. Styling lives in dashboard.module.css.
 */
import Link from 'next/link'
import type { Payload, TypedUser } from 'payload'

import { formatDateTime } from '../format'
import styles from './dashboard.module.css'
import { type DashboardData, getDashboardData, PERIOD_OPTIONS, type StatCard } from './dashboard-data'

const RED = '#C41D17'
const BLUE = '#1F5FA8'
const DONUT_COLORS = [RED, BLUE, '#E0655F', '#6E9BD1', '#9E1611', '#A9C6E8', '#F2A7A3', '#3D6FA8']

type Props = {
  payload: Payload
  user?: TypedUser | null
  searchParams?: Record<string, string | string[] | undefined>
}

function initialsOf(user: TypedUser | null | undefined): string {
  const u = (user ?? {}) as { displayName?: unknown; name?: unknown; email?: unknown }
  const label = String(u.displayName ?? u.name ?? u.email ?? 'LL').trim()
  const words = label.split(/\s+/).filter(Boolean)
  return (words.length > 1 ? words[0][0] + words[1][0] : label.slice(0, 2)).toUpperCase()
}

function Delta({ value }: { value: number }) {
  const cls = value > 0 ? styles.up : value < 0 ? styles.down : styles.flat
  const sign = value > 0 ? '+' : ''
  return (
    <span className={cls}>
      {sign}
      {value} पिछले 30 दिन
    </span>
  )
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const w = 120
  const h = 36
  const max = Math.max(1, ...values)
  const step = values.length > 1 ? w / (values.length - 1) : w
  const points = values.map((v, i) => `${(i * step).toFixed(1)},${(h - (v / max) * (h - 4) - 2).toFixed(1)}`).join(' ')
  return (
    <svg className={styles.spark} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" focusable="false">
      <polyline points={points} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

function StatCardView({ card, color }: { card: StatCard; color: string }) {
  return (
    <Link href={card.href} className={`${styles.card} ${styles.stat}`}>
      <span className={styles.statLabel}>{card.label}</span>
      <span className={styles.statValue}>{card.total.toLocaleString('en-IN')}</span>
      <Delta value={card.delta} />
      <Sparkline values={card.spark} color={color} />
    </Link>
  )
}

/** Area line chart of articles per day, red markers on days with a breaking story. */
function LineChart({ data }: { data: DashboardData['chart'] }) {
  const w = 640
  const h = 220
  const pad = 24
  const n = data.values.length
  const max = Math.max(4, ...data.values)
  const x = (i: number) => (n > 1 ? pad + (i * (w - pad * 2)) / (n - 1) : w / 2)
  const y = (v: number) => h - pad - (v / max) * (h - pad * 2)
  const line = data.values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const area = `${line} L${x(n - 1).toFixed(1)},${h - pad} L${x(0).toFixed(1)},${h - pad} Z`
  const breaking = new Set(data.breakingDays)
  return (
    <svg className={styles.chart} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Articles published, last ${n} days`}>
      {[0, 0.5, 1].map((t) => (
        <line key={t} x1={pad} x2={w - pad} y1={pad + t * (h - pad * 2)} y2={pad + t * (h - pad * 2)} className={styles.grid} />
      ))}
      <path d={area} fill={BLUE} opacity={0.12} />
      <path d={line} fill="none" stroke={BLUE} strokeWidth={2.5} strokeLinejoin="round" />
      {data.days.map((day, i) =>
        breaking.has(day) ? <circle key={day} cx={x(i)} cy={y(data.values[i])} r={5} fill={RED} stroke="#fff" strokeWidth={2} /> : null,
      )}
      {data.days.map((day, i) =>
        i % Math.ceil(n / 6) === 0 ? (
          <text key={day} x={x(i)} y={h - 4} textAnchor="middle" className={styles.axis}>
            {day.slice(5)}
          </text>
        ) : null,
      )}
    </svg>
  )
}

/** Donut of published articles by category; the total sits in the middle. */
function Donut({ segments, total }: { segments: DashboardData['donut']; total: number }) {
  const r = 70
  const c = 2 * Math.PI * r
  // Segment arcs are computed with a pure reduce, so the render stays side-effect free.
  const arcs = segments.reduce<{ s: DashboardData['donut'][number]; len: number; offset: number }[]>((list, s) => {
    const len = (s.count / total) * c
    const last = list[list.length - 1]
    const offset = last ? last.offset - last.len : 0
    return [...list, { s, len, offset }]
  }, [])
  return (
    <svg className={styles.donut} viewBox="0 0 200 200" role="img" aria-label={`${total} articles by category`}>
      <circle cx={100} cy={100} r={r} fill="none" stroke="#eef0f4" strokeWidth={22} />
      {arcs.map(({ s, len, offset }, i) => {
        return (
          <circle
            key={s.name}
            cx={100}
            cy={100}
            r={r}
            fill="none"
            stroke={DONUT_COLORS[i % DONUT_COLORS.length]}
            strokeWidth={22}
            strokeDasharray={`${len} ${c - len}`}
            strokeDashoffset={offset}
            transform="rotate(-90 100 100)"
          />
        )
      })}
      <text x={100} y={96} textAnchor="middle" className={styles.donutTotal}>
        {total}
      </text>
      <text x={100} y={118} textAnchor="middle" className={styles.donutLabel}>
        articles
      </text>
    </svg>
  )
}

function StatusPill({ status }: { status: 'published' | 'draft' | 'breaking' }) {
  const label = status === 'published' ? 'Published' : status === 'draft' ? 'Draft' : 'Breaking'
  return <span className={`${styles.pill} ${styles[`pill_${status}`]}`}>{label}</span>
}

export async function DashboardView({ payload, user, searchParams }: Props) {
  const raw = Array.isArray(searchParams?.period) ? searchParams?.period[0] : searchParams?.period
  const data = await getDashboardData({ payload, user }, raw ? Number(raw) : undefined)
  const colors = [BLUE, RED, BLUE, RED]

  return (
    <div className={styles.root}>
      <header className={styles.topbar}>
        <h1 className={styles.title}>Dashboard</h1>
        <div className={styles.topActions}>
          <span className={styles.chip}>Last {data.period} days</span>
          <Link href="/admin/collections/articles/create" className={styles.addNew}>
            Add new
          </Link>
          <span className={styles.avatar} aria-label={`Signed in as ${initialsOf(user)}`}>
            {initialsOf(user)}
          </span>
        </div>
      </header>

      <div className={styles.stats}>
        {data.stats.map((card, i) => (
          <StatCardView key={card.label} card={card} color={colors[i]} />
        ))}
      </div>

      <div className={styles.mainRow}>
        <section className={`${styles.card} ${styles.chartCard}`} aria-labelledby="chart-title">
          <div className={styles.cardHead}>
            <h2 id="chart-title" className={styles.cardTitle}>
              Articles published
            </h2>
            <nav className={styles.periods} aria-label="Period">
              {PERIOD_OPTIONS.map((p) => (
                <Link
                  key={p}
                  href={`/admin?period=${p}`}
                  className={p === data.period ? styles.periodActive : styles.period}
                  aria-current={p === data.period ? 'true' : undefined}
                >
                  {p}d
                </Link>
              ))}
            </nav>
          </div>
          {data.chart.values.every((v) => v === 0) ? (
            <p className={styles.empty}>No articles were published in the last {data.period} days.</p>
          ) : (
            <LineChart data={data.chart} />
          )}
          <p className={styles.legend}>
            <span className={styles.dotBlue} /> Articles per day <span className={styles.dotRed} /> Breaking story
          </p>
        </section>

        <section className={styles.card} aria-labelledby="donut-title">
          <h2 id="donut-title" className={styles.cardTitle}>
            Articles by category
          </h2>
          {data.donutTotal === 0 ? (
            <p className={styles.empty}>No published articles yet.</p>
          ) : (
            <>
              <Donut segments={data.donut} total={data.donutTotal} />
              <ul className={styles.legendList}>
                {data.donut.map((s, i) => (
                  <li key={s.name}>
                    <span className={styles.swatch} style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                    {s.name}
                    <strong>{s.count}</strong>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      <section className={styles.card} aria-labelledby="latest-title">
        <div className={styles.cardHead}>
          <h2 id="latest-title" className={styles.cardTitle}>
            Latest articles
          </h2>
          <Link href="/admin/collections/articles" className={styles.more}>
            View all
          </Link>
        </div>
        {data.latest.length === 0 ? (
          <p className={styles.empty}>No articles yet. Use Add new to write the first one.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Title</th>
                  <th scope="col">Category</th>
                  <th scope="col">Status</th>
                  <th scope="col">Published</th>
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.latest.map((a) => (
                  <tr key={a.id}>
                    <td className={styles.titleCell}>{a.title}</td>
                    <td>{a.category}</td>
                    <td>
                      <StatusPill status={a.status} />
                    </td>
                    <td>{a.date ? formatDateTime(a.date) : '—'}</td>
                    <td>
                      <Link href={a.editHref} className={styles.edit}>
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className={styles.bottomRow}>
        <section className={styles.card} aria-labelledby="activity-title">
          <h2 id="activity-title" className={styles.cardTitle}>
            Recent activity
          </h2>
          {data.activity.length === 0 ? (
            <p className={styles.empty}>No changes yet.</p>
          ) : (
            <ul className={styles.activity}>
              {data.activity.map((a) => (
                <li key={a.id}>
                  <Link href={a.editHref}>{a.title}</Link>
                  <time dateTime={a.updatedAt}>{formatDateTime(a.updatedAt)}</time>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={styles.card} aria-labelledby="quick-title">
          <h2 id="quick-title" className={styles.cardTitle}>
            Quick links
          </h2>
          <ul className={styles.quick}>
            <li>
              <Link href="/admin/collections/articles/create">New article</Link>
            </li>
            <li>
              <Link href="/admin/collections/media/create">Upload media</Link>
            </li>
            <li>
              <Link href="/admin/globals/site-settings">Edit homepage settings</Link>
            </li>
          </ul>
        </section>
      </div>
    </div>
  )
}
