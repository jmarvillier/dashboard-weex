import Logo from './Logo.jsx'

export default function Topbar({ loadedAt, excluded, backToLanding }) {
  const n = excluded.size

  return (
    <div className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <Logo small />
      </div>
      <div className="topbar-actions">
        <div className="live-dot" />
        <span style={{ fontSize: '.58rem', color: 'var(--text2)' }}>
          {loadedAt ? `Chargé à ${loadedAt}` : ''}
        </span>
        {n > 0 && (
          <span className="excl-counter visible">
            {n} paire{n > 1 ? 's' : ''} exclue{n > 1 ? 's' : ''}
          </span>
        )}
        <button className="btn-sm" onClick={backToLanding}>← Menu principal</button>
      </div>
    </div>
  )
}
