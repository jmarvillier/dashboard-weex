/**
 * DcaStep2.jsx — Wizard étape 2 : pointage des opérations
 */
import { useState, useEffect, useMemo } from 'react'
import { filterOpsForPlan, getOpKey, fmt } from '../../lib/dcaUtils.js'
import { computeBreakeven, computeAvgPrice } from '../../hooks/useDcaStrategy.js'
import Stepper from './DcaStepper.jsx'

/* ═══ STEP 2 — Pointage ═══════════════════════════════════════════════════ */
function Step2({ wizard, setWizard, rawRows, onNext, onBack, onFlagOps }) {
  const effectivePair = wizard.pair==='NEW' ? (wizard.customPair||'') : wizard.pair
  const ops = useMemo(() => filterOpsForPlan(rawRows, effectivePair, wizard.startDate, wizard.endDate), [rawRows, effectivePair, wizard.startDate, wizard.endDate])
  useEffect(() => {
    if (ops.length && wizard.pointedOps === undefined)
      setWizard(w => ({ ...w, pointedOps: ops.map((op,i) => getOpKey(op,i)) }))
  }, [ops.length])
  const pointed = wizard.pointedOps || []
  function toggle(key) { setWizard(w => { const s=new Set(w.pointedOps||[]); s.has(key)?s.delete(key):s.add(key); return {...w,pointedOps:[...s]} }) }
  function setAll(val) { setWizard(w => ({...w, pointedOps: val ? ops.map((op,i)=>getOpKey(op,i)) : []})) }
  const pointedOps = ops.filter((op,i) => pointed.includes(getOpKey(op,i)))
  const breakeven  = computeBreakeven(pointedOps)
  const avgPrice   = computeAvgPrice(pointedOps)
  const totalUsdt  = pointedOps.filter(o=>o.sens==='Achat').reduce((s,o)=>s+o.usdt,0)
  if (ops.length === 0) return (
    <div className="dca-scroll">
      <div style={{fontSize:'.58rem',color:'var(--muted)',paddingBottom:4}}><button className="dca-back-btn" style={{background:'none',border:'none',color:'var(--muted)',cursor:'pointer',fontSize:'inherit',fontFamily:'inherit'}} onClick={onBack}>← Plans DCA</button></div>
      <Stepper step={2}/>
      <div className="dca-banner dca-banner-warn">Aucune opération exécutée pour <b>{effectivePair}</b>. Passage direct au paramétrage.</div>
      <div className="dca-btm"><button className="dca-btn dca-btn-ghost" onClick={onBack}>← Retour</button><button className="dca-btn dca-btn-primary" onClick={onNext}>Paramétrer →</button></div>
    </div>
  )
  return (
    <div className="dca-scroll">
      <div style={{fontSize:'.58rem',color:'var(--muted)',paddingBottom:4}}><button className="dca-back-btn" style={{background:'none',border:'none',color:'var(--muted)',cursor:'pointer',fontSize:'inherit',fontFamily:'inherit'}} onClick={onBack}>← Plans DCA</button></div>
      <Stepper step={2}/>
      <div className="dca-card">
        <div className="dca-ops-header">
          <div><div className="dca-ops-title">{effectivePair} — Opérations exécutées</div><div className="dca-ops-meta">{ops.length} opérations · <b style={{color:'var(--green)'}}>{pointed.length} intégrées au DCA</b></div></div>
          <div className="dca-ops-btns"><button className="dca-ops-btn" onClick={()=>setAll(true)}>Tout cocher</button><button className="dca-ops-btn" onClick={()=>setAll(false)}>Tout décocher</button></div>
        </div>
        <div className="dca-banner dca-banner-info" style={{marginBottom:10}}>Toutes les opérations sont cochées par défaut. Décochez celles à exclure du calcul du breakeven.</div>
        <div className="dca-ops-tbl-wrap">
          <table className="dca-ops-tbl">
            <thead><tr><th>Date</th><th>Sens</th><th style={{textAlign:'right'}}>Prix</th><th style={{textAlign:'right'}}>Montant</th><th style={{textAlign:'right'}}>Volume</th><th className="th-dca">DCA ✓</th></tr></thead>
            <tbody>
              {ops.map((op,i) => { const key=getOpKey(op,i); const chk=pointed.includes(key); return (
                <tr key={key}>
                  <td>{op.date?op.date.toLocaleDateString('fr-FR'):'—'}</td>
                  <td><span className={`db-badge ${op.sens==='Achat'?'badge-buy':'badge-sell'}`}>{op.sens}</span></td>
                  <td style={{textAlign:'right',fontFamily:"'Space Mono',monospace",fontSize:'.6rem'}}>{op.prix?fmt(op.prix):'—'}</td>
                  <td style={{textAlign:'right',fontFamily:"'Space Mono',monospace",fontSize:'.6rem'}}>{op.usdt?`$${op.usdt.toFixed(2)}`:'—'}</td>
                  <td style={{textAlign:'right',fontFamily:"'Space Mono',monospace",fontSize:'.58rem',color:'var(--muted)'}}>{op.vol?op.vol.toFixed(6):'—'}</td>
                  <td className="td-chk"><input type="checkbox" className="dca-ops-chk" checked={chk} onChange={()=>toggle(key)}/></td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
        <div className="dca-ops-summary">
          <div><span>Investi DCA : </span><b>{totalUsdt>0?`$${totalUsdt.toFixed(2)}`:'—'}</b></div>
          <div><span>Prix moyen : </span><b>{avgPrice>0?fmt(avgPrice):'—'}</b></div>
          <div><span>Breakeven : </span><b style={{color:'var(--gold)'}}>{breakeven>0?fmt(breakeven):'—'}</b></div>
          <div><span>Lignes : </span><b>{pointed.length} / {ops.length}</b></div>
        </div>
      </div>
      <div className="dca-btm" style={{position:'sticky',bottom:0,background:'var(--bg2)',zIndex:10,borderTop:'1px solid var(--border)',marginTop:8}}>
        <button className="dca-btn dca-btn-ghost" onClick={onBack}>← Retour</button>
        <span className="dca-step-hint">Étape 2 / 3</span>
        <button className="dca-btn dca-btn-primary" onClick={async()=>{ await onFlagOps?.(ops, pointed); onNext() }}>Paramétrer →</button>
      </div>
    </div>
  )
}

export default Step2
