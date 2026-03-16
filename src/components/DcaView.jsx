/**
 * DcaView.jsx — v3
 * Rechargement DCA, achats partiels, cycle en cours, paliers profits améliorés
 */

import { useState, useEffect, useMemo } from 'react'
import '../styles/dca.css'
import { getDcaPlans, saveDcaPlan, deleteDcaPlan, getDcaTemplates, saveDcaTemplate, deleteDcaTemplate } from '../lib/dcaRepository.js'
import { updateRow, loadSnapshot } from '../lib/repository.js'
import EntryForm from './EntryForm.jsx'
import {
  computeBreakeven, computeAvgPrice, computeRechargement,
  computeSignal, generateTimeline, getEffectiveStart, getCurrentPeriodOps,
} from '../hooks/useDcaStrategy.js'


/* ── Defaults ────────────────────────────────────────────────────────────── */
const DEFAULT_ACC_ZONES = [
  { label: 'Zone A', ecartMin: '',  ecartMax: '0',   amount: 10  },
  { label: 'Zone B', ecartMin: '0', ecartMax: '5',   amount: 7.5 },
  { label: 'Zone C', ecartMin: '5', ecartMax: '10',  amount: 5   },
  { label: 'Zone D', ecartMin: '10',ecartMax: '20',  amount: 2.5 },
]
const DEFAULT_DEBT_ZONES = [
  { label: 'Signal fort',    ecartThreshold: '-10', debtPct: 50  },
  { label: 'Signal extrême', ecartThreshold: '-20', debtPct: 100 },
]
const DEFAULT_PROFIT_ZONES = [
  { label: 'Palier 1', ecartThreshold: '25',  positionPct: '' },
  { label: 'Palier 2', ecartThreshold: '50',  positionPct: '' },
  { label: 'Palier 3', ecartThreshold: '75',  positionPct: '' },
  { label: 'Palier 4', ecartThreshold: '100', positionPct: '' },
]
const ZONE_COLORS = {
  acc:    ['#3dbf90','#2a9d70','#c8a020','#d4720a','#b85808'],
  debt:   ['#85B7EB','#378ADD'],
  profit: ['#F7C1C1','#F09595','#E24B4A','#A32D2D','#501313'],
}
const PERIOD_LABEL = { day: 'jour', week: 'semaine', month: 'mois' }

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function fmt(v, dec = 0) {
  if (v == null || isNaN(v)) return '—'
  return '$' + Number(v).toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}
function pct(v) { return v == null ? '—' : (v >= 0 ? '+' : '') + Number(v).toFixed(2) + '%' }

function filterOpsForPlan(rawRows, pair, startDate, endDate) {
  if (!rawRows?.length || !pair) return []
  const start = startDate ? new Date(startDate) : null
  const end   = endDate   ? new Date(endDate)   : new Date()
  return rawRows.filter(r => {
    if (!r.exec || r.pair !== pair) return false
    if (start && r.date && r.date < start) return false
    if (end   && r.date && r.date > end)   return false
    return true
  })
}

function getOpKey(op, idx) { return `${op.date?.toISOString?.() || idx}_${idx}` }

function nowLocal() {
  const d = new Date(); d.setSeconds(0, 0)
  return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

/* ── Stepper ─────────────────────────────────────────────────────────────── */
function Stepper({ step }) {
  const steps = [['Paire','& période'],['Pointage','opérations'],['Paramètres','stratégie']]
  return (
    <div className="dca-stepper">
      {steps.map(([label, sub], i) => {
        const done = i+1 < step, active = i+1 === step
        return (
          <>
            <div key={i} className={`dca-step${active?' active':done?' done':''}`}>
              <div className="dca-step-circle">{done ? '✓' : i+1}</div>
              <div className="dca-step-text">{label}<br/>{sub}</div>
            </div>
            {i < steps.length-1 && <div key={`l${i}`} className={`dca-step-line${done?' done':''}`}/>}
          </>
        )
      })}
    </div>
  )
}

/* ═══ SCREEN 0 — Liste ════════════════════════════════════════════════════ */
function DcaList({ onNew, onOpen, plans, loading, onDelete, templates, onDeleteTpl }) {
  const [confirm, setConfirm] = useState(null)
  const [showTpls, setShowTpls]   = useState(false)
  function iconClass(p='') { return `dca-plan-icon${p.startsWith('BTC')?' dca-plan-icon-btc':p.startsWith('ETH')?' dca-plan-icon-eth':' dca-plan-icon-def'}` }
  return (
    <div className="dca-scroll">
      <div className="dca-list-header">
        <div>
          <div className="dca-list-title">Scaled Mirror DCA</div>
          <div className="dca-list-sub">Accumulation graduée + distribution symétrique</div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button className="dca-btn" onClick={()=>setShowTpls(v=>!v)} style={{fontSize:'.62rem'}}>⚙ Templates</button>
          <button className="dca-btn dca-btn-primary" onClick={onNew}>+ Nouveau plan</button>
        </div>
      </div>

      {/* ── Section templates ── */}
      {showTpls && (
        <div className="dca-card" style={{marginBottom:8}}>
          <div className="dca-card-title" style={{marginBottom:10}}>Mes templates de paramétrage</div>
          {templates?.length === 0 && (
            <div style={{fontSize:'.62rem',color:'var(--muted)'}}>Aucun template enregistré. Créez un plan, allez à l'étape paramétrage et cliquez "Enregistrer comme template".</div>
          )}
          {templates?.map(t => (
            <div key={t.id} style={{display:'flex',alignItems:'center',gap:10,padding:'7px 0',borderBottom:'0.5px solid var(--border)'}}>
              <div style={{flex:1}}>
                <div style={{fontSize:'.7rem',fontWeight:'500',color:'var(--text)'}}>{t.name}</div>
                <div style={{fontSize:'.56rem',color:'var(--muted)'}}>
                  {t.baseAmount} USDT/{t.frequency==='day'?'jour':t.frequency==='week'?'sem.':'mois'}
                  {t.accZones?.length ? ` · ${t.accZones.length} zones acc.` : ''}
                  {t.profitZones?.length ? ` · ${t.profitZones.length} paliers profit` : ''}
                </div>
              </div>
              <button className="dca-plan-del-btn" onClick={() => onDeleteTpl(t.id)}>✕</button>
            </div>
          ))}
        </div>
      )}
      {loading && <div className="dca-banner dca-banner-info">Chargement…</div>}
      {!loading && plans.length === 0 && <div className="dca-empty-zone" onClick={onNew}>+ Aucun plan — cliquez pour en créer un</div>}
      {plans.map(plan => (
        <div key={plan.id} className="dca-plan-item" onClick={() => onOpen(plan)}>
          <div className={iconClass(plan.pair)}>{(plan.pair||'').split('/')[0].slice(0,3)}</div>
          <div className="dca-plan-info">
            <div className="dca-plan-pair">{plan.pair}</div>
            <div className="dca-plan-meta">{plan.baseAmount} USDT/{PERIOD_LABEL[plan.frequency]||'jour'}{plan.startDate ? ` · depuis ${new Date(plan.startDate).toLocaleDateString('fr-FR')}` : ''}</div>
          </div>
          <div className="dca-plan-right"><div className="dca-plan-status dca-status-acc">Accumulation</div></div>
          <button className="dca-plan-del-btn" onClick={e => { e.stopPropagation(); setConfirm(plan.id) }}>✕</button>
        </div>
      ))}
      {confirm && (
        <div className="dca-banner dca-banner-danger" style={{marginTop:8}}>
          Supprimer ce plan ? Le journal <b>ne sera pas modifié</b>.{' '}
          <button className="dca-btn" style={{marginLeft:8,padding:'3px 10px',fontSize:'.6rem'}} onClick={async()=>{ await onDelete(confirm); setConfirm(null) }}>Confirmer</button>
          <button className="dca-btn dca-btn-ghost" style={{marginLeft:4,padding:'3px 8px',fontSize:'.6rem'}} onClick={()=>setConfirm(null)}>Annuler</button>
        </div>
      )}
      <div className="dca-banner dca-banner-info" style={{marginTop:8}}>Supprimer un plan efface uniquement sa configuration — le journal n'est pas touché.</div>
    </div>
  )
}

/* ═══ STEP 1 — Paire ══════════════════════════════════════════════════════ */
function Step1({ wizard, setWizard, pairList, rawRows, onNext, onBack }) {
  const pairs = pairList.map(p => p.name).filter(n => !n.startsWith('USD'))
  const effectivePair = wizard.pair === 'NEW' ? (wizard.customPair||'') : wizard.pair
  const opsCount = useMemo(() => filterOpsForPlan(rawRows, effectivePair, wizard.startDate, wizard.endDate).length, [rawRows, effectivePair, wizard.startDate, wizard.endDate])
  function warnLevel(pair) { if (!pair||pair==='NEW') return null; if (pair.startsWith('BTC')) return null; if (pair.startsWith('ETH')) return 'warn'; return 'danger' }
  const warn = warnLevel(wizard.pair)
  return (
    <div className="dca-scroll"><div style={{fontSize:'.58rem',color:'var(--muted)',paddingBottom:4}}><button className="dca-back-btn" style={{background:'none',border:'none',color:'var(--muted)',cursor:'pointer',fontSize:'inherit',fontFamily:'inherit'}} onClick={onBack}>← Plans DCA</button></div>
      <Stepper step={1}/>
      <div className="dca-card">
        <div className="dca-card-title">Paire <span className="dca-tag dca-tag-req">requis</span></div>
        <div className="dca-chip-grid">
          {pairs.map(p => <button key={p} className={`dca-chip${wizard.pair===p?' sel':''}`} onClick={()=>setWizard(w=>({...w,pair:p}))}>{p}</button>)}
          <button className={`dca-chip new-pair${wizard.pair==='NEW'?' sel':''}`} onClick={()=>setWizard(w=>({...w,pair:'NEW'}))}>+ Nouvelle paire</button>
        </div>
        {wizard.pair==='NEW' && <div className="dca-form-row" style={{marginBottom:0}}><div className="dca-form-group"><label>Nom</label><input className="dca-input" placeholder="ex: AVAX/USDT" value={wizard.customPair||''} onChange={e=>setWizard(w=>({...w,customPair:e.target.value}))}/></div></div>}
        {warn==='warn' && <div className="dca-banner dca-banner-warn" style={{marginTop:10}}>⚠️ ETH — avec précaution, volatilité plus élevée que BTC.</div>}
        {warn==='danger' && <div className="dca-banner dca-banner-danger" style={{marginTop:10}}>⛔ DCA gradué <b>fortement déconseillé</b> hors BTC (ETH avec précaution).</div>}
        {wizard.pair && wizard.pair!=='NEW' && <div className="dca-banner dca-banner-info" style={{marginTop:10}}><b>{wizard.pair}</b> — {opsCount} opération{opsCount!==1?'s':''} exécutée{opsCount!==1?'s':''} trouvée{opsCount!==1?'s':''}{wizard.startDate?` depuis le ${new Date(wizard.startDate).toLocaleDateString('fr-FR')}`:''}</div>}
      </div>
      <div className="dca-card">
        <div className="dca-card-title">Période</div>
        <div className="dca-form-row">
          <div className="dca-form-group"><label>Date de début <span style={{color:'var(--muted)',fontWeight:'normal'}}>(vide = 1ère op pointée)</span></label><input className="dca-input" type="date" value={wizard.startDate||''} onChange={e=>setWizard(w=>({...w,startDate:e.target.value}))}/></div>
          <div className="dca-form-group"><label>Date de fin <span style={{color:'var(--muted)',fontWeight:'normal'}}>(vide = aujourd'hui)</span></label><input className="dca-input" type="date" value={wizard.endDate||''} onChange={e=>setWizard(w=>({...w,endDate:e.target.value}))}/></div>
        </div>
      </div>
      <div className="dca-btm">
        <button className="dca-btn dca-btn-ghost" onClick={onBack}>← Retour</button>
        <span className="dca-step-hint">Étape 1 / 3</span>
        <button className="dca-btn dca-btn-primary" disabled={!wizard.pair||(wizard.pair==='NEW'&&!wizard.customPair)} onClick={onNext}>{opsCount>0?'Voir les opérations →':'Paramétrer →'}</button>
      </div>
    </div>
  )
}

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
    <div className="dca-scroll"><div style={{fontSize:'.58rem',color:'var(--muted)',paddingBottom:4}}><button className="dca-back-btn" style={{background:'none',border:'none',color:'var(--muted)',cursor:'pointer',fontSize:'inherit',fontFamily:'inherit'}} onClick={onBack}>← Plans DCA</button></div><Stepper step={2}/>
      <div className="dca-banner dca-banner-warn">Aucune opération exécutée pour <b>{effectivePair}</b>. Passage direct au paramétrage.</div>
      <div className="dca-btm"><button className="dca-btn dca-btn-ghost" onClick={onBack}>← Retour</button><button className="dca-btn dca-btn-primary" onClick={async()=>{ await onFlagOps?.(ops, pointed); onNext() }}>Paramétrer →</button></div>
    </div>
  )
  return (
    <div className="dca-scroll"><Stepper step={2}/>
      <div className="dca-card">
        <div className="dca-ops-header">
          <div><div className="dca-ops-title">{effectivePair} — Opérations exécutées</div><div className="dca-ops-meta">{ops.length} opérations · <b style={{color:'var(--green)'}}>{pointed.length} intégrées au DCA</b></div></div>
          <div className="dca-ops-btns"><button className="dca-ops-btn" onClick={()=>setAll(true)}>Tout cocher</button><button className="dca-ops-btn" onClick={()=>setAll(false)}>Tout décocher</button></div>
        </div>
        <div className="dca-banner dca-banner-info" style={{marginBottom:10}}>Toutes les opérations sont cochées par défaut. Décochez celles à exclure (ex: ventes de profit à ne pas comptabiliser dans le breakeven).</div>
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
      <div className="dca-btm"><button className="dca-btn dca-btn-ghost" onClick={onBack}>← Retour</button><span className="dca-step-hint">Étape 2 / 3</span><button className="dca-btn dca-btn-primary" onClick={async()=>{ await onFlagOps?.(ops, pointed); onNext() }}>Paramétrer →</button></div>
    </div>
  )
}

/* ─── Ligne tableau paramètre ────────────────────────────────────────────── */
function ParamRow({ row, colorArr, idx, refPrice, onChange, onDelete, showHint, unitLabel, valKey, ecartKey, placeholder, extraCell }) {
  const ecartNum   = parseFloat(String(row[ecartKey]||'').replace(/[^0-9\-\.]/g,''))
  const targetPrice = refPrice > 0 && !isNaN(ecartNum) ? refPrice * (1 + ecartNum / 100) : null
  const color      = (colorArr||[])[idx] || 'var(--muted)'
  return (
    <tr>
      <td><span className="dca-zdot" style={{background:color}}/></td>
      <td><input className="dca-pi" value={row.label||''} onChange={e=>onChange(idx,'label',e.target.value)} style={{width:80}}/></td>
      <td><input className="dca-pi" value={row[ecartKey]!=null?row[ecartKey]:''} onChange={e=>onChange(idx,ecartKey,e.target.value)} style={{width:80}} placeholder={placeholder}/></td>
      <td>
        <div className="dca-pi-group">
          <input className="dca-pi" type="number" min="0" step="any" value={row[valKey]!=null?row[valKey]:''} onChange={e=>onChange(idx,valKey,e.target.value===''?'':parseFloat(e.target.value)||0)} style={{width:70}}/>
          <span className="dca-pi-sfx">{unitLabel}</span>
        </div>
      </td>
      {showHint && <td><span className="dca-price-hint">{targetPrice?fmt(targetPrice):'—'}</span></td>}
      {extraCell}
      <td><button className="dca-del-btn" onClick={()=>onDelete(idx)}>×</button></td>
    </tr>
  )
}

/* ═══ STEP 3 — Paramétrage ════════════════════════════════════════════════ */
function Step3({ wizard, setWizard, rawRows, onNext, onBack, saving, templates, onSaveTpl, onLoadTpl }) {
  const [showConfirm, setShowConfirm] = useState(false)
  const effectivePair = wizard.pair==='NEW' ? (wizard.customPair||'') : wizard.pair
  const ops        = useMemo(() => filterOpsForPlan(rawRows, effectivePair, wizard.startDate, wizard.endDate), [rawRows, effectivePair, wizard.startDate, wizard.endDate])
  const pointedOps = useMemo(() => { const p=wizard.pointedOps||[]; return ops.filter((op,i)=>p.includes(getOpKey(op,i))) }, [ops, wizard.pointedOps])
  const breakeven  = computeBreakeven(pointedOps)
  const firstBuyDate = pointedOps.filter(o=>o.sens==='Achat'&&o.date).sort((a,b)=>a.date-b.date)[0]?.date?.toISOString().split('T')[0]
  const effectiveStartDate = wizard.startDate || firstBuyDate || ''

  const p = wizard.params || {}
  function setP(k,v) { setWizard(w=>({...w,params:{...(w.params||{}),[k]:v}})) }
  const accZones    = p.accZones    || DEFAULT_ACC_ZONES
  const debtZones   = p.debtZones   || DEFAULT_DEBT_ZONES
  const profitZones = p.profitZones || DEFAULT_PROFIT_ZONES

  function updateZone(arr, key, idx, field, val) { setP(key, arr.map((r,i)=>i===idx?{...r,[field]:val}:r)) }
  function deleteZone(arr, key, idx) { if(arr.length<=1) return; setP(key, arr.filter((_,i)=>i!==idx)) }
  function addZone(key, tmpl) { setP(key, [...(p[key]||[]), tmpl]) }

  // Validation profits
  const profitTotal    = profitZones.reduce((s, z) => s + (parseFloat(z.positionPct) || 0), 0)
  const profitHasEmpty = profitZones.some(z => z.positionPct === '' || z.positionPct == null)
  const profitOverflow = profitTotal > 100
  const profitPartial  = !profitHasEmpty && !profitOverflow && profitTotal < 100

  const canSubmit = accZones.length >= 1 && profitZones.length >= 1 && (p.baseAmount||0) > 0
    && !profitHasEmpty && !profitOverflow

  return (
    <div className="dca-scroll"><div style={{fontSize:'.58rem',color:'var(--muted)',paddingBottom:4}}><button className="dca-back-btn" style={{background:'none',border:'none',color:'var(--muted)',cursor:'pointer',fontSize:'inherit',fontFamily:'inherit'}} onClick={onBack}>← Plans DCA</button></div>
      <Stepper step={3}/>

      {/* ── Barre de templates ──────────────────────────────────── */}
      <div style={{display:'flex',alignItems:'center',gap:8,padding:'0 0 4px',flexWrap:'wrap'}}>
        <span style={{fontSize:'.58rem',color:'var(--muted)',flexShrink:0}}>Templates :</span>
        {templates?.length > 0 && templates.map(t => (
          <button key={t.id} className="dca-ops-btn"
            style={{fontSize:'.58rem',padding:'3px 10px'}}
            onClick={() => onLoadTpl?.(t)}
            title={`Charger : ${t.name}`}
          >
            {t.name}
          </button>
        ))}
        <button className="dca-ops-btn"
          style={{fontSize:'.58rem',padding:'3px 10px',marginLeft:'auto',borderColor:'var(--gold)',color:'var(--gold)'}}
          onClick={() => {
            const name = prompt('Nom du template :')
            if (name?.trim()) onSaveTpl?.(name.trim())
          }}
        >
          ✦ Enregistrer comme template
        </button>
      </div>

      {showConfirm && (
        <div style={{position:'fixed',inset:0,zIndex:9999,background:'rgba(0,0,0,0.75)',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div className="dca-card" style={{maxWidth:400,width:'100%'}}>
            <div className="dca-card-title">⚠️ Confirmer la création</div>
            <div style={{fontSize:'.68rem',color:'var(--text2)',lineHeight:1.7,marginBottom:16}}>
              Une fois créé, le <b style={{color:'var(--text)'}}>paramétrage ne sera plus modifiable</b>.<br/>
              Les zones, paliers et seuils seront verrouillés. Vous pourrez consulter le dashboard et ajouter des entrées au journal.<br/><br/>
              Voulez-vous continuer ?
            </div>
            <div style={{display:'flex',gap:10}}>
              <button className="dca-btn dca-btn-ghost" style={{flex:1}} onClick={()=>setShowConfirm(false)}>← Modifier</button>
              <button className="dca-btn dca-btn-success" style={{flex:1}} disabled={saving} onClick={()=>{ setShowConfirm(false); onNext() }}>{saving?'⏳ Sauvegarde…':'Créer ✓'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Base */}
      <div className="dca-card">
        <div className="dca-card-title">Paramètres de base</div>
        {effectiveStartDate && !wizard.startDate && (
          <div className="dca-banner dca-banner-info" style={{marginBottom:12}}>
            Pas de date renseignée — départ depuis la 1ère opération pointée : <b>{new Date(effectiveStartDate).toLocaleDateString('fr-FR')}</b>
          </div>
        )}
        <div className="dca-form-row">
          <div className="dca-form-group"><label>Montant de base *</label><div className="dca-input-group"><input className="dca-input" type="number" value={p.baseAmount??10} onChange={e=>setP('baseAmount',parseFloat(e.target.value)||0)}/><span className="dca-input-sfx">USDT</span></div></div>
          <div className="dca-form-group"><label>Fréquence *</label><select className="dca-select" value={p.frequency||'day'} onChange={e=>setP('frequency',e.target.value)}><option value="day">Tous les jours</option><option value="week">Toutes les semaines</option><option value="month">Tous les mois</option></select></div>
          <div className="dca-form-group"><label>Seuil bull run <span className="dca-tag dca-tag-opt">opt.</span></label><div className="dca-input-group"><input className="dca-input" type="number" value={p.bullThreshold??20} onChange={e=>setP('bullThreshold',parseFloat(e.target.value)||null)}/><span className="dca-input-sfx">%</span></div></div>
          <div className="dca-form-group"><label>Plafond rechargement <span className="dca-tag dca-tag-opt">opt.</span></label><div className="dca-input-group"><input className="dca-input" type="number" value={p.debtCeiling??300} onChange={e=>setP('debtCeiling',parseFloat(e.target.value)||null)}/><span className="dca-input-sfx">USDT</span></div></div>
        </div>
        {breakeven > 0 && <div style={{fontSize:'.6rem',color:'var(--muted)',marginTop:4}}>Breakeven des lignes pointées : <b style={{color:'var(--gold)'}}>{fmt(breakeven)}</b> · référence pour les prix cibles</div>}
      </div>

      {/* Accumulation */}
      <div className="dca-card">
        <div className="dca-card-title">Zones d'accumulation <span className="dca-tag dca-tag-req">min. 1 ligne</span></div>
        <div style={{fontSize:'.58rem',color:'var(--muted)',marginBottom:8}}>
          La Zone de base (≤ 0%) est fixe — elle couvre tous les prix en dessous du breakeven et utilise le montant de base.
          Ajoutez des zones supplémentaires pour les prix au-dessus.
        </div>
        <table className="dca-ptbl">
          <thead><tr><th/><th>Zone</th><th>Écart vs breakeven</th><th>Montant</th><th/></tr></thead>
          <tbody>
            {/* Ligne fixe Zone de base — non modifiable */}
            <tr style={{opacity:.75}}>
              <td><span className="dca-zdot" style={{background:'#3dbf90'}}/></td>
              <td><span style={{fontSize:'.65rem',color:'var(--text2)',fontFamily:"'Space Mono',monospace"}}>Zone de base</span></td>
              <td><span style={{fontSize:'.62rem',color:'var(--muted)',padding:'5px 8px',display:'block'}}>≤ 0% (fixe)</span></td>
              <td>
                <div className="dca-pi-group">
                  <input className="dca-pi" type="number" min="0" step="any"
                    value={p.baseAmount??10} disabled
                    style={{width:70,opacity:.6,cursor:'not-allowed'}}/>
                  <span className="dca-pi-sfx">USDT</span>
                </div>
              </td>
              <td/>
            </tr>
            {/* Zones supplémentaires éditables */}
            {accZones.map((r,i)=>(
              <ParamRow key={i} row={r} colorArr={ZONE_COLORS.acc.slice(1)} idx={i} refPrice={0}
                valKey="amount" ecartKey="ecartMin" unitLabel="USDT" showHint={false}
                placeholder="ex: 5 (pour 0% à 5%)"
                onChange={(idx,field,val)=>updateZone(accZones,'accZones',idx,field,val)}
                onDelete={idx=>deleteZone(accZones,'accZones',idx)}/>
            ))}
          </tbody>
        </table>
        <div className="dca-add-row" onClick={()=>addZone('accZones',{label:`Zone ${String.fromCharCode(66+accZones.length)}`,ecartMin:'',ecartMax:'',amount:5})}><div className="dca-add-ic">+</div> Ajouter une zone supplémentaire</div>
      </div>

      {/* Rechargement DCA */}
      <div className="dca-card">
        <div className="dca-card-title">Redistribution du rechargement DCA <span className="dca-tag dca-tag-opt">optionnel</span></div>
        <div style={{fontSize:'.6rem',color:'var(--text2)',marginBottom:10,lineHeight:1.6}}>Lorsque le cours plonge, déployer une partie du solde de rechargement accumulé pour renforcer la position.</div>
        <table className="dca-ptbl">
          <thead><tr><th/><th>Condition</th><th>Cours ≤ breakeven − (%)</th><th>% rechargement</th><th>Prix cible</th><th/></tr></thead>
          <tbody>
            {debtZones.map((r,i)=>(
              <ParamRow key={i} row={r} colorArr={ZONE_COLORS.debt} idx={i} refPrice={breakeven}
                valKey="debtPct" ecartKey="ecartThreshold" unitLabel="%" showHint={true}
                placeholder="-10"
                onChange={(idx,field,val)=>updateZone(debtZones,'debtZones',idx,field,val)}
                onDelete={idx=>deleteZone(debtZones,'debtZones',idx)}/>
            ))}
          </tbody>
        </table>
        <div className="dca-add-row" onClick={()=>addZone('debtZones',{label:'Signal',ecartThreshold:'-15',debtPct:75})}><div className="dca-add-ic">+</div> Ajouter un palier</div>
      </div>

      {/* Profits — colonnes séparées, warning si < 100 */}
      <div className="dca-card">
        <div className="dca-card-title">Paliers de prise de profits <span className="dca-tag dca-tag-req">min. 1 ligne</span></div>
        <div style={{fontSize:'.58rem',color:'var(--muted)',marginBottom:8}}>% position vendu &lt; 100 = prise de profit partielle (vous conservez la fraction restante).</div>
        <table className="dca-ptbl">
          <thead><tr><th/><th>Palier</th><th>Cours ≥ breakeven + (%)</th><th>% position vendu *</th><th>Prix cible</th><th/></tr></thead>
          <tbody>
            {profitZones.map((r,i) => {
              const isEmpty = r.positionPct === '' || r.positionPct == null
              const extraCell = isEmpty
                ? <td><span style={{fontSize:'.52rem',color:'var(--muted)'}}>requis</span></td>
                : <td/>
              return (
                <ParamRow key={i} row={r} colorArr={ZONE_COLORS.profit} idx={i} refPrice={breakeven}
                  valKey="positionPct" ecartKey="ecartThreshold" unitLabel="%" showHint={true}
                  placeholder="+25"
                  extraCell={extraCell}
                  onChange={(idx,field,val)=>updateZone(profitZones,'profitZones',idx,field,val)}
                  onDelete={idx=>deleteZone(profitZones,'profitZones',idx)}/>
              )
            })}
          </tbody>
        </table>
        {profitOverflow && (
          <div className="dca-banner dca-banner-danger" style={{marginTop:8}}>
            Total cumulé {profitTotal.toFixed(0)}% — dépasse 100%. Réduisez les pourcentages.
          </div>
        )}
        {profitPartial && (
          <div className="dca-banner dca-banner-warn" style={{marginTop:8}}>
            Profits partiels — {profitTotal.toFixed(0)}% de la position seront vendus au total. Vous conserverez {(100 - profitTotal).toFixed(0)}% de votre position après tous les paliers.
          </div>
        )}
        <div className="dca-add-row" onClick={()=>addZone('profitZones',{label:`Palier ${profitZones.length+1}`,ecartThreshold:'',positionPct:''})}><div className="dca-add-ic">+</div> Ajouter un palier</div>
      </div>

      <div className="dca-btm">
        <button className="dca-btn dca-btn-ghost" onClick={onBack}>← Retour</button>
        <span className="dca-step-hint">Étape 3 / 3</span>
        <button className="dca-btn dca-btn-success" disabled={!canSubmit||saving} onClick={()=>setShowConfirm(true)}>
          Créer le plan DCA ✓
        </button>
      </div>
    </div>
  )
}

/* ═══ DASHBOARD ═══════════════════════════════════════════════════════════ */
function DcaDashboard({ plan, rawRows, prices, onBack, onRefresh }) {
  const [showCal,      setShowCal]      = useState(false)
  const [showEntry,    setShowEntry]    = useState(false)   // achat normal
  const [savedMsg,     setSavedMsg]     = useState('')
  const [manualPrice,  setManualPrice]  = useState('')

  const effectivePair = plan.pair || ''
  const ops = useMemo(() => filterOpsForPlan(rawRows, effectivePair, plan.startDate, plan.endDate), [rawRows, effectivePair, plan.startDate, plan.endDate])
  const pointed    = plan.pointedOps || []
  // Inclut ops du plan.pointedOps + ops ajoutées via boutons DCA (flaggées dans notes)
  const pointedOps = useMemo(() => ops.filter((op, i) =>
    pointed.includes(getOpKey(op, i)) ||
    (op.notes && op.notes.includes('[DCA]'))
  ), [ops, pointed])

  const breakeven     = computeBreakeven(pointedOps)
  const rechargement  = computeRechargement(plan, pointedOps)

  const currentPrice  = prices[effectivePair] || (manualPrice ? parseFloat(manualPrice) : null)
  const signal        = useMemo(() => computeSignal(plan, currentPrice, breakeven, rechargement), [plan, currentPrice, breakeven, rechargement])
  const delta         = currentPrice && breakeven ? (currentPrice - breakeven) / breakeven * 100 : null

  // KPIs
  const buys          = pointedOps.filter(o=>o.sens==='Achat')
  const sells         = pointedOps.filter(o=>o.sens==='Vente')
  const totalInvested = buys.reduce((s,o)=>s+o.usdt,0)
  const position      = buys.reduce((s,o)=>s+(o.vol||0),0) - sells.reduce((s,o)=>s+(o.vol||0),0)
  const pnlLatent     = currentPrice && position>0 && breakeven>0 ? position*(currentPrice-breakeven) : 0

  // Cycle en cours
  const cyclePeriod   = getCurrentPeriodOps(plan, pointedOps)
  const freqLabel     = PERIOD_LABEL[plan.frequency||'day'] || 'jour'

  // Timeline
  const timeline = useMemo(() => generateTimeline(plan, pointedOps, 15), [plan, pointedOps])
  const missedCount = timeline.filter(t=>t.type==='missed').length

  // Calendrier
  const calDays = useMemo(() => {
    const now=new Date(), y=now.getFullYear(), m=now.getMonth()
    const first=new Date(y,m,1), last=new Date(y,m+1,0)
    const days=[]
    const startDow=(first.getDay()+6)%7
    for(let i=0;i<startDow;i++) days.push(null)
    for(let d=1;d<=last.getDate();d++) {
      const day=new Date(y,m,d)
      const slot=timeline.find(t=>t.date&&t.date.toDateString()===day.toDateString())
      days.push({day:d,slot,isToday:d===now.getDate()})
    }
    return days
  }, [timeline])

  // Zone bar
  const bull=plan.bullThreshold||20, MIN_D=-25, MAX_D=bull*1.5
  const needlePct=delta!=null?Math.min(98,Math.max(2,(delta-MIN_D)/(MAX_D-MIN_D)*100)):50

  function signalClass() {
    if (signal.zone==='PROFIT') return 'profit'
    if (signal.zone==='RECHARGE'||signal.zone==='FORCE') return 'debt'
    if (signal.deployAmount>=(plan.baseAmount||10)) return 'buy'
    if (signal.deployAmount>0) return 'buy50'
    return 'hold'
  }

  function tlClass(slot) {
    if (!slot||slot.type==='missed') return 'tc-sk'
    if (slot.type==='sell') return 'tc-sl'
    if (slot.type==='future') return 'tc-sk'
    if (slot.pct>=90) return 'tc-100'
    if (slot.pct>=65) return 'tc-75'
    if (slot.pct>=40) return 'tc-50'
    return 'tc-25'
  }
  function tlLabel(slot) {
    if (!slot||slot.type==='future') return '·'
    if (slot.type==='missed') return '–'
    if (slot.type==='sell')   return '↓'
    return '●'
  }
  function tlTip(slot) {
    if (!slot||slot.type==='future') return 'Période future'
    const d=slot.date?.toLocaleDateString('fr-FR')||'—'
    if (slot.type==='missed') return `${d} : Manqué (−${plan.baseAmount} USDT rechargement)`
    if (slot.type==='sell')   return `${d} : Vente`
    return `${d} : Acheté ${slot.amount?.toFixed(2)||'?'} USDT (${slot.pct||0}%)`
  }

  const profitZones = plan.profitZones || DEFAULT_PROFIT_ZONES
  const debtZones   = plan.debtZones   || []

  function onSaved() {
    setShowEntry(false)
    setSavedMsg('✓ Achat enregistré au journal — données mises à jour.')
    setTimeout(()=>setSavedMsg(''), 4000)
    onRefresh?.()
  }

  return (
    <div className="dca-scroll">

      {savedMsg && <div className="dca-banner dca-banner-success">{savedMsg}</div>}

      {/* ── Hero : plan info + prix + zone bar ────────────────────────────── */}
      <div className="dca-hero">

        {/* En-tête plan compact + retour liste */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12,flexWrap:'wrap',gap:8}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <button className="dca-back-btn" onClick={onBack} style={{padding:'3px 8px',border:'0.5px solid var(--border)',borderRadius:6,fontSize:'.58rem'}}>
              ← Plans
            </button>
            <span style={{fontFamily:"'Space Mono',monospace",fontWeight:'700',fontSize:'.78rem',color:'var(--text)'}}>
              {effectivePair}
            </span>
            <span style={{fontSize:'.56rem',color:'var(--muted)'}}>
              {plan.baseAmount} USDT/{freqLabel}
              {plan.startDate ? ` · depuis ${new Date(plan.startDate).toLocaleDateString('fr-FR')}` : ''}
              {' · '}{buys.length} achats
            </span>
          </div>
          <div style={{fontSize:'.52rem',color:'var(--green)'}}>● Actif</div>
        </div>

        {/* Prix */}
        <div className="dca-hero-prices">
          <div className="dca-hero-block">
            <div className="dca-hero-lbl">Breakeven</div>
            <div className="dca-hero-val dca-hero-val-main">{breakeven>0?fmt(breakeven):'—'}</div>
            <div className="dca-hero-sub">coût de revient net</div>
          </div>
          <div className="dca-hero-sep"/>
          <div className="dca-hero-delta">
            {delta!=null?(<>
              <div className={`dca-hero-delta-arrow ${delta<0?'down':'up'}`}>{delta<0?'↓':'↑'}</div>
              <div className={`dca-hero-delta-pct ${delta<0?'down':'up'}`}>{pct(delta)}</div>
              <div className="dca-hero-delta-lbl">cours vs breakeven</div>
            </>):(
              <div style={{textAlign:'center'}}>
                <div style={{fontSize:'.5rem',color:'var(--muted)',marginBottom:4}}>Cours introuvable</div>
                <input className="dca-input" type="number" placeholder="Saisir le cours ($)" value={manualPrice} onChange={e=>setManualPrice(e.target.value)} style={{width:120,textAlign:'center',fontSize:'.6rem'}}/>
              </div>
            )}
          </div>
          <div className="dca-hero-sep"/>
          <div className="dca-hero-block">
            <div className="dca-hero-lbl">Cours actuel</div>
            <div className="dca-hero-val">{currentPrice?fmt(currentPrice):'—'}</div>
            <div className="dca-hero-sub">{prices[effectivePair]?'live':'saisie manuelle'}</div>
          </div>
        </div>

        {/* Zone bar */}
        <div className="dca-zone-bar-wrap" style={{marginTop:14}}>
          <div className="dca-zone-bar">
            <div className="dca-zone-seg z4">100%</div><div className="dca-zone-seg z3">75%</div>
            <div className="dca-zone-seg z2">50%</div><div className="dca-zone-seg z1">25%</div>
            <div className="dca-zone-seg z0">Vente</div>
            <div className="dca-zone-needle" style={{left:`${needlePct}%`}}/>
          </div>
          <div className="dca-zone-labels"><span>&lt; 0%</span><span>0–5%</span><span>5–10%</span><span>10–{bull}%</span><span>&gt; {bull}%</span></div>
        </div>
      </div>

      {/* ── Signal du cycle ────────────────────────────────────────────────── */}
      <div className={`dca-signal ${signalClass()}`}>
        {/* Ligne 1 : titre + montant */}
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12}}>
          <div>
            <div className="dca-signal-title">{signal.label}</div>
            <div className="dca-signal-desc" style={{marginTop:4}}>{signal.description}</div>
          </div>
          <div className="dca-signal-amount" style={{textAlign:'right',flexShrink:0}}>
            {signal.action==='sell'?(<>
              <div className="dca-signal-amt">Vendre {signal.sellPct}%</div>
              <div className="dca-signal-amt-lbl">de la position</div>
            </>):(<>
              <div className="dca-signal-amt">{signal.deployAmount>0?`${signal.deployAmount.toFixed(2)} USDT`:'—'}</div>
              <div className="dca-signal-amt-lbl">
                {signal.deployAmount>0
                  ? `à investir · cycle du ${cyclePeriod.periodStart?.toLocaleDateString('fr-FR')||'—'}`
                  : 'aucune action ce cycle'}
              </div>
            </>)}
          </div>
        </div>

        {/* Ligne 2 : stats cycle + bouton */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:10,paddingTop:8,borderTop:'1px solid rgba(255,255,255,.08)',flexWrap:'wrap',gap:8}}>
          <div style={{display:'flex',gap:16,fontSize:'.6rem',flexWrap:'wrap'}}>
            <span>
              <span style={{opacity:.7}}>Achats ce {freqLabel} : </span>
              <b>{cyclePeriod.totalBought>0?`$${cyclePeriod.totalBought.toFixed(2)}`:'—'}</b>
            </span>
            <span>
              <span style={{opacity:.7}}>Ventes : </span>
              <b>{cyclePeriod.totalSold>0?`$${cyclePeriod.totalSold.toFixed(2)}`:'—'}</b>
            </span>
            {signal.deployAmount>0&&signal.action!=='sell'&&(
              <span>
                <span style={{opacity:.7}}>Reste : </span>
                <b>${Math.max(0,signal.deployAmount-cyclePeriod.totalBought).toFixed(2)}</b>
              </span>
            )}
          </div>
          {signal.action !== 'sell' && (
            <button
              className="dca-btn dca-btn-primary"
              style={{fontSize:'.6rem',padding:'5px 12px',whiteSpace:'nowrap'}}
              onClick={()=>setShowEntry(true)}
            >
              + Ajouter au journal
            </button>
          )}
        </div>
      </div>

      {/* ── KPIs ──────────────────────────────────────────────────────────── */}
      <div className="dca-kpi-grid">
        <div className="dca-kpi">
          <div className="dca-kpi-val">{totalInvested>0?fmt(totalInvested,2):'—'}</div>
          <div className="dca-kpi-lbl">Total investi</div>
          <div className="dca-kpi-sub">{buys.length} opérations pointées</div>
        </div>

        {/* Solde de rechargement */}
        <div className="dca-kpi" title={`Solde = Σ(${plan.baseAmount} USDT − injecté) par cycle. Positif = capital disponible à redéployer. Négatif = sur-investissement cumulé.`}>
          <div className="dca-kpi-val" style={{color:rechargement.total>0?'var(--gold)':rechargement.total<0?'var(--green)':'var(--muted)'}}>
            {rechargement.total>=0?'+':''}{rechargement.total.toFixed(0)} USDT
          </div>
          <div className="dca-kpi-lbl">Solde rechargement ⓘ</div>
          <div className="dca-kpi-sub">
            {rechargement.missed} cycle{rechargement.missed!==1?'s':''} incomplet{rechargement.missed!==1?'s':''}
          </div>
        </div>

        <div className="dca-kpi">
          <div className="dca-kpi-val" style={{color:pnlLatent>=0?'var(--green)':'var(--red)'}}>
            {pnlLatent!==0?(pnlLatent>=0?'+':'')+fmt(pnlLatent,2):'—'}
          </div>
          <div className="dca-kpi-lbl">PnL latent</div>
          <div className="dca-kpi-sub">{delta!=null?pct(delta)+' vs breakeven':'cours manquant'}</div>
        </div>
      </div>

      {/* ── Paliers ───────────────────────────────────────────────────────── */}
      <div className="dca-two-col">
        {debtZones.length>0 && (
          <div className="dca-card">
            <div className="dca-card-title">Redistribution rechargement DCA</div>
            {debtZones.map((z,i)=>{
              const tp=breakeven>0?breakeven*(1+(parseFloat(z.ecartThreshold)||0)/100):null
              const active=delta!=null&&delta<=(parseFloat(z.ecartThreshold)||0)
              return (<div key={i} className={`dca-pal-row${active?' active-debt':''}`}>
                <span className="dca-zdot" style={{background:ZONE_COLORS.debt[i]||'#378ADD'}}/>
                <span className="dca-pal-lbl">{z.label} · <b>{z.ecartThreshold}%</b></span>
                <span className="dca-pal-price">{tp?fmt(tp):'—'}</span>
                <span className="dca-pal-action">{active?'⚡ ':''}{z.debtPct}% rech.</span>
              </div>)
            })}
          </div>
        )}
        <div className="dca-card">
          <div className="dca-card-title">Paliers de profits</div>
          {profitZones.map((z,i)=>{
            const tp=breakeven>0?breakeven*(1+(parseFloat(z.ecartThreshold)||0)/100):null
            const active=delta!=null&&delta>=(parseFloat(z.ecartThreshold)||0)
            return (<div key={i} className={`dca-pal-row${active?' active-profit':''}`}>
              <span className="dca-zdot" style={{background:ZONE_COLORS.profit[i]||'#E24B4A'}}/>
              <span className="dca-pal-lbl">{z.label} · <b>+{z.ecartThreshold}%</b></span>
              <span className="dca-pal-price">{tp?fmt(tp):'—'}</span>
              <span className="dca-pal-action">{active?'✓ ':''}{z.positionPct}%
                {z.positionPct && parseFloat(z.positionPct)<100 && <span style={{fontSize:'.52rem',color:'var(--gold)',marginLeft:3}}>partiel</span>}
              </span>
            </div>)
          })}
        </div>
      </div>

      {/* ── Timeline ─────────────────────────────────────────────────────── */}
      <div className="dca-card">
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
          <div className="dca-card-title" style={{marginBottom:0}}>
            {timeline.length} dernières périodes
            {missedCount>0&&<span style={{fontSize:'.56rem',color:'var(--gold)',marginLeft:8,fontWeight:'normal'}}>· {missedCount} manquée{missedCount!==1?'s':''}</span>}
          </div>
        </div>
        <div className="dca-tl-legend">
          <span><span className="dca-tl-leg-dot" style={{background:'rgba(61,191,144,.35)'}}/>100%</span>
          <span><span className="dca-tl-leg-dot" style={{background:'rgba(61,191,144,.2)'}}/>75%</span>
          <span><span className="dca-tl-leg-dot" style={{background:'rgba(200,160,32,.22)'}}/>50%</span>
          <span><span className="dca-tl-leg-dot" style={{background:'rgba(200,160,32,.38)'}}/>25%</span>
          <span><span className="dca-tl-leg-dot" style={{background:'rgba(212,90,80,.22)'}}/>Vente</span>
          <span><span className="dca-tl-leg-dot" style={{background:'var(--bg3)',border:'1px solid var(--border)'}}/>Manqué</span>
        </div>
        <div className="dca-tl">
          {timeline.map((slot,i)=>(
            <div key={i} className={`dca-tc ${tlClass(slot)}${i===timeline.length-1?' tc-today':''}`} data-tip={tlTip(slot)}>
              {tlLabel(slot)}
            </div>
          ))}
          {Array.from({length:Math.max(0,15-timeline.length)}).map((_,i)=>(
            <div key={`e${i}`} className="dca-tc tc-sk" data-tip="Aucune donnée">·</div>
          ))}
        </div>

        {/* Toggle calendrier */}
        <div className="dca-add-row" style={{cursor:'pointer',userSelect:'none'}} onClick={()=>setShowCal(v=>!v)}>
          <span style={{fontSize:'.75rem'}}>📅</span>
          <span>{showCal?'Masquer le calendrier':'Afficher le calendrier mensuel'}</span>
        </div>

        {showCal && (
          <div style={{marginTop:10}}>
            <div style={{fontSize:'.58rem',fontWeight:'500',color:'var(--text2)',marginBottom:6}}>
              {new Date().toLocaleDateString('fr-FR',{month:'long',year:'numeric'})}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2,marginBottom:4}}>
              {['L','M','M','J','V','S','D'].map((d,i)=><div key={i} style={{textAlign:'center',fontSize:'.48rem',color:'var(--muted)',fontWeight:'500'}}>{d}</div>)}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2}}>
              {calDays.map((cell,i)=>{
                if(!cell) return <div key={i}/>
                const cls=cell.slot?tlClass(cell.slot):'tc-sk'
                return <div key={i} className={`dca-tc ${cls}${cell.isToday?' tc-today':''}`} style={{aspectRatio:'1',fontSize:'.55rem'}}>{cell.day}</div>
              })}
            </div>
          </div>
        )}

        <div style={{fontSize:'.56rem',color:'var(--muted)',marginTop:8,borderTop:'1px solid var(--border)',paddingTop:8}}>
          {buys.length} achats · {sells.length} ventes · {missedCount} cycle{missedCount!==1?'s':''} incomplet{missedCount!==1?'s':''} · Solde rechargement : ${rechargement.total.toFixed(0)}
        </div>
      </div>

      <div style={{height:16}}/>

      {showEntry && (
        <EntryForm
          onClose={()=>setShowEntry(false)}
          onSaved={onSaved}
          defaultPaire={effectivePair}
          flagDca={true}
        />
      )}
    </div>
  )
}

/* ═══ Orchestrateur ═══════════════════════════════════════════════════════ */
export default function DcaView({ pairList = [], rawRows = [], prices = {}, onRefresh }) {
  const [screen, setScreen]         = useState('list')
  const [plans, setPlans]           = useState([])
  const [templates, setTemplates]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [currentPlan, setCurrentPlan] = useState(null)

  const INIT_WIZARD = () => ({
    pair: pairList[0]?.name||'', customPair:'', startDate:'', endDate:'',
    pointedOps: undefined,
    params: { baseAmount:10, frequency:'day', bullThreshold:20, debtCeiling:300, accZones:[...DEFAULT_ACC_ZONES], debtZones:[...DEFAULT_DEBT_ZONES], profitZones:[...DEFAULT_PROFIT_ZONES] }
  })
  const [wizard, setWizard] = useState(INIT_WIZARD)

  useEffect(() => {
    Promise.all([getDcaPlans(), getDcaTemplates()])
      .then(([p, t]) => { setPlans(p); setTemplates(t) })
      .catch(console.error)
      .finally(()=>setLoading(false))
  }, [])

  function openPlan(plan) { setCurrentPlan(plan); setScreen('dashboard') }

  function startNewWizard() { setWizard(INIT_WIZARD()); setCurrentPlan(null); setScreen(1) }

  async function deletePlan(id) { await deleteDcaPlan(id); setPlans(p=>p.filter(x=>x.id!==id)) }

  async function saveTemplate(name) {
    const p = wizard.params || {}
    const tpl = {
      name,
      baseAmount:   p.baseAmount ?? 10,
      frequency:    p.frequency  ?? 'day',
      bullThreshold:p.bullThreshold ?? 20,
      debtCeiling:  p.debtCeiling  ?? 300,
      accZones:     p.accZones   || DEFAULT_ACC_ZONES,
      debtZones:    p.debtZones  || DEFAULT_DEBT_ZONES,
      profitZones:  p.profitZones|| DEFAULT_PROFIT_ZONES,
    }
    const id = await saveDcaTemplate(tpl)
    setTemplates(prev => { const ex=prev.find(t=>t.id===id); return ex?prev.map(t=>t.id===id?{...tpl,id}:t):[...prev,{...tpl,id}] })
  }

  async function deleteTemplate(id) {
    await deleteDcaTemplate(id)
    setTemplates(prev => prev.filter(t=>t.id!==id))
  }

  function loadTemplate(tpl) {
    setWizard(w => ({
      ...w,
      params: {
        baseAmount:   tpl.baseAmount,
        frequency:    tpl.frequency,
        bullThreshold:tpl.bullThreshold,
        debtCeiling:  tpl.debtCeiling,
        accZones:     tpl.accZones   || DEFAULT_ACC_ZONES,
        debtZones:    tpl.debtZones  || DEFAULT_DEBT_ZONES,
        profitZones:  tpl.profitZones|| DEFAULT_PROFIT_ZONES,
      }
    }))
  }

  function step1Next() {
    const pair = wizard.pair==='NEW' ? wizard.customPair : wizard.pair
    const hasOps = rawRows.some(r=>r.pair===pair&&r.exec)
    setScreen(hasOps ? 2 : 3)
  }

  // Marquer toutes les ops pointées avec [DCA] dans les notes du journal
  async function step2FlagOps(ops, pointed) {
    try {
      const snap = await loadSnapshot()
      if (!snap?.rows) return
      const rows = snap.rows
      // Pour chaque op pointée, ajouter [DCA] dans notes si absent
      for (let i = 0; i < ops.length; i++) {
        const key = getOpKey(ops[i], i)
        if (!pointed.includes(key)) continue
        // Trouver la ligne correspondante dans le snapshot par date+paire+montant
        const op = ops[i]
        const rowIdx = rows.findIndex((r, ri) => {
          if (ri === 0) return false // skip header
          const d = r[0], p = r[1], u = r[5]
          const dateMatch = d && op.date && Math.abs(new Date(String(d)).getTime() - op.date.getTime()) < 86400000
          const pairMatch = String(p||'').trim() === op.pair
          const amtMatch  = Math.abs((parseFloat(u)||0) - op.usdt) < 0.01
          return dateMatch && pairMatch && amtMatch
        })
        if (rowIdx < 0) continue
        const row = [...rows[rowIdx]]
        while (row.length <= 12) row.push('')
        const notes = String(row[11] || '')
        if (!notes.includes('[DCA]')) {
          row[11] = notes ? notes + ' [DCA]' : '[DCA]'
          await updateRow(rowIdx, row)
        }
      }
    } catch(e) {
      console.warn('step2FlagOps error:', e)
    }
  }

  async function step3Save() {
    setSaving(true)
    try {
      const pair = wizard.pair==='NEW' ? wizard.customPair : wizard.pair
      const ops  = filterOpsForPlan(rawRows, pair, wizard.startDate, wizard.endDate)
      const p    = wizard.pointedOps||[]
      const pOps = ops.filter((op,i)=>p.includes(getOpKey(op,i)))
      const firstDate = pOps.filter(o=>o.sens==='Achat'&&o.date).sort((a,b)=>a.date-b.date)[0]?.date
      const startDate = wizard.startDate || (firstDate?firstDate.toISOString().split('T')[0]:'')
      const planData = {
        id: currentPlan?.id||null, pair, startDate, endDate: wizard.endDate||null,
        pointedOps: p,
        baseAmount:   wizard.params?.baseAmount??10,
        frequency:    wizard.params?.frequency??'day',
        bullThreshold:wizard.params?.bullThreshold??20,
        debtCeiling:  wizard.params?.debtCeiling??300,
        accZones:     wizard.params?.accZones||DEFAULT_ACC_ZONES,
        debtZones:    wizard.params?.debtZones||DEFAULT_DEBT_ZONES,
        profitZones:  wizard.params?.profitZones||DEFAULT_PROFIT_ZONES,
      }
      const id   = await saveDcaPlan(planData)
      const saved = {...planData, id}
      setCurrentPlan(saved)
      setPlans(prev => { const ex=prev.find(x=>x.id===id); return ex?prev.map(x=>x.id===id?saved:x):[...prev,saved] })
      setScreen('dashboard')
    } catch(e) { alert('Erreur : '+e.message) }
    finally { setSaving(false) }
  }

  const activePair = screen==='dashboard'&&currentPlan ? currentPlan.pair : (wizard.pair==='NEW'?wizard.customPair:wizard.pair)

  return (
    <div className="dca-page">

      {screen==='list'      && <DcaList plans={plans} loading={loading} onNew={startNewWizard} onOpen={openPlan} onDelete={deletePlan} templates={templates} onDeleteTpl={deleteTemplate}/>}
      {screen===1           && <Step1 wizard={wizard} setWizard={setWizard} pairList={pairList} rawRows={rawRows} onNext={step1Next} onBack={()=>setScreen('list')}/>}
      {screen===2           && <Step2 wizard={wizard} setWizard={setWizard} rawRows={rawRows} onNext={()=>setScreen(3)} onBack={()=>setScreen(1)} onFlagOps={step2FlagOps}/>}
      {screen===3           && <Step3 wizard={wizard} setWizard={setWizard} rawRows={rawRows} onNext={step3Save} onBack={()=>setScreen(2)} saving={saving} templates={templates} onSaveTpl={saveTemplate} onLoadTpl={loadTemplate}/>}
      {screen==='dashboard' && currentPlan && <DcaDashboard plan={currentPlan} rawRows={rawRows} prices={prices} onBack={()=>setScreen('list')} onRefresh={onRefresh}/>}
    </div>
  )
}
