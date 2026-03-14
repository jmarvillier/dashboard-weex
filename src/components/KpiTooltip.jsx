import { useEffect, useRef, useState } from 'react'

export default function KpiTooltip({ id, title, description, formula, openId, setOpenId }) {
  const btnRef = useRef(null)
  const isOpen = openId === id
  const [pos, setPos] = useState({ top: 0, left: 0 })

  function toggle(e) {
    e.stopPropagation()
    if (!isOpen && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.top - 6, left: r.left })
    }
    setOpenId(isOpen ? null : id)
  }

  useEffect(() => {
    if (!isOpen) return
    function onDoc(e) {
      if (btnRef.current && !btnRef.current.contains(e.target)) setOpenId(null)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [isOpen, setOpenId])

  return (
    <span className="pc2-tip-wrap" ref={btnRef}>
      <button className="pc2-tip-btn" onClick={toggle} type="button" aria-label="info">i</button>
      {isOpen && (
        <div
          className="pc2-tip-bubble"
          style={{ top: pos.top, left: pos.left, transform: 'translateY(-100%)' }}
        >
          {title       && <div className="pc2-tip-title">{title}</div>}
          {description && <div className="pc2-tip-desc">{description}</div>}
          {formula     && <div className="pc2-tip-formula">{formula}</div>}
        </div>
      )}
    </span>
  )
}
