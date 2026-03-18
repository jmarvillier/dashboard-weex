/**
 * DcaStep1.jsx — Wizard étape 1 : sélection de la paire et de la période
 */
import { useMemo } from 'react'
import { filterOpsForPlan, PERIOD_LABEL } from '../../lib/dcaUtils.js'
import Stepper from './DcaStepper.jsx'

/* ═══ STEP 1 — Paire ══════════════════════════════════════════════════════ */
function Step1({ wizard, setWizard, pairList, rawRows, onNext, onBack, wizardErr }) {
  const pairs = pairList.map(p => p.name).filter(n => !n.startsWith('USD'))
  const effectivePair = wizard.pair === 'NEW' ? (wizard.customPair||'') : wizard.pair
  const opsCount = useMemo(() => filterOpsForPlan(rawRows, effectivePair, wizard.startDate, wizard.endDate).length, [rawRows, effectivePair, wizard.startDate, wizard.endDate])
  function warnLevel(pair) { if (!pair||pair==='NEW') return null; if (pair.startsWith('BTC')) return null; if (pair.startsWith('ETH')) return 'warn'; return 'danger' }
  const warn = warnLevel(wizard.pair)
  return (
    <div className="dca-scroll">
      <div style={{fontSize:'.58rem',color:'var(--muted)',paddingBottom:4}}>
        <button className="dca-back-btn" style={{background:'none',border:'none',color:'var(--muted)',cursor:'pointer',fontSize:'inherit',fontFamily:'inherit'}} onClick={onBack}>← Plans DCA</button>
      </div>
      <Stepper step={1}/>
      <div className="dca-card">
        <div className="dca-card-title">Paire <span className="dca-tag dca-tag-req">requis</span></div>
        <div className="dca-chip-grid">
          {pairs.map(p => <button key={p} className={`dca-chip${wizard.pair===p?' sel':''}`} onClick={()=>setWizard(w=>({...w,pair:p}))}>{p}</button>)}
          <button className={`dca-chip new-pair${wizard.pair==='NEW'?' sel':''}`} onClick={()=>setWizard(w=>({...w,pair:'NEW'}))}>+ Nouvelle paire</button>
        </div>
        {wizard.pair==='NEW' && (
          <div className="dca-form-row" style={{marginBottom:0}}>
            <div className="dca-form-group"><label>Nom</label><input className="dca-input" placeholder="ex: AVAX/USDT" value={wizard.customPair||''} onChange={e=>setWizard(w=>({...w,customPair:e.target.value}))}/></div>
          </div>
        )}
        {warn==='warn' && <div className="dca-banner dca-banner-warn" style={{marginTop:10}}>⚠️ ETH — avec précaution, volatilité plus élevée que BTC.</div>}
        {warn==='danger' && <div className="dca-banner dca-banner-danger" style={{marginTop:10}}>⛔ DCA gradué <b>fortement déconseillé</b> hors BTC (ETH avec précaution).</div>}
        {wizard.pair && wizard.pair!=='NEW' && (
          <div className="dca-banner dca-banner-info" style={{marginTop:10}}>
            <b>{wizard.pair}</b> — {opsCount} opération{opsCount!==1?'s':''} exécutée{opsCount!==1?'s':''} trouvée{opsCount!==1?'s':''}{wizard.startDate?` depuis le ${new Date(wizard.startDate).toLocaleDateString('fr-FR')}`:''}
          </div>
        )}
      </div>
      <div className="dca-card">
        <div className="dca-card-title">Période</div>
        <div className="dca-form-row">
          <div className="dca-form-group"><label>Date de début <span style={{color:'var(--muted)',fontWeight:'normal'}}>(vide = 1ère op pointée)</span></label><input className="dca-input" type="date" value={wizard.startDate||''} onChange={e=>setWizard(w=>({...w,startDate:e.target.value}))}/></div>
          <div className="dca-form-group"><label>Date de fin <span style={{color:'var(--muted)',fontWeight:'normal'}}>(vide = aujourd'hui)</span></label><input className="dca-input" type="date" value={wizard.endDate||''} onChange={e=>setWizard(w=>({...w,endDate:e.target.value}))}/></div>
        </div>
      </div>
      {wizardErr && <div className="dca-banner dca-banner-danger" style={{marginBottom:4}}>{wizardErr}</div>}
      <div className="dca-btm">
        <button className="dca-btn dca-btn-ghost" onClick={onBack}>← Retour</button>
        <span className="dca-step-hint">Étape 1 / 3</span>
        <button className="dca-btn dca-btn-primary" disabled={!wizard.pair||(wizard.pair==='NEW'&&!wizard.customPair)} onClick={onNext}>
          {opsCount>0 ? 'Voir les opérations →' : 'Paramétrer →'}
        </button>
      </div>
    </div>
  )
}

export default Step1
