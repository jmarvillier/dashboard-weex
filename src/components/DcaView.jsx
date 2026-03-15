/**
 * DcaView.jsx — v2
 * Corrections : breakeven, dette, paliers, timeline, stepper, wizard création seule
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import '../styles/dca.css'
import { getDcaPlans, saveDcaPlan, deleteDcaPlan } from '../lib/dcaRepository.js'
import { computeBreakeven, computeAvgPrice, computeDebt, computeSignal, generateTimeline, getEffectiveStart } from '../hooks/useDcaStrategy.js'
import EntryForm from './EntryForm.jsx'

/* ── Valeurs BTC par défaut ──────────────────────────────────────────────── */
const DEFAULT_ACC_ZONES = [
  { label: 'Zone A', ecartMin: -Infinity, ecartMax: 0,   amount: 10  },
  { label: 'Zone B', ecartMin: 0,         ecartMax: 5,   amount: 7.5 },
  { label: 'Zone C', ecartMin: 5,         ecartMax: 10,  amount: 5   },
  { label: 'Zone D', ecartMin: 10,        ecartMax: 20,  amount: 2.5 },
]
const DEFAULT_DEBT_ZONES = [
  { label: 'Signal fort',    ecartThreshold: -10, debtPct: 50  },
  { label: 'Signal extrême', ecartThreshold: -20, debtPct: 100 },
]
const DEFAULT_PROFIT_ZONES = [
  { label: 'Palier 1', ecartThreshold: 20,  positionPct: 25  },
  { label: 'Palier 2', ecartThreshold: 50,  positionPct: 50  },
  { label: 'Palier 3', ecartThreshold: 100, positionPct: 75  },
  { label: 'Palier 4', ecartThreshold: 200, positionPct: 100 },
  { label: 'Palier 5', ecartThreshold: 400, positionPct: 100 },
]
const ZONE_COLORS = {
  acc:    ['#3dbf90','#2a9d70','#c8a020','#d4720a','#b85808'],
  debt:   ['#85B7EB','#378ADD'],
  profit: ['#F7C1C1','#F09595','#E24B4A','#A32D2D','#501313'],
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function fmt(v, decimals = 0) {
  if (v == null || isNaN(v)) return '—'
  return '$' + Number(v).toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}
function pct(v) { return v == null ? '—' : (v >= 0 ? '+' : '') + v.toFixed(2) + '%' }

function filterOpsForPlan(rawRows, pair, startDate, endDate) {
  if (!rawRows || !rawRows.length || !pair) return []
  const start = startDate ? new Date(startDate) : null
  const end   = endDate   ? new Date(endDate)   : new Date()
  return rawRows.filter(r => {
    if (!r.exec) return false
    if (r.pair !== pair) return false
    if (start && r.date && r.date < start) return false
    if (end   && r.date && r.date > end)   return false
    return true
  })
}

function getOpKey(op, idx) { return `${op.date?.toISOString?.() || idx}_${idx}` }

/* ── Stepper (uniquement wizard création) ────────────────────────────────── */
function Stepper({ step }) {
  const steps = [['Paire','& période'],['Pointage','opérations'],['Paramètres','stratégie']]
  return (
    <div className="dca-stepper">
      {steps.map(([label, sub], i) => {
        const done   = i + 1 < step
        const active = i + 1 === step
        return (
          <>
            <div key={i} className={`dca-step${active?' active':done?' done':''}`}>
              <div className="dca-step-circle">{done ? '✓' : i + 1}</div>
              <div className="dca-step-text">{label}<br/>{sub}</div>
            </div>
            {i < steps.length - 1 && <div key={`l${i}`} className={`dca-step-line${done?' done':''}`}/>}
          </>
        )
      })}
    </div>
  )
}

/* ═══ SCREEN 0 — Liste des plans ══════════════════════════════════════════ */
function DcaList({ onNew, onOpen, plans, loading, onDelete }) {
  const [confirm, setConfirm] = useState(null)

  function iconClass(pair='') {
    if (pair.startsWith('BTC')) return 'dca-plan-icon dca-plan-icon-btc'
    if (pair.startsWith('ETH')) return 'dca-plan-icon dca-plan-icon-eth'
    return 'dca-plan-icon dca-plan-icon-def'
  }

  return (
    <div className="dca-scroll">
      <div className="dca-list-header">
        <div>
          <div className="dca-list-title">Scaled Mirror DCA</div>
          <div className="dca-list-sub">Plans actifs · accumulation graduée + distribution</div>
        </div>
        <button className="dca-btn dca-btn-primary" onClick={onNew}>+ Nouveau plan</button>
      </div>

      {loading && <div className="dca-banner dca-banner-info">Chargement des plans…</div>}

      {!loading && plans.length === 0 && (
        <div className="dca-empty-zone" onClick={onNew}>
          + Aucun plan DCA — cliquez pour en créer un
        </div>
      )}

      {plans.map(plan => (
        <div key={plan.id} className="dca-plan-item" onClick={() => onOpen(plan)}>
          <div className={iconClass(plan.pair)}>{(plan.pair||'').split('/')[0].slice(0,3)}</div>
          <div className="dca-plan-info">
            <div className="dca-plan-pair">{plan.pair}</div>
            <div className="dca-plan-meta">
              {plan.baseAmount} USDT/{plan.frequency==='day'?'jour':plan.frequency==='week'?'sem.':'mois'}
              {plan.startDate ? ` · depuis ${new Date(plan.startDate).toLocaleDateString('fr-FR')}` : ''}
            </div>
          </div>
          <div className="dca-plan-right">
            <div className="dca-plan-status dca-status-acc">Accumulation</div>
          </div>
          <button className="dca-plan-del-btn" onClick={e => { e.stopPropagation(); setConfirm(plan.id) }}>✕</button>
        </div>
      ))}

      {confirm && (
        <div className="dca-banner dca-banner-danger" style={{marginTop:8}}>
          Supprimer ce plan ? Les lignes du journal <b>ne seront pas modifiées</b>.{' '}
          <button className="dca-btn" style={{marginLeft:8,padding:'3px 10px',fontSize:'.6rem'}} onClick={async()=>{ await onDelete(confirm); setConfirm(null) }}>Confirmer</button>
          <button className="dca-btn dca-btn-ghost" style={{marginLeft:4,padding:'3px 8px',fontSize:'.6rem'}} onClick={()=>setConfirm(null)}>Annuler</button>
        </div>
      )}

      <div className="dca-banner dca-banner-info" style={{marginTop:8}}>
        La suppression d'un plan efface uniquement la configuration DCA — les lignes du journal ne sont pas modifiées.
      </div>
    </div>
  )
}

/* ═══ STEP 1 — Paire & Période ════════════════════════════════════════════ */
function Step1({ wizard, setWizard, pairList, rawRows, onNext, onBack }) {
  const pairs    = pairList.map(p => p.name).filter(n => !n.startsWith('USD'))
  const effectivePair = wizard.pair === 'NEW' ? (wizard.customPair || '') : wizard.pair
  const opsCount = useMemo(() => filterOpsForPlan(rawRows, effectivePair, wizard.startDate, wizard.endDate).length, [rawRows, effectivePair, wizard.startDate, wizard.endDate])

  function warnLevel(pair) {
    if (!pair || pair === 'NEW') return null
    if (pair.startsWith('BTC')) return null
    if (pair.startsWith('ETH')) return 'warn'
    return 'danger'
  }
  const warn = warnLevel(wizard.pair)

  return (
    <div className="dca-scroll">
      <Stepper step={1}/>
      <div className="dca-card">
        <div className="dca-card-title">Paire <span className="dca-tag dca-tag-req">requis</span></div>
        <div className="dca-chip-grid">
          {pairs.map(p => (
            <button key={p} className={`dca-chip${wizard.pair===p?' sel':''}`} onClick={()=>setWizard(w=>({...w,pair:p}))}>
              {p}
            </button>
          ))}
          <button className={`dca-chip new-pair${wizard.pair==='NEW'?' sel':''}`} onClick={()=>setWizard(w=>({...w,pair:'NEW'}))}>+ Nouvelle paire</button>
        </div>

        {wizard.pair==='NEW' && (
          <div className="dca-form-row" style={{marginBottom:0}}>
            <div className="dca-form-group">
              <label>Nom de la paire</label>
              <input className="dca-input" placeholder="ex: AVAX/USDT" value={wizard.customPair||''} onChange={e=>setWizard(w=>({...w,customPair:e.target.value}))}/>
            </div>
          </div>
        )}

        {warn==='warn' && <div className="dca-banner dca-banner-warn" style={{marginTop:10}}>⚠️ ETH peut être intégré avec prudence — volatilité plus élevée que BTC. Adaptez vos paliers.</div>}
        {warn==='danger' && <div className="dca-banner dca-banner-danger" style={{marginTop:10}}>⛔ Le DCA gradué est <b>fortement déconseillé</b> sur les altcoins hors BTC. Seul BTC (et ETH avec précaution) sont adaptés.</div>}

        {wizard.pair && wizard.pair!=='NEW' && (
          <div className="dca-banner dca-banner-info" style={{marginTop:10}}>
            <b>{wizard.pair}</b> — {opsCount} opération{opsCount!==1?'s':''} exécutée{opsCount!==1?'s':''} trouvée{opsCount!==1?'s':''}{wizard.startDate ? ` depuis le ${new Date(wizard.startDate).toLocaleDateString('fr-FR')}` : ''}.
          </div>
        )}
      </div>

      <div className="dca-card">
        <div className="dca-card-title">Période</div>
        <div className="dca-form-row">
          <div className="dca-form-group">
            <label>Date de début du DCA <span style={{color:'var(--muted)',fontWeight:'normal'}}>(vide = 1ère opération pointée)</span></label>
            <input className="dca-input" type="date" value={wizard.startDate||''} onChange={e=>setWizard(w=>({...w,startDate:e.target.value}))}/>
          </div>
          <div className="dca-form-group">
            <label>Date de fin <span style={{color:'var(--muted)',fontWeight:'normal'}}>(vide = aujourd'hui)</span></label>
            <input className="dca-input" type="date" value={wizard.endDate||''} onChange={e=>setWizard(w=>({...w,endDate:e.target.value}))}/>
          </div>
        </div>
      </div>

      <div className="dca-btm">
        <button className="dca-btn dca-btn-ghost" onClick={onBack}>← Retour</button>
        <span className="dca-step-hint">Étape 1 / 3</span>
        <button className="dca-btn dca-btn-primary" disabled={!wizard.pair||(wizard.pair==='NEW'&&!wizard.customPair)} onClick={onNext}>
          {opsCount>0 ? 'Voir les opérations →' : 'Paramétrer la stratégie →'}
        </button>
      </div>
    </div>
  )
}

/* ═══ STEP 2 — Pointage ═══════════════════════════════════════════════════ */
function Step2({ wizard, setWizard, rawRows, onNext, onBack }) {
  const effectivePair = wizard.pair==='NEW' ? (wizard.customPair||'') : wizard.pair
  const ops = useMemo(() => filterOpsForPlan(rawRows, effectivePair, wizard.startDate, wizard.endDate), [rawRows, effectivePair, wizard.startDate, wizard.endDate])

  // Init : TOUTES les ops cochées par défaut (achats ET ventes)
  useEffect(() => {
    if (ops.length && wizard.pointedOps === undefined) {
      setWizard(w => ({ ...w, pointedOps: ops.map((op,i) => getOpKey(op,i)) }))
    }
  }, [ops.length])

  const pointed = wizard.pointedOps || []

  function toggle(key) {
    setWizard(w => {
      const s = new Set(w.pointedOps||[])
      s.has(key) ? s.delete(key) : s.add(key)
      return {...w, pointedOps:[...s]}
    })
  }
  function setAll(val) {
    setWizard(w => ({...w, pointedOps: val ? ops.map((op,i)=>getOpKey(op,i)) : []}))
  }

  const pointedOps = ops.filter((op,i) => pointed.includes(getOpKey(op,i)))
  const breakeven  = computeBreakeven(pointedOps)
  const avgPrice   = computeAvgPrice(pointedOps)
  const totalUsdt  = pointedOps.filter(o=>o.sens==='Achat').reduce((s,o)=>s+o.usdt,0)

  if (ops.length === 0) return (
    <div className="dca-scroll">
      <Stepper step={2}/>
      <div className="dca-banner dca-banner-warn">Aucune opération exécutée pour <b>{effectivePair}</b>. Vous passerez directement au paramétrage.</div>
      <div className="dca-btm">
        <button className="dca-btn dca-btn-ghost" onClick={onBack}>← Retour</button>
        <button className="dca-btn dca-btn-primary" onClick={onNext}>Paramétrer →</button>
      </div>
    </div>
  )

  return (
    <div className="dca-scroll">
      <Stepper step={2}/>
      <div className="dca-card">
        <div className="dca-ops-header">
          <div>
            <div className="dca-ops-title">{effectivePair} — Opérations exécutées</div>
            <div className="dca-ops-meta">{ops.length} opérations · <b style={{color:'var(--green)'}}>{pointed.length} intégrées au DCA</b></div>
          </div>
          <div className="dca-ops-btns">
            <button className="dca-ops-btn" onClick={()=>setAll(true)}>Tout cocher</button>
            <button className="dca-ops-btn" onClick={()=>setAll(false)}>Tout décocher</button>
          </div>
        </div>
        <div className="dca-banner dca-banner-info" style={{marginBottom:10}}>
          Seuls les ordres exécutés sont affichés. Toutes les lignes sont cochées par défaut. Décochez les opérations à exclure (ex: ventes de profit à ne pas comptabiliser).
        </div>
        <div className="dca-ops-tbl-wrap">
          <table className="dca-ops-tbl">
            <thead><tr>
              <th>Date</th><th>Sens</th>
              <th style={{textAlign:'right'}}>Prix</th>
              <th style={{textAlign:'right'}}>Montant</th>
              <th style={{textAlign:'right'}}>Volume</th>
              <th className="th-dca">DCA ✓</th>
            </tr></thead>
            <tbody>
              {ops.map((op,i) => {
                const key = getOpKey(op,i)
                const chk = pointed.includes(key)
                return (
                  <tr key={key}>
                    <td>{op.date ? op.date.toLocaleDateString('fr-FR') : '—'}</td>
                    <td><span className={`db-badge ${op.sens==='Achat'?'badge-buy':'badge-sell'}`}>{op.sens}</span></td>
                    <td style={{textAlign:'right',fontFamily:"'Space Mono',monospace",fontSize:'.6rem'}}>{op.prix ? fmt(op.prix) : '—'}</td>
                    <td style={{textAlign:'right',fontFamily:"'Space Mono',monospace",fontSize:'.6rem'}}>{op.usdt ? `$${op.usdt.toFixed(2)}` : '—'}</td>
                    <td style={{textAlign:'right',fontFamily:"'Space Mono',monospace",fontSize:'.58rem',color:'var(--muted)'}}>{op.vol ? op.vol.toFixed(6) : '—'}</td>
                    <td className="td-chk"><input type="checkbox" className="dca-ops-chk" checked={chk} onChange={()=>toggle(key)}/></td>
                  </tr>
                )
              })}
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
      <div className="dca-btm">
        <button className="dca-btn dca-btn-ghost" onClick={onBack}>← Retour</button>
        <span className="dca-step-hint">Étape 2 / 3</span>
        <button className="dca-btn dca-btn-primary" onClick={onNext}>Paramétrer la stratégie →</button>
      </div>
    </div>
  )
}

/* ─── Ligne tableau paramètre ────────────────────────────────────────────── */
function ParamRow({ row, colorArr, idx, refPrice, onChange, onDelete, showHint, unitLabel, col1Label, col2Label, col2Placeholder }) {
  const ecartNum   = parseFloat(String(row[col2Label]||'').replace(/[^0-9\-\.]/g,'')) || 0
  const targetPrice = refPrice > 0 && !isNaN(ecartNum) ? refPrice * (1 + ecartNum / 100) : null
  const color      = (colorArr||[])[idx] || 'var(--muted)'

  return (
    <tr>
      <td><span className="dca-zdot" style={{background:color}}/></td>
      <td>
        <input className="dca-pi" value={row.label||''} onChange={e=>onChange(idx,'label',e.target.value)} style={{width:80}}/>
      </td>
      <td>
        <input className="dca-pi" value={row[col2Label]!=null?row[col2Label]:''} onChange={e=>onChange(idx,col2Label,e.target.value)}
          style={{width:80}} placeholder={col2Placeholder||''}/>
      </td>
      <td>
        <div className="dca-pi-group">
          <input className="dca-pi" type="number" min="0" step="any"
            value={row[col1Label]!=null?row[col1Label]:''}
            onChange={e=>onChange(idx,col1Label,parseFloat(e.target.value)||0)}
            style={{width:70}}/>
          <span className="dca-pi-sfx">{unitLabel}</span>
        </div>
      </td>
      {showHint && <td><span className="dca-price-hint">{targetPrice ? fmt(targetPrice) : '—'}</span></td>}
      <td><button className="dca-del-btn" onClick={()=>onDelete(idx)}>×</button></td>
    </tr>
  )
}

/* ═══ STEP 3 — Paramétrage ════════════════════════════════════════════════ */
function Step3({ wizard, setWizard, rawRows, onNext, onBack, saving }) {
  const [showConfirm, setShowConfirm] = useState(false)
  const effectivePair = wizard.pair==='NEW' ? (wizard.customPair||'') : wizard.pair
  const ops        = useMemo(() => filterOpsForPlan(rawRows, effectivePair, wizard.startDate, wizard.endDate), [rawRows, effectivePair, wizard.startDate, wizard.endDate])
  const pointedOps = useMemo(() => {
    const p = wizard.pointedOps||[]
    return ops.filter((op,i)=>p.includes(getOpKey(op,i)))
  }, [ops, wizard.pointedOps])

  // Breakeven des lignes pointées pour les prix cibles
  const breakeven = computeBreakeven(pointedOps)

  // Date de début effective (fallback 1ère op pointée)
  const effectiveStartDate = wizard.startDate || (
    pointedOps.filter(o=>o.sens==='Achat'&&o.date).sort((a,b)=>a.date-b.date)[0]?.date?.toISOString().split('T')[0]
  ) || ''

  const p = wizard.params || {}
  function setP(key, val) { setWizard(w => ({...w, params:{...(w.params||{}), [key]:val}})) }

  const accZones   = p.accZones   || DEFAULT_ACC_ZONES
  const debtZones  = p.debtZones  || DEFAULT_DEBT_ZONES
  const profitZones = p.profitZones || DEFAULT_PROFIT_ZONES

  function updateZone(arr, key, idx, field, val) {
    setP(key, arr.map((r,i) => i===idx ? {...r,[field]:val} : r))
  }
  function deleteZone(arr, key, idx) {
    if (arr.length <= 1) return
    setP(key, arr.filter((_,i)=>i!==idx))
  }
  function addZone(key, template) {
    const arr = p[key] || (key==='accZones'?DEFAULT_ACC_ZONES:key==='debtZones'?DEFAULT_DEBT_ZONES:DEFAULT_PROFIT_ZONES)
    setP(key, [...arr, template])
  }

  const canSubmit = accZones.length >= 1 && profitZones.length >= 1 && (p.baseAmount||0) > 0

  return (
    <div className="dca-scroll">
      <Stepper step={3}/>

      {/* Confirmation modal */}
      {showConfirm && (
        <div style={{position:'fixed',inset:0,zIndex:9999,background:'rgba(0,0,0,0.75)',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div className="dca-card" style={{maxWidth:400,width:'100%'}}>
            <div className="dca-card-title">⚠️ Confirmer la création du plan</div>
            <div style={{fontSize:'.68rem',color:'var(--text2)',lineHeight:1.7,marginBottom:16}}>
              Une fois le plan DCA créé, <b style={{color:'var(--text)'}}>le paramétrage ne sera plus modifiable</b>.<br/><br/>
              Vous pourrez consulter votre dashboard de suivi et ajouter des entrées au journal, mais les zones d'accumulation, paliers de dette et paliers de profit seront verrouillés.<br/><br/>
              Voulez-vous continuer ?
            </div>
            <div style={{display:'flex',gap:10}}>
              <button className="dca-btn dca-btn-ghost" style={{flex:1}} onClick={()=>setShowConfirm(false)}>← Modifier</button>
              <button className="dca-btn dca-btn-success" style={{flex:1}} disabled={saving} onClick={()=>{ setShowConfirm(false); onNext() }}>
                {saving ? '⏳ Sauvegarde…' : 'Créer le plan ✓'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Base */}
      <div className="dca-card">
        <div className="dca-card-title">Paramètres de base</div>
        {effectiveStartDate && !wizard.startDate && (
          <div className="dca-banner dca-banner-info" style={{marginBottom:12}}>
            Date de début non renseignée — utilisation de la date de la première opération pointée : <b>{new Date(effectiveStartDate).toLocaleDateString('fr-FR')}</b>
          </div>
        )}
        <div className="dca-form-row">
          <div className="dca-form-group">
            <label>Montant de base *</label>
            <div className="dca-input-group">
              <input className="dca-input" type="number" value={p.baseAmount??10} onChange={e=>setP('baseAmount',parseFloat(e.target.value)||0)}/>
              <span className="dca-input-sfx">USDT</span>
            </div>
          </div>
          <div className="dca-form-group">
            <label>Fréquence *</label>
            <select className="dca-select" value={p.frequency||'day'} onChange={e=>setP('frequency',e.target.value)}>
              <option value="day">Tous les jours</option>
              <option value="week">Toutes les semaines</option>
              <option value="month">Tous les mois</option>
            </select>
          </div>
          <div className="dca-form-group">
            <label>Seuil bull run <span className="dca-tag dca-tag-opt">opt.</span></label>
            <div className="dca-input-group">
              <input className="dca-input" type="number" value={p.bullThreshold??20} onChange={e=>setP('bullThreshold',parseFloat(e.target.value)||null)}/>
              <span className="dca-input-sfx">%</span>
            </div>
          </div>
          <div className="dca-form-group">
            <label>Plafond dette <span className="dca-tag dca-tag-opt">opt.</span></label>
            <div className="dca-input-group">
              <input className="dca-input" type="number" value={p.debtCeiling??300} onChange={e=>setP('debtCeiling',parseFloat(e.target.value)||null)}/>
              <span className="dca-input-sfx">USDT</span>
            </div>
          </div>
        </div>
        {breakeven > 0 && <div style={{fontSize:'.6rem',color:'var(--muted)',marginTop:4}}>Breakeven des lignes pointées : <b style={{color:'var(--gold)'}}>{fmt(breakeven)}</b> · utilisé comme référence pour les prix cibles ci-dessous</div>}
      </div>

      {/* Accumulation */}
      <div className="dca-card">
        <div className="dca-card-title">Zones d'accumulation <span className="dca-tag dca-tag-req">min. 1 ligne</span></div>
        <table className="dca-ptbl">
          <thead><tr><th/><th>Zone</th><th>Écart min. (% vs breakeven)</th><th>Montant</th><th/></tr></thead>
          <tbody>
            {accZones.map((r,i)=>(
              <ParamRow key={i} row={r} colorArr={ZONE_COLORS.acc} idx={i} refPrice={0}
                col1Label="amount" col2Label="ecartMin" unitLabel="USDT" showHint={false}
                col2Placeholder="ex: 0 pour Zone B"
                onChange={(idx,field,val)=>updateZone(accZones,'accZones',idx,field,val)}
                onDelete={idx=>deleteZone(accZones,'accZones',idx)}/>
            ))}
          </tbody>
        </table>
        <div className="dca-add-row" onClick={()=>addZone('accZones',{label:`Zone ${String.fromCharCode(65+accZones.length)}`,ecartMin:0,ecartMax:null,amount:5})}>
          <div className="dca-add-ic">+</div> Ajouter une zone
        </div>
      </div>

      {/* Redistribution dette */}
      <div className="dca-card">
        <div className="dca-card-title">Redistribution de la dette <span className="dca-tag dca-tag-opt">optionnel</span></div>
        <div style={{fontSize:'.6rem',color:'var(--text2)',marginBottom:10,lineHeight:1.6}}>
          Lorsque le prix plonge fortement, injecter une partie de la dette accumulée pour renforcer la position.
        </div>
        <table className="dca-ptbl">
          <thead><tr><th/><th>Condition</th><th>Écart ≤ (% vs breakeven)</th><th>% dette injectée</th><th>Prix cible</th><th/></tr></thead>
          <tbody>
            {debtZones.map((r,i)=>(
              <ParamRow key={i} row={r} colorArr={ZONE_COLORS.debt} idx={i} refPrice={breakeven}
                col1Label="debtPct" col2Label="ecartThreshold" unitLabel="%" showHint={true}
                col2Placeholder="-10"
                onChange={(idx,field,val)=>updateZone(debtZones,'debtZones',idx,field,val)}
                onDelete={idx=>deleteZone(debtZones,'debtZones',idx)}/>
            ))}
          </tbody>
        </table>
        <div className="dca-add-row" onClick={()=>addZone('debtZones',{label:'Signal',ecartThreshold:-15,debtPct:75})}>
          <div className="dca-add-ic">+</div> Ajouter un palier
        </div>
      </div>

      {/* Profits */}
      <div className="dca-card">
        <div className="dca-card-title">Paliers de prise de profits <span className="dca-tag dca-tag-req">min. 1 ligne</span></div>
        <table className="dca-ptbl">
          <thead><tr><th/><th>Palier</th><th>Écart ≥ (% vs breakeven)</th><th>% position vendu</th><th>Prix cible</th><th/></tr></thead>
          <tbody>
            {profitZones.map((r,i)=>(
              <ParamRow key={i} row={r} colorArr={ZONE_COLORS.profit} idx={i} refPrice={breakeven}
                col1Label="positionPct" col2Label="ecartThreshold" unitLabel="%" showHint={true}
                col2Placeholder="+20"
                onChange={(idx,field,val)=>updateZone(profitZones,'profitZones',idx,field,val)}
                onDelete={idx=>deleteZone(profitZones,'profitZones',idx)}/>
            ))}
          </tbody>
        </table>
        <div className="dca-add-row" onClick={()=>addZone('profitZones',{label:`Palier ${profitZones.length+1}`,ecartThreshold:50,positionPct:50})}>
          <div className="dca-add-ic">+</div> Ajouter un palier
        </div>
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

/* ═══ STEP 4 — Dashboard ══════════════════════════════════════════════════ */
function DcaDashboard({ plan, rawRows, prices, onBack }) {
  const [showCal, setShowCal]       = useState(false)
  const [showEntryForm, setShowEntry] = useState(false)
  const [entryAdded, setEntryAdded]  = useState(false)
  const [manualPrice, setManualPrice] = useState('')

  const effectivePair = plan.pair || ''
  const ops = useMemo(()=> filterOpsForPlan(rawRows, effectivePair, plan.startDate, plan.endDate), [rawRows, effectivePair, plan.startDate, plan.endDate])
  const pointed       = plan.pointedOps || []
  const pointedOps    = useMemo(()=> ops.filter((op,i)=>pointed.includes(getOpKey(op,i))), [ops, pointed])

  // Utilise plan directement (flat structure)
  const breakeven    = computeBreakeven(pointedOps)
  const debt         = computeDebt(plan, pointedOps)
  const debtPct      = plan.debtCeiling ? Math.min(100, (debt / plan.debtCeiling) * 100) : 0

  const currentPrice = prices[effectivePair] || (manualPrice ? parseFloat(manualPrice) : null)
  const signal       = useMemo(()=> computeSignal(plan, currentPrice, breakeven, debt), [plan, currentPrice, breakeven, debt])
  const delta        = currentPrice && breakeven ? (currentPrice - breakeven) / breakeven * 100 : null

  // KPIs
  const buys           = pointedOps.filter(o=>o.sens==='Achat')
  const sells          = pointedOps.filter(o=>o.sens==='Vente')
  const totalInvested  = buys.reduce((s,o)=>s+o.usdt,0)
  const totalVolBought = buys.reduce((s,o)=>s+(o.vol||0),0)
  const totalVolSold   = sells.reduce((s,o)=>s+(o.vol||0),0)
  const position       = totalVolBought - totalVolSold
  const pnlLatent      = currentPrice && position>0 && breakeven>0 ? position*(currentPrice-breakeven) : 0

  // Timeline avec périodes manquées
  const timeline = useMemo(()=> generateTimeline(plan, pointedOps, 15), [plan, pointedOps])

  // Calendrier mensuel (mois courant)
  const calDays = useMemo(()=>{
    const now  = new Date()
    const y    = now.getFullYear()
    const m    = now.getMonth()
    const first= new Date(y, m, 1)
    const last = new Date(y, m+1, 0)
    const days = []
    // Padding début (lundi=0)
    const startDow = (first.getDay()+6)%7
    for (let i=0;i<startDow;i++) days.push(null)
    for (let d=1;d<=last.getDate();d++) {
      const day = new Date(y,m,d)
      // Trouver le statut de ce jour dans la timeline
      const slot = timeline.find(t => t.date && t.date.toDateString()===day.toDateString())
      days.push({ day:d, slot, isToday: d===now.getDate() })
    }
    return days
  }, [timeline])

  // Needle position
  const bull    = plan.bullThreshold || 20
  const MIN_D   = -25, MAX_D = bull * 1.5
  const needlePct = delta!=null ? Math.min(98,Math.max(2,(delta-MIN_D)/(MAX_D-MIN_D)*100)) : 50

  function signalClass() {
    if (signal.zone==='PROFIT') return 'profit'
    if (signal.zone==='DEBT'||signal.zone==='FORCE') return 'debt'
    if (signal.deployAmount>=(plan.baseAmount||10)) return 'buy'
    if (signal.deployAmount>0) return 'buy50'
    return 'hold'
  }

  function tlClass(slot) {
    if (!slot) return 'tc-sk'
    if (slot.type==='missed') return 'tc-sk'
    if (slot.type==='sell')   return 'tc-sl'
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
    const d = slot.date?.toLocaleDateString('fr-FR')||'—'
    if (slot.type==='missed') return `${d} : Manqué`
    if (slot.type==='sell')   return `${d} : Vente`
    return `${d} : Acheté ${slot.amount?.toFixed(2)||'?'} USDT (${slot.pct||0}%)`
  }

  function calClass(slot) {
    if (!slot) return 'tc-sk'
    if (slot.type==='missed') return 'tc-sk'
    if (slot.type==='sell')   return 'tc-sl'
    if (slot.type==='future') return 'tc-sk'
    if (slot.pct>=90) return 'tc-100'
    if (slot.pct>=65) return 'tc-75'
    if (slot.pct>=40) return 'tc-50'
    return 'tc-25'
  }

  const profitZones = plan.profitZones || DEFAULT_PROFIT_ZONES
  const debtZones   = plan.debtZones   || []
  const missedCount = timeline.filter(t=>t.type==='missed').length

  return (
    <div className="dca-scroll">
      <div className="dca-banner dca-banner-success">
        Plan <b>{effectivePair}</b> actif{plan.startDate ? ` depuis le ${new Date(plan.startDate).toLocaleDateString('fr-FR')}` : ''}
        {plan.baseAmount ? ` · ${plan.baseAmount} USDT/${plan.frequency==='day'?'jour':plan.frequency==='week'?'sem.':'mois'}` : ''}
      </div>

      {/* ── Price Hero ──────────────────────────────────────────────────────── */}
      <div className="dca-hero">
        <div className="dca-hero-prices">
          <div className="dca-hero-block">
            <div className="dca-hero-lbl">Breakeven (coût de revient)</div>
            <div className="dca-hero-val dca-hero-val-main">{breakeven>0?fmt(breakeven):'—'}</div>
            <div className="dca-hero-sub">{buys.length} achats · {sells.length} ventes pointées</div>
          </div>
          <div className="dca-hero-sep"/>
          <div className="dca-hero-delta">
            {delta!=null ? (<>
              <div className={`dca-hero-delta-arrow ${delta<0?'down':'up'}`}>{delta<0?'↓':'↑'}</div>
              <div className={`dca-hero-delta-pct ${delta<0?'down':'up'}`}>{pct(delta)}</div>
              <div className="dca-hero-delta-lbl">cours vs breakeven</div>
            </>) : (
              <div style={{textAlign:'center'}}>
                <div style={{fontSize:'.52rem',color:'var(--muted)',marginBottom:4}}>Cours introuvable</div>
                <input className="dca-input" type="number" placeholder="Saisir cours ($)"
                  value={manualPrice} onChange={e=>setManualPrice(e.target.value)}
                  style={{width:110,textAlign:'center',fontSize:'.6rem'}}/>
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
        <div className="dca-zone-bar-wrap">
          <div className="dca-zone-bar">
            <div className="dca-zone-seg z4">100%</div>
            <div className="dca-zone-seg z3">75%</div>
            <div className="dca-zone-seg z2">50%</div>
            <div className="dca-zone-seg z1">25%</div>
            <div className="dca-zone-seg z0">Vente</div>
            <div className="dca-zone-needle" style={{left:`${needlePct}%`}}/>
          </div>
          <div className="dca-zone-labels">
            <span>&lt; 0%</span><span>0–5%</span><span>5–10%</span><span>10–{bull}%</span><span>&gt; {bull}%</span>
          </div>
        </div>
      </div>

      {/* ── Signal ──────────────────────────────────────────────────────────── */}
      <div className={`dca-signal ${signalClass()}`}>
        <div style={{flex:1}}>
          <div className="dca-signal-title">{signal.label}</div>
          <div className="dca-signal-desc">{signal.description}</div>
        </div>
        <div className="dca-signal-amount">
          {signal.action==='sell' ? (<>
            <div className="dca-signal-amt">Vendre {signal.sellPct}%</div>
            <div className="dca-signal-amt-lbl">de la position</div>
          </>) : (<>
            <div className="dca-signal-amt">
              {signal.deployAmount>0 ? `${signal.deployAmount.toFixed(2)} USDT` : '—'}
            </div>
            <div className="dca-signal-amt-lbl">
              {signal.deployAmount>0 ? (
                signal.debtInject>0
                  ? `${signal.base?.toFixed(2)} USDT + ${signal.debtInject?.toFixed(2)} dette`
                  : 'à déployer ce cycle'
              ) : 'aucune action ce cycle'}
            </div>
          </>)}
        </div>
      </div>

      {/* ── KPIs ──────────────────────────────────────────────────────────── */}
      <div className="dca-kpi-grid">
        <div className="dca-kpi">
          <div className="dca-kpi-val">{totalInvested>0?fmt(totalInvested,2):'—'}</div>
          <div className="dca-kpi-lbl">Total investi</div>
          <div className="dca-kpi-sub">{buys.length} opérations pointées</div>
        </div>
        <div className="dca-kpi">
          <div className="dca-kpi-val" style={{color:debtPct>50?'var(--gold)':debtPct>0?'var(--text2)':'var(--muted)'}}>
            ${debt.toFixed(0)}
          </div>
          <div className="dca-kpi-lbl">Dette accumulée</div>
          <div className="dca-kpi-sub">
            {missedCount} période{missedCount!==1?'s':''} manquée{missedCount!==1?'s':''}
            {plan.debtCeiling ? ` · ${debtPct.toFixed(0)}% du plafond` : ''}
          </div>
        </div>
        <div className="dca-kpi">
          <div className="dca-kpi-val" style={{color:pnlLatent>=0?'var(--green)':'var(--red)'}}>
            {pnlLatent!==0 ? (pnlLatent>=0?'+':'')+fmt(pnlLatent,2) : '—'}
          </div>
          <div className="dca-kpi-lbl">PnL latent</div>
          <div className="dca-kpi-sub">{delta!=null?pct(delta)+' vs breakeven':'cours manquant'}</div>
        </div>
      </div>

      {/* ── Paliers ──────────────────────────────────────────────────────── */}
      <div className="dca-two-col">
        {/* Redistribution dette */}
        {debtZones.length>0 && (
          <div className="dca-card">
            <div className="dca-card-title">Redistribution de la dette</div>
            {debtZones.map((z,i)=>{
              const tp = breakeven>0 ? breakeven*(1+(parseFloat(z.ecartThreshold)||0)/100) : null
              const active = delta!=null && delta<=(parseFloat(z.ecartThreshold)||0)
              return (
                <div key={i} className={`dca-pal-row${active?' active-debt':''}`}>
                  <span className="dca-zdot" style={{background:ZONE_COLORS.debt[i]||'#378ADD'}}/>
                  <span className="dca-pal-lbl">{z.label} · <b>{z.ecartThreshold}%</b></span>
                  <span className="dca-pal-price">{tp?fmt(tp):'—'}</span>
                  <span className="dca-pal-action">{active?'⚡ ':''}{z.debtPct}% dette</span>
                </div>
              )
            })}
          </div>
        )}

        {/* Profits */}
        <div className="dca-card">
          <div className="dca-card-title">Paliers de profits</div>
          {profitZones.map((z,i)=>{
            const tp = breakeven>0 ? breakeven*(1+(parseFloat(z.ecartThreshold)||0)/100) : null
            const active = delta!=null && delta>=(parseFloat(z.ecartThreshold)||0)
            return (
              <div key={i} className={`dca-pal-row${active?' active-profit':''}`}>
                <span className="dca-zdot" style={{background:ZONE_COLORS.profit[i]||'#E24B4A'}}/>
                <span className="dca-pal-lbl">{z.label} · <b>+{z.ecartThreshold}%</b></span>
                <span className="dca-pal-price">{tp?fmt(tp):'—'}</span>
                <span className="dca-pal-action">{active?'✓ ':''}{z.positionPct}% pos.</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Timeline ─────────────────────────────────────────────────────── */}
      <div className="dca-card">
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
          <div className="dca-card-title" style={{marginBottom:0}}>
            {timeline.length} dernières périodes
            {missedCount>0 && <span style={{fontSize:'.56rem',color:'var(--gold)',marginLeft:8,fontWeight:'normal'}}>· {missedCount} manquée{missedCount!==1?'s':''}</span>}
          </div>
          <button
            onClick={()=>setShowEntry(true)}
            className="dca-btn dca-btn-primary"
            style={{fontSize:'.6rem',padding:'5px 12px'}}
          >
            + Ajouter au journal
          </button>
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
            <div key={i}
              className={`dca-tc ${tlClass(slot)}${i===timeline.length-1?' tc-today':''}`}
              data-tip={tlTip(slot)}
            >
              {tlLabel(slot)}
            </div>
          ))}
          {Array.from({length:Math.max(0,15-timeline.length)}).map((_,i)=>(
            <div key={`e${i}`} className="dca-tc tc-sk" data-tip="Aucune donnée">·</div>
          ))}
        </div>

        {/* Toggle calendrier */}
        <div
          className="dca-add-row"
          style={{cursor:'pointer',userSelect:'none'}}
          onClick={()=>setShowCal(v=>!v)}
        >
          <span style={{fontSize:'.75rem'}}>📅</span>
          <span>{showCal?'Masquer le calendrier':'Afficher le calendrier mensuel'}</span>
        </div>

        {/* Calendrier */}
        {showCal && (
          <div style={{marginTop:10}}>
            <div style={{fontSize:'.58rem',fontWeight:'500',color:'var(--text2)',marginBottom:6}}>
              {new Date().toLocaleDateString('fr-FR',{month:'long',year:'numeric'})}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2,marginBottom:4}}>
              {['L','M','M','J','V','S','D'].map((d,i)=>(
                <div key={i} style={{textAlign:'center',fontSize:'.48rem',color:'var(--muted)',fontWeight:'500'}}>{d}</div>
              ))}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2}}>
              {calDays.map((cell,i)=>{
                if (!cell) return <div key={i}/>
                const cls = calClass(cell.slot)
                return (
                  <div key={i} className={`dca-tc ${cls}${cell.isToday?' tc-today':''}`} style={{aspectRatio:'1',fontSize:'.55rem'}}>
                    {cell.day}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div style={{fontSize:'.56rem',color:'var(--muted)',marginTop:8,borderTop:'1px solid var(--border)',paddingTop:8}}>
          {buys.length} achats · {sells.length} ventes · {missedCount} manquées · Investi total {totalInvested>0?`$${totalInvested.toFixed(0)}`:'—'}
        </div>
      </div>

      {entryAdded && (
        <div className="dca-banner dca-banner-success">
          ✓ Entrée ajoutée au journal. Rechargez la page pour mettre à jour l'analyse DCA.
        </div>
      )}

      <div className="dca-btm">
        <button className="dca-btn dca-btn-ghost" onClick={onBack}>← Plans DCA</button>
      </div>

      {/* EntryForm modal */}
      {showEntryForm && (
        <div style={{position:'fixed',inset:0,zIndex:9999,background:'rgba(0,0,0,0.8)',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <EntryForm
            onSaved={()=>{ setShowEntry(false); setEntryAdded(true) }}
            onClose={()=>setShowEntry(false)}
          />
        </div>
      )}
    </div>
  )
}

/* ═══ DcaView — Orchestrateur ═════════════════════════════════════════════ */
export default function DcaView({ pairList = [], rawRows = [], prices = {} }) {
  const [screen, setScreen]   = useState('list')
  const [plans, setPlans]     = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [currentPlan, setCurrentPlan] = useState(null)

  const INIT_WIZARD = () => ({
    pair: pairList[0]?.name||'', customPair:'', startDate:'', endDate:'',
    pointedOps: undefined,
    params: {
      baseAmount:10, frequency:'day', bullThreshold:20, debtCeiling:300,
      accZones:[...DEFAULT_ACC_ZONES],
      debtZones:[...DEFAULT_DEBT_ZONES],
      profitZones:[...DEFAULT_PROFIT_ZONES],
    }
  })
  const [wizard, setWizard] = useState(INIT_WIZARD)

  useEffect(() => {
    getDcaPlans().then(setPlans).catch(console.error).finally(()=>setLoading(false))
  }, [])

  // Ouvrir un plan existant → direct dashboard (pas de wizard)
  function openPlan(plan) {
    setCurrentPlan(plan)
    setScreen('dashboard')
  }

  function startNewWizard() {
    setWizard(INIT_WIZARD())
    setCurrentPlan(null)
    setScreen(1)
  }

  async function deletePlan(id) {
    await deleteDcaPlan(id)
    setPlans(p=>p.filter(x=>x.id!==id))
  }

  function step1Next() {
    const pair = wizard.pair==='NEW' ? wizard.customPair : wizard.pair
    const hasOps = rawRows.some(r=>r.pair===pair&&r.exec)
    setScreen(hasOps ? 2 : 3)
  }

  async function step3Save() {
    setSaving(true)
    try {
      const pair = wizard.pair==='NEW' ? wizard.customPair : wizard.pair
      // Calcul de la date de début effective
      const effectivePair = pair
      const ops = filterOpsForPlan(rawRows, effectivePair, wizard.startDate, wizard.endDate)
      const pointed = wizard.pointedOps||[]
      const pointedOps = ops.filter((op,i)=>pointed.includes(getOpKey(op,i)))
      const firstBuyDate = pointedOps.filter(o=>o.sens==='Achat'&&o.date).sort((a,b)=>a.date-b.date)[0]?.date
      const effectiveStartDate = wizard.startDate || (firstBuyDate ? firstBuyDate.toISOString().split('T')[0] : '')

      const planData = {
        id:          currentPlan?.id || null,
        pair,
        startDate:   effectiveStartDate,
        endDate:     wizard.endDate || null,
        pointedOps:  wizard.pointedOps || [],
        // Spread flat (pas de sous-objet params)
        baseAmount:  wizard.params?.baseAmount  ?? 10,
        frequency:   wizard.params?.frequency   ?? 'day',
        bullThreshold: wizard.params?.bullThreshold ?? 20,
        debtCeiling: wizard.params?.debtCeiling ?? 300,
        accZones:    wizard.params?.accZones    || DEFAULT_ACC_ZONES,
        debtZones:   wizard.params?.debtZones   || DEFAULT_DEBT_ZONES,
        profitZones: wizard.params?.profitZones || DEFAULT_PROFIT_ZONES,
      }
      const id   = await saveDcaPlan(planData)
      const saved = {...planData, id}
      setCurrentPlan(saved)
      setPlans(prev => {
        const exists = prev.find(p=>p.id===id)
        return exists ? prev.map(p=>p.id===id?saved:p) : [...prev, saved]
      })
      setScreen('dashboard')
    } catch(e) {
      alert('Erreur sauvegarde : '+e.message)
    } finally {
      setSaving(false)
    }
  }

  const activePair = screen==='dashboard'&&currentPlan ? currentPlan.pair : (wizard.pair==='NEW'?wizard.customPair:wizard.pair)

  return (
    <div className="dca-page">
      {/* Barre de navigation */}
      {screen !== 'list' && (
        <div className="dca-back-bar" style={{padding:'12px 20px 0'}}>
          <button className="dca-back-btn" onClick={()=>setScreen('list')}>← Plans DCA</button>
          {activePair && <span className="dca-back-pair">· {activePair}</span>}
        </div>
      )}

      {screen==='list' && (
        <DcaList plans={plans} loading={loading} onNew={startNewWizard} onOpen={openPlan} onDelete={deletePlan}/>
      )}
      {screen===1 && (
        <Step1 wizard={wizard} setWizard={setWizard} pairList={pairList} rawRows={rawRows} onNext={step1Next} onBack={()=>setScreen('list')}/>
      )}
      {screen===2 && (
        <Step2 wizard={wizard} setWizard={setWizard} rawRows={rawRows} onNext={()=>setScreen(3)} onBack={()=>setScreen(1)}/>
      )}
      {screen===3 && (
        <Step3 wizard={wizard} setWizard={setWizard} rawRows={rawRows} onNext={step3Save} onBack={()=>setScreen(2)} saving={saving}/>
      )}
      {screen==='dashboard' && currentPlan && (
        <DcaDashboard plan={currentPlan} rawRows={rawRows} prices={prices} onBack={()=>setScreen('list')}/>
      )}
    </div>
  )
}
