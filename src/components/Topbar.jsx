export default function Topbar({ fileName, loadedAt, excluded, reloadDefault, backToLanding }) {
  const n = excluded.size
  return (
    <div className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div className="topbar-logo">WEEX</div>
        <div className="topbar-file">📊 <strong>{fileName}</strong></div>
      </div>
      <div className="topbar-actions">
        <div className="live-dot" />
        <span style={{ fontSize: '.58rem', color: 'var(--text2)' }}>{loadedAt ? `Chargé à ${loadedAt}` : ''}</span>
        {n > 0 && (
          <span className="excl-counter visible">
            {n} paire{n > 1 ? 's' : ''} exclue{n > 1 ? 's' : ''}
          </span>
        )}
        <button className="btn-sm" onClick={reloadDefault}>⟳ Actualiser</button>
        <button className="btn-sm" onClick={backToLanding}>← Changer de fichier</button>
      </div>
    </div>
  )
}
