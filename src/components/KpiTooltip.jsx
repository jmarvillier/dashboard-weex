/**
 * KpiTooltip.jsx
 * Icône ⓘ + bulle tooltip positionnée au-dessus
 */
import { useState, useEffect, useRef } from 'react'

export default function KpiTooltip({ title, description, formula, openId, setOpenId, id }) {
  const ref = useRef(null)
  const isOpen = openId === id

  function toggle(e) {
    e.stopPropagation()
    setOpenId(isOpen ? null : id)
  }

  return (
    <span className="kpi-tooltip-wrap" ref={ref}>
      <button className="kpi-info-icon" onClick={toggle} aria-label="Info" type="button">i</button>
      {isOpen && (
        <div className="kpi-tooltip-bubble">
          {title && <div className="kpi-tooltip-title">{title}</div>}
          {description && <div className="kpi-tooltip-desc">{description}</div>}
          {formula && <div className="kpi-tooltip-formula">{formula}</div>}
        </div>
      )}
    </span>
  )
}
