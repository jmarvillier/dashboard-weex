export default function LoadingOverlay({ visible, text }) {
  return (
    <div id="loadingOverlay" className={visible ? 'show' : ''}>
      <div className="ld-logo">Ydash</div>
      <div className="ld-bar"><div className="ld-fill" /></div>
      <div className="ld-txt">{text || 'Chargement…'}</div>
    </div>
  )
}
