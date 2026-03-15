import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export default function KpiTooltip({ id, title, description, formula, openId, setOpenId }) {
  const btnRef    = useRef(null)
  const bubbleRef = useRef(null)
  const isOpen    = openId === id

  // Position initiale brute (relative au btn)
  const [pos, setPos] = useState({ top: 0, left: 0, placement: 'top' })

  function toggle(e) {
    e.stopPropagation()
    if (!isOpen && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      // On stocke les coordonnées du bouton ; l'ajustement fin se fait dans useLayoutEffect
      setPos({ btnRect: r, placement: 'top', top: 0, left: 0 })
    }
    setOpenId(isOpen ? null : id)
  }

  // Après rendu de la bubble, ajuster pour rester dans le viewport
  useLayoutEffect(() => {
    if (!isOpen || !bubbleRef.current || !pos.btnRect) return
    const r   = pos.btnRect
    const bub = bubbleRef.current.getBoundingClientRect()
    const vw  = window.innerWidth
    const vh  = window.innerHeight
    const gap = 8

    // Placement vertical : préférer au-dessus, sinon en-dessous
    let placement = 'top'
    let top = r.top - bub.height - gap
    if (top < 8) {
      placement = 'bottom'
      top = r.bottom + gap
    }
    // Si en-dessous dépasse aussi → coller en haut du viewport
    if (top + bub.height > vh - 8) top = vh - bub.height - 8

    // Placement horizontal : centré sur le bouton, puis clampé
    let left = r.left + r.width / 2 - bub.width / 2
    if (left < 8) left = 8
    if (left + bub.width > vw - 8) left = vw - bub.width - 8

    setPos(p => ({ ...p, top, left, placement }))
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fermeture au clic extérieur
  useEffect(() => {
    if (!isOpen) return
    function onDoc(e) {
      if (btnRef.current && !btnRef.current.contains(e.target)) setOpenId(null)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('touchstart', onDoc)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('touchstart', onDoc)
    }
  }, [isOpen, setOpenId])

  return (
    <span className="pc2-tip-wrap" ref={btnRef}>
      <button className="pc2-tip-btn" onClick={toggle} type="button" aria-label="info">i</button>
      {isOpen && (
        <div
          ref={bubbleRef}
          className={`pc2-tip-bubble${pos.btnRect ? ' pc2-tip-bubble--visible' : ''}`}
          style={{ top: pos.top, left: pos.left }}
        >
          {title       && <div className="pc2-tip-title">{title}</div>}
          {description && <div className="pc2-tip-desc">{description}</div>}
          {formula     && <div className="pc2-tip-formula">{formula}</div>}
        </div>
      )}
    </span>
  )
}
