export default function KpiTooltip({ id, title, description, formula, openId, setOpenId }) {
  const isOpen = openId === id

  function toggle(e) {
    e.stopPropagation()
    setOpenId(isOpen ? null : id)
  }

  return (
    <span className="pc2-tip-wrap">
      <button className="pc2-tip-btn" onClick={toggle} type="button" aria-label="info">i</button>
      {isOpen && (
        <div className="pc2-tip-bubble">
          {title       && <div className="pc2-tip-title">{title}</div>}
          {description && <div className="pc2-tip-desc">{description}</div>}
          {formula     && <div className="pc2-tip-formula">{formula}</div>}
        </div>
      )}
    </span>
  )
}
