import { Link } from 'react-router-dom'

const ONBOARDING_EMBED_URL = 'https://onboarding.atvos.io/dashboard'

export default function OnboardingEmbedPage() {
  return (
    <div className="onboarding-embed-shell">
      <header className="onboarding-embed-bar">
        <Link to="/dashboard" className="onboarding-embed-back">
          ← Hub ATV
        </Link>
      </header>
      <iframe
        className="onboarding-embed-frame"
        src={ONBOARDING_EMBED_URL}
        title="ATV Onboarding"
        allow="clipboard-read; clipboard-write"
      />
    </div>
  )
}
