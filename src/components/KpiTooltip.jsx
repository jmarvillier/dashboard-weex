import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export default function KpiTooltip({ id, title, description, formula, openId, setOpenId }) {
  const isOpen      = openId === id
  const wrapRef     = useRef(null)
  const bubbleRef   = useRef(null)
  const [placement, setPlacement] = useState('top')
  const [ready,     setReady]     = useState(false)

  useLayoutEffect(() => {
    if (!isOpen || !wrapRef.current || !bubbleRef.current) return
    const wrap    = wrapRef.current.getBoundingClientRect()
    const bub     = bubbleRef.current.getBoundingClientRect()
    const topbarH = 54
    const gap     = 8
    setPlacement(wrap.top - bub.height - gap < topbarH ? 'bottom' : 'top')
    setReady(true)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) setReady(false)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    function onOut(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpenId(null)
    }
    document.addEventListener('mousedown', onOut)
    document.addEventListener('touchstart', onOut)
    return () => {
      document.removeEventListener('mousedown', onOut)
      document.removeEventListener('touchstart', onOut)
    }
  }, [isOpen, setOpenId])

  function toggle(e) {
    e.stopPropagation()
    setOpenId(isOpen ? null : id)
  }

  return (
    <span ref={wrapRef} className="pc2-tip-wrap">
      <button className="pc2-tip-btn" onClick={toggle} type="button" aria-label="info">i</button>
      {isOpen && (
        <div
          ref={bubbleRef}
          className={`pc2-tip-bubble pc2-tip-bubble--${placement}`}
          style={{ opacity: ready ? 1 : 0 }}
        >
          {title       && <div className="pc2-tip-title">{title}</div>}
          {description && <div className="pc2-tip-desc">{description}</div>}
          {formula     && <div className="pc2-tip-formula">{formula}</div>}
        </div>
      )}
    </span>
  )
}
