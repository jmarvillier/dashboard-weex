/**
 * KpiTooltip.jsx
 * Bulle en position: fixed — jamais coupée par overflow parent
 */
import { useEffect, useRef, useState } from 'react'

export default function KpiTooltip({ title, description, formula, openId, setOpenId, id }) {
  const btnRef  = useRef(null)
  const isOpen  = openId === id
  const [pos, setPos] = useState({ top: 0, left: 0 })

  function toggle(e) {
    e.stopPropagation()
    if (!isOpen && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({
        top:  r.top - 8,           // au-dessus du bouton
        left: r.left,
      })
    }
    setOpenId(isOpen ? null : id)
  }

  useEffect(() => {
    if (!isOpen) return
    function onDoc(e) {
      if (btnRef.current && !btnRef.current.contains(e.target)) {
        setOpenId(null)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [isOpen, setOpenId])

  return (
    <span className="kpi-tooltip-wrap" ref={btnRef}>
      <button
        className="kpi-info-icon"
        onClick={toggle}
        aria-label="Info"
        type="button"
      >
        i
      </button>
      {isOpen && (
        <div
          className="kpi-tooltip-bubble"
          style={{
            top:       pos.top,
            left:      pos.left,
            transform: 'translateY(-100%)',
          }}
        >
          {title       && <div className="kpi-tooltip-title">{title}</div>}
          {description && <div className="kpi-tooltip-desc">{description}</div>}
          {formula     && <div className="kpi-tooltip-formula">{formula}</div>}
        </div>
      )}
    </span>
  )
}
