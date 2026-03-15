import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export default function KpiTooltip({ id, title, description, formula, openId, setOpenId }) {
  const btnRef    = useRef(null)
  const bubbleRef = useRef(null)
  const isOpen    = openId === id
  const [style, setStyle] = useState({ opacity: 0, top: 0, left: 0 })

  function toggle(e) {
    e.stopPropagation()
    setOpenId(isOpen ? null : id)
  }

  // Repositionner la bubble après chaque ouverture
  useLayoutEffect(() => {
    if (!isOpen || !bubbleRef.current || !btnRef.current) return

    const btn = btnRef.current.getBoundingClientRect()
    const bub = bubbleRef.current.getBoundingClientRect()
    const vw  = window.innerWidth
    const vh  = window.innerHeight
    const gap = 6

    // Centré horizontalement sur le bouton
    let left = btn.left + btn.width / 2 - bub.width / 2
    // Au-dessus par défaut
    let top  = btn.top - bub.height - gap

    // Flip vers le bas si débordement en haut
    if (top < 8) top = btn.bottom + gap

    // Clamp horizontal
    if (left < 8)              left = 8
    if (left + bub.width > vw - 8) left = vw - bub.width - 8

    // Clamp vertical
    if (top + bub.height > vh - 8) top = vh - bub.height - 8

    setStyle({ opacity: 1, top, left })
  }, [isOpen])

  // Fermeture au clic extérieur + touch
  useEffect(() => {
    if (!isOpen) return
    function onOut(e) {
      if (btnRef.current && !btnRef.current.contains(e.target)) setOpenId(null)
    }
    document.addEventListener('mousedown', onOut)
    document.addEventListener('touchstart', onOut)
    return () => {
      document.removeEventListener('mousedown', onOut)
      document.removeEventListener('touchstart', onOut)
    }
  }, [isOpen, setOpenId])

  // Reset opacité à la fermeture
  useEffect(() => {
    if (!isOpen) setStyle({ opacity: 0, top: 0, left: 0 })
  }, [isOpen])

  return (
    <span ref={btnRef} className="pc2-tip-wrap">
      <button className="pc2-tip-btn" onClick={toggle} type="button" aria-label="info">i</button>
      {isOpen && (
        <div
          ref={bubbleRef}
          className="pc2-tip-bubble"
          style={{ top: style.top, left: style.left, opacity: style.opacity }}
        >
          {title       && <div className="pc2-tip-title">{title}</div>}
          {description && <div className="pc2-tip-desc">{description}</div>}
          {formula     && <div className="pc2-tip-formula">{formula}</div>}
        </div>
      )}
    </span>
  )
}
