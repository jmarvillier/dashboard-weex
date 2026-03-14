/**
 * KpiTooltip.jsx
 * Icône ⓘ + bulle tooltip — un seul ouvert à la fois par carte
 */
import { useEffect, useRef } from 'react'

export default function KpiTooltip({ title, description, formula, openId, setOpenId, id }) {
  const btnRef = useRef(null)
  const isOpen = openId === id

  function toggle(e) {
    e.stopPropagation()
    setOpenId(isOpen ? null : id)
  }

  // Ferme si clic en dehors du bouton
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
        <div className="kpi-tooltip-bubble">
          {title       && <div className="kpi-tooltip-title">{title}</div>}
          {description && <div className="kpi-tooltip-desc">{description}</div>}
          {formula     && <div className="kpi-tooltip-formula">{formula}</div>}
        </div>
      )}
    </span>
  )
}
