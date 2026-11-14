import React from 'react'

export function AdminLogo() {
  return (
    <div className="loklens-login-brand">
      <div className="loklens-login-brand__logo-wrap">
        <img
          src="/brand/logo-144.webp"
          alt="LokLens News"
          width={72}
          height={72}
          className="loklens-login-brand__logo"
        />
      </div>
      <div className="loklens-login-brand__text">
        <span className="loklens-login-brand__badge">Editorial CMS Portal</span>
        <h1 className="loklens-login-brand__title">लोक Lens न्यूज़</h1>
        <p className="loklens-login-brand__subtitle">
          Sign in to manage newsroom stories, categories &amp; live coverage
        </p>
      </div>
    </div>
  )
}

export function AdminIcon() {
  return (
    <img
      src="/brand/logo-96.webp"
      alt="LokLens News"
      width={32}
      height={32}
      style={{ borderRadius: '8px', display: 'block' }}
    />
  )
}

