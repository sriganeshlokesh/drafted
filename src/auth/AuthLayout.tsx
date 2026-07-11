import { useRef, useEffect, useCallback, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

import './auth.css'

function MatchScoreCard() {
  const [score, setScore] = useState(0)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number | null>(null)

  const runCountUp = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    startRef.current = null

    const TARGET = 82
    const DURATION = 1300

    function tick(now: number) {
      if (startRef.current === null) startRef.current = now
      const t = Math.min((now - startRef.current) / DURATION, 1)
      const eased = 1 - Math.pow(1 - t, 3) // easeOutCubic
      setScore(Math.round(eased * TARGET))
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [])

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setScore(82)
      return
    }
    runCountUp()
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [runCountUp])

  return (
    <div className="orbit-card orbit-match-score" onClick={runCountUp} role="button" aria-label="Replay animation">
      <div className="ms-header">
        <span className="ms-label">Match Score</span>
        <span className="ms-replay">↻ replay</span>
      </div>
      <div className="ms-score-row">
        <span className="ms-number">{score}</span>
        <span className="ms-denom">/100</span>
        <span className="chip chip-green chip-sm chip-pop chip-pop-1 ms-chip">STRONG MATCH</span>
      </div>
      <div className="ms-bar-track">
        <div className="ms-bar-fill" style={{ width: `${score}%` }} />
      </div>
    </div>
  )
}

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-orbit-canvas">
      {/* Decorative blurred circles */}
      <div className="auth-orb-1" aria-hidden="true" />
      <div className="auth-orb-2" aria-hidden="true" />

      {/* Brand */}
      <Link to="/" className="auth-brand" aria-label="Drafted home">
        <img src="/logo.svg" alt="" />
        <span className="auth-brand-name">drafted</span>
      </Link>

      {/* Top accent — +14 pts */}
      <div className="orbit-pill orbit-pts-week" aria-hidden="true">
        <div className="pts-inner">
          <span className="pts-up">↑</span>
          <span className="pts-text">+14 pts this week</span>
        </div>
      </div>

      {/* Left column */}
      <MatchScoreCard />

      <div className="orbit-card orbit-keywords" aria-hidden="true">
        <div className="kw-header">
          <span className="kw-label">Keywords</span>
          <span className="kw-count">12 <span>/ 15</span></span>
        </div>
        <div className="kw-chips">
          <span className="chip chip-green chip-pop chip-pop-2">Roadmapping ✓</span>
          <span className="chip chip-green chip-pop chip-pop-3">SQL ✓</span>
          <span className="chip chip-amber chip-pop chip-pop-4">+ Stakeholders</span>
        </div>
      </div>

      <div className="orbit-pill orbit-ats" aria-hidden="true">
        <div className="ats-inner">
          <span className="ats-icon">✓</span>
          <span className="ats-text">ATS-friendly format</span>
        </div>
      </div>

      {/* Centered auth card */}
      <div className="auth-card">{children}</div>

      {/* Right column */}
      <div className="orbit-card orbit-feedback" aria-hidden="true">
        <div className="fb-top">
          <span className="chip chip-amber chip-pop chip-pop-5">+6 pts</span>
          <span className="fb-text">Add a bullet describing leadership on the Northwind launch.</span>
        </div>
        <div className="fb-divider" />
        <div className="fb-bottom">
          <span className="fb-applied">✓ Applied</span>
          <span className="fb-more">2 more suggestions</span>
        </div>
      </div>

      <div className="orbit-card orbit-rewrite" aria-hidden="true">
        <div className="rw-header">
          <span className="rw-label">Suggested Rewrite</span>
          <span className="chip chip-green chip-sm chip-pop chip-pop-4">+4 pts</span>
        </div>
        <p className="rw-before">Managed the website redesign project.</p>
        <p className="rw-after">Led a 6-person redesign that cut page load time 40%.</p>
      </div>

      <div className="orbit-waiting" aria-hidden="true">
        <div className="waiting-inner">
          <span className="waiting-dot" />
          <span className="waiting-text">Your match report is waiting</span>
        </div>
      </div>

      {/* Bottom accent */}
      <div className="orbit-download" aria-hidden="true">
        <div className="download-inner">
          <span>↓</span>
          <span>Download .pdf</span>
        </div>
      </div>
    </div>
  )
}
