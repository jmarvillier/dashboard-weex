/**
 * DcaView.jsx — v4 — zones unifiées, templates, rechargement simplifié
 */

import { useState, useEffect, useMemo } from 'react'
import '../styles/dca.css'
import { getDcaPlans, saveDcaPlan, deleteDcaPlan, getDcaTemplates, saveDcaTemplate, deleteDcaTemplate } from '../lib/dcaRepository.js'
import { saveSnapshot, loadSnapshot } from '../lib/repository.js'
import { normPair } from '../lib/parser.js'
import { parseDate } from '../lib/process.js'
import EntryForm from './EntryForm.jsx'
import KpiTooltip from './KpiTooltip.jsx'
import {
  computeBreakeven, computeAvgPrice, computeRechargement,
  computeSignal, generateTimeline, getCurrentPeriodOps,
} from '../hooks/useDcaStrategy.js'

/* ── Structure de zone unifiée ──────────────────────────────────────────────
   type 'accum'  → accumuler    · action = USDT à injecter (cours ≤ ecart% du breakeven)
   type 'ralent' → ralentir     · action = USDT à injecter (cours légèrement au-dessus)
   type 'profit' → vendre       · action = % de la position à vendre
   ─────────────────────────────────────────────────────────────────────────── */
const DEFAULT_ZONES = [
  { type:'accum',  label:'Accumulation forte', ecart:'-10', action:'10',  color:'#3dbf90' },
  { type:'accum',  label:'Accumulation',       ecart:'0',   action:'10',  color:'#2a9d70' },
  { type:'ralent', label:'Ralentissement',      ecart:'10',  action:'5',   color:'#c8a020' },
  { type:'profit', label:'Prise partielle',     ecart:'25',  action:'25',  color:'#F7C1C1' },
  { type:'profit', label:'Prise de profits',    ecart:'50',  action:'50',  color:'#E24B4A' },
]

const TYPE_LABELS = { accum: 'Accumulation', ralent: 'Ralentissement', profit: 'Prise de profit' }
const TYPE_COLORS = { accum: 'var(--green)',  ralent: 'var(--gold)',    profit: 'var(--red)' }
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
          <span key={i} style={{display:'contents'}}>
            <div className={`dca-step${active?' active':done?' done':''}`}>
              <div className="dca-step-circle">{done ? '✓' : i+1}</div>
              <div className="dca-step-text">{label}<br/>{sub}</div>
            </div>
            {i < steps.length-1 && <div className={`dca-step-line${done?' done':''}`}/>}
          </span>
        )
      })}
    </div>
  )
}

/* ═══ SCREEN 0 — Liste ════════════════════════════════════════════════════ */
function DcaList({ onNew, onOpen, plans, loading, onDelete, templates, onDeleteTpl }) {
  const [confirm, setConfirm]   = useState(null)
  const [showTpls, setShowTpls] = useState(false)
  function iconClass(p='') {
    return `dca-plan-icon${p.startsWith('BTC')?' dca-plan-icon-btc':p.startsWith('ETH')?' dca-plan-icon-eth':' dca-plan-icon-def'}`
  }
  return (
    <div className="dca-scroll">
      <div className="dca-list-header">
        <div>
          <div className="dca-list-title">Scaled Mirror DCA</div>
          <div className="dca-list-sub">Accumulation graduée + distribution symétrique</div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button className="dca-btn" style={{fontSize:'.62rem'}} onClick={()=>setShowTpls(v=>!v)}>⚙ Templates</button>
          <button className="dca-btn dca-btn-primary" onClick={onNew}>+ Nouveau plan</button>
        </div>
      </div>

      {showTpls && (
        <div className="dca-card" style={{marginBottom:8}}>
          <div className="dca-card-title" style={{marginBottom:10}}>Mes templates</div>
          {(!templates || templates.length === 0) && (
            <div style={{fontSize:'.62rem',color:'var(--muted)'}}>Aucun template. Dans l'étape Paramètres, cliquez "✦ Enregistrer comme template".</div>
          )}
          {templates?.map(t => (
            <div key={t.id} style={{display:'flex',alignItems:'center',gap:10,padding:'7px 0',borderBottom:'0.5px solid var(--border)'}}>
              <div style={{flex:1}}>
                <div style={{fontSize:'.7rem',fontWeight:'500',color:'var(--text)'}}>{t.name}</div>
                <div style={{fontSize:'.56rem',color:'var(--muted)'}}>
                  {t.baseAmount} USDT/{t.frequency==='day'?'jour':t.frequency==='week'?'sem.':'mois'}
                  {t.zones?.length ? ` · ${t.zones.length} zones` : ''}
                </div>
              </div>
              <button className="dca-plan-del-btn" onClick={()=>onDeleteTpl(t.id)}>✕</button>
            </div>
          ))}
        </div>
      )}

      {loading && <div className="dca-banner dca-banner-info">Chargement…</div>}
      {!loading && plans.length === 0 && (
        <div className="dca-empty-zone" onClick={onNew}>+ Aucun plan — cliquez pour en créer un</div>
      )}
      {plans.map(plan => (
        <div key={plan.id} className="dca-plan-item" onClick={() => onOpen(plan)}>
          <div className={iconClass(plan.pair)}>{(plan.pair||'').split('/')[0].slice(0,3)}</div>
          <div className="dca-plan-info">
            <div className="dca-plan-pair">{plan.pair}</div>
            <div className="dca-plan-meta">{plan.baseAmount} USDT/{PERIOD_LABEL[plan.frequency]||'jour'}{plan.startDate ? ` · depuis ${new Date(plan.startDate).toLocaleDateString('fr-FR')}` : ''}</div>
          </div>
          <div className="dca-plan-right"><div className="dca-plan-status dca-status-acc">Accumulation</div></div>
          <button className="dca-plan-del-btn" onClick={e=>{ e.stopPropagation(); setConfirm(plan.id) }}>✕</button>
        </div>
      ))}
      {confirm && (
        <div className="dca-banner dca-banner-danger" style={{marginTop:8}}>
          Supprimer ce plan ? Le journal <b>ne sera pas modifié</b>.{' '}
          <button className="dca-btn" style={{marginLeft:8,padding:'3px 10px',fontSize:'.6rem'}} onClick={async()=>{ await onDelete(confirm); setConfirm(null) }}>Confirmer</button>
          <button className="dca-btn dca-btn-ghost" style={{marginLeft:4,padding:'3px 8px',fontSize:'.6rem'}} onClick={()=>setConfirm(null)}>Annuler</button>
        </div>
      )}
      <div className="dca-banner dca-banner-info" style={{marginTop:8}}>Supprimer un plan efface uniquement sa configuration — le journal reste intact.</div>
    </div>
  )
}

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
      <div className="dca-btm">
        <button className="dca-btn dca-btn-ghost" onClick={onBack}>← Retour</button>
        <span className="dca-step-hint">Étape 2 / 3</span>
        <button className="dca-btn dca-btn-primary" onClick={async()=>{ await onFlagOps?.(ops, pointed); onNext() }}>Paramétrer →</button>
      </div>
    </div>
  )
}

/* ═══ STEP 3 — Paramétrage ════════════════════════════════════════════════ */
function Step3({ wizard, setWizard, rawRows, onNext, onBack, saving, templates, onSaveTpl, onLoadTpl }) {
  const [showConfirm, setShowConfirm] = useState(false)
  const [tplName, setTplName]         = useState('')
  const [tplSaving, setTplSaving]     = useState(false)
  const [tplError, setTplError]       = useState('')
  const effectivePair = wizard.pair==='NEW' ? (wizard.customPair||'') : wizard.pair
  const ops        = useMemo(() => filterOpsForPlan(rawRows, effectivePair, wizard.startDate, wizard.endDate), [rawRows, effectivePair, wizard.startDate, wizard.endDate])
  const pointedOps = useMemo(() => { const p=wizard.pointedOps||[]; return ops.filter((op,i)=>p.includes(getOpKey(op,i))) }, [ops, wizard.pointedOps])
  const breakeven  = computeBreakeven(pointedOps)
  const firstBuyDate = pointedOps.filter(o=>o.sens==='Achat'&&o.date).sort((a,b)=>a.date-b.date)[0]?.date?.toISOString().split('T')[0]
  const effectiveStartDate = wizard.startDate || firstBuyDate || ''

  const p = wizard.params || {}
  function setP(k,v) { setWizard(w=>({...w,params:{...(w.params||{}),[k]:v}})) }
  const zones = p.zones || DEFAULT_ZONES

  // Validation : min 1 zone profit avec % ≤ 100 et ≠ vide
  const profitZones = zones.filter(z=>z.type==='profit')
  const profitTotal = profitZones.reduce((s,z)=>s+(parseFloat(z.action)||0),0)
  const profitHasEmpty = profitZones.some(z=>z.action===''||z.action==null)
  const profitOver = profitTotal > 100
  const profitPartial = profitTotal > 0 && profitTotal < 100 && !profitHasEmpty
  const canSubmit = profitZones.length >= 1 && (p.baseAmount||0) > 0 && !profitHasEmpty && !profitOver

  function updateZone(i, field, val) { const nz=[...zones]; nz[i]={...nz[i],[field]:val}; setP('zones',nz) }
  function removeZone(i) { if(zones.length<=1) return; setP('zones',zones.filter((_,j)=>j!==i)) }
  function sortZones() { setP('zones', [...zones].sort((a,b)=>(parseFloat(a.ecart)||0)-(parseFloat(b.ecart)||0))) }
  function addZone(type) {
    const defs = { accum:{ecart:'0',action:'10',color:'#3dbf90'}, ralent:{ecart:'10',action:'5',color:'#c8a020'}, profit:{ecart:'25',action:'25',color:'#E24B4A'} }
    const count = zones.filter(z=>z.type===type).length
    // Nouvelle zone ajoutée en bas, sans tri immédiat
    setP('zones', [...zones, { type, label:`${TYPE_LABELS[type]} ${count+1}`, ...defs[type] }])
  }

  async function saveTpl() {
    const name = tplName.trim()
    if (!name) return
    if (templates?.some(t => t.name.trim().toLowerCase() === name.toLowerCase())) {
      setTplError(`"${name}" existe déjà`)
      return
    }
    setTplSaving(true)
    await onSaveTpl?.(name)
    setTplName('')
    setTplError('')
    setTplSaving(false)
  }

  return (
    <div className="dca-scroll">
      <div style={{fontSize:'.58rem',color:'var(--muted)',paddingBottom:4}}><button className="dca-back-btn" style={{background:'none',border:'none',color:'var(--muted)',cursor:'pointer',fontSize:'inherit',fontFamily:'inherit'}} onClick={onBack}>← Plans DCA</button></div>
      <Stepper step={3}/>

      {/* Templates bar */}
      <div style={{display:'flex',alignItems:'center',gap:8,padding:'0 0 6px',flexWrap:'wrap'}}>
        <span style={{fontSize:'.58rem',color:'var(--muted)',flexShrink:0}}>Templates :</span>
        {templates?.map(t => (
          <button key={t.id} className="dca-ops-btn" style={{fontSize:'.58rem',padding:'3px 10px'}} onClick={()=>onLoadTpl?.(t)}>{t.name}</button>
        ))}
        {(!templates || templates.length === 0) && <span style={{fontSize:'.56rem',color:'var(--muted)',opacity:.6}}>Aucun template enregistré</span>}
        {/* Sauvegarde inline — sans popup navigateur */}
        <div style={{display:'flex',alignItems:'center',gap:6,marginLeft:'auto',flexShrink:0}}>
          <div style={{position:'relative'}}>
            <input
              className="dca-input"
              placeholder="Nom du template…"
              value={tplName}
              onChange={e=>{ setTplName(e.target.value); setTplError('') }}
              onKeyDown={e=>{ if(e.key==='Enter') saveTpl() }}
              style={{fontSize:'.58rem',padding:'3px 8px',width:140,
                borderColor: tplError ? 'var(--red)' : tplName.trim() ? 'var(--gold)' : undefined}}
            />
            {tplError && (
              <div style={{position:'absolute',top:'100%',left:0,zIndex:10,
                background:'var(--bg2)',border:'1px solid var(--red)',borderRadius:4,
                padding:'4px 8px',fontSize:'.52rem',color:'var(--red)',whiteSpace:'nowrap',marginTop:2}}>
                {tplError}
              </div>
            )}
          </div>
          <button className="dca-ops-btn"
            style={{borderColor:'var(--gold)',color:'var(--gold)',fontSize:'.58rem',padding:'3px 10px',flexShrink:0,opacity:tplName.trim()?1:.5}}
            disabled={!tplName.trim()||tplSaving}
            onClick={saveTpl}>
            {tplSaving ? '…' : '✦ Sauvegarder'}
          </button>
        </div>
      </div>

      {showConfirm && (
        <div style={{position:'fixed',inset:0,zIndex:9999,background:'rgba(0,0,0,0.75)',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div className="dca-card" style={{maxWidth:400,width:'100%'}}>
            <div className="dca-card-title">⚠️ Confirmer la création</div>
            <div style={{fontSize:'.68rem',color:'var(--text2)',lineHeight:1.7,marginBottom:16}}>
              Une fois créé, le <b style={{color:'var(--text)'}}>paramétrage ne sera plus modifiable</b>.<br/>
              Vous pourrez consulter le dashboard et ajouter des entrées. Voulez-vous continuer ?
            </div>
            <div style={{display:'flex',gap:10}}>
              <button className="dca-btn dca-btn-ghost" style={{flex:1}} onClick={()=>setShowConfirm(false)}>← Modifier</button>
              <button className="dca-btn dca-btn-success" style={{flex:1}} disabled={saving} onClick={()=>{ setShowConfirm(false); onNext() }}>{saving?'⏳…':'Créer ✓'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Paramètres de base */}
      <div className="dca-card">
        <div className="dca-card-title">Paramètres de base</div>
        {effectiveStartDate && !wizard.startDate && (
          <div className="dca-banner dca-banner-info" style={{marginBottom:10}}>Départ depuis la 1ère opération pointée : <b>{new Date(effectiveStartDate).toLocaleDateString('fr-FR')}</b></div>
        )}
        <div className="dca-form-row">
          <div className="dca-form-group"><label>Montant de base *</label><div className="dca-input-group"><input className="dca-input" type="number" value={p.baseAmount??10} onChange={e=>setP('baseAmount',parseFloat(e.target.value)||0)}/><span className="dca-input-sfx">USDT</span></div></div>
          <div className="dca-form-group"><label>Fréquence *</label><select className="dca-select" value={p.frequency||'day'} onChange={e=>setP('frequency',e.target.value)}><option value="day">Tous les jours</option><option value="week">Toutes les semaines</option><option value="month">Tous les mois</option></select></div>
        </div>
        {breakeven>0 && <div style={{fontSize:'.6rem',color:'var(--muted)',marginTop:2}}>Breakeven : <b style={{color:'var(--gold)'}}>{fmt(breakeven)}</b> — référence des prix cibles</div>}
      </div>

      {/* Zones unifiées */}
      <div className="dca-card">
        <div className="dca-card-title" style={{marginBottom:8}}>
          Zones de stratégie <span className="dca-tag dca-tag-req">min. 1 zone profit</span>
        </div>
        <div style={{display:'flex',gap:16,fontSize:'.58rem',marginBottom:10,lineHeight:1.8}}>
          <span><span style={{color:'var(--green)'}}>●</span> <b>Accumulation</b> : cours ≤ breakeven + écart → USDT à injecter</span>
          <span><span style={{color:'var(--gold)'}}>●</span> <b>Ralentissement</b> : cours au-dessus → USDT réduit</span>
          <span><span style={{color:'var(--red)'}}>●</span> <b>Profit</b> : vente → % de la position</span>
        </div>

        <table className="dca-ptbl">
          <thead>
            <tr>
              <th style={{width:10}}/>
              <th>Type</th>
              <th>Nom</th>
              <th>Écart vs breakeven</th>
              <th>Action</th>
              <th>Prix cible</th>
              <th style={{width:22}}/>
            </tr>
          </thead>
          <tbody>
            {zones.map((z,i) => {
              const ecartNum    = parseFloat(z.ecart)||0
              const isProfit    = z.type==='profit'
              const targetPrice = breakeven>0 ? breakeven*(1+ecartNum/100) : null
              const unitLabel   = isProfit ? '%' : 'USDT'
              const sign        = ecartNum>=0 ? '+' : ''
              const typeColor   = TYPE_COLORS[z.type] || 'var(--text)'
              return (
                <tr key={i}>
                  <td><span className="dca-zdot" style={{background:z.color||'var(--muted)'}}/></td>
                  <td>
                    <select className="dca-pi" value={z.type} style={{width:110,color:typeColor}}
                      onChange={e=>{
                        const nCol = e.target.value==='accum'?'#3dbf90':e.target.value==='ralent'?'#c8a020':'#E24B4A'
                        updateZone(i,'type',e.target.value); updateZone(i,'color',nCol)
                      }}>
                      <option value="accum">Accumulation</option>
                      <option value="ralent">Ralentissement</option>
                      <option value="profit">Prise de profit</option>
                    </select>
                  </td>
                  <td><input className="dca-pi" value={z.label||''} style={{width:90}} onChange={e=>updateZone(i,'label',e.target.value)}/></td>
                  <td>
                    <div className="dca-pi-group">
                      <input className="dca-pi" type="number" step="any" value={z.ecart??''} style={{width:60}}
                        onChange={e=>updateZone(i,'ecart',e.target.value)}
                        onBlur={sortZones}
                        placeholder={isProfit?'+20':'-10'}/>
                      <span className="dca-pi-sfx">%</span>
                    </div>
                  </td>
                  <td>
                    <div className="dca-pi-group">
                      <input className="dca-pi" type="number" step="any" value={z.action??''} style={{width:60,borderColor:isProfit&&parseFloat(z.action)>100?'var(--red)':undefined}} onChange={e=>updateZone(i,'action',e.target.value)} placeholder={isProfit?'25':'10'}/>
                      <span className="dca-pi-sfx">{unitLabel}</span>
                    </div>
                  </td>
                  <td>
                    <span className="dca-price-hint">
                      {targetPrice ? `${sign}${ecartNum}% → ${fmt(targetPrice)}` : '—'}
                    </span>
                  </td>
                  <td><button className="dca-del-btn" onClick={()=>removeZone(i)}>×</button></td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Boutons ajouter par type */}
        <div style={{display:'flex',gap:8,marginTop:8,paddingTop:8,borderTop:'0.5px solid rgba(26,48,80,.5)'}}>
          {[['accum','+ Accumulation','#3dbf90'],['ralent','+ Ralentissement','#c8a020'],['profit','+ Profit','#E24B4A']].map(([type,lbl,col])=>(
            <button key={type} className="dca-add-row" style={{border:`1px solid ${col}`,borderRadius:6,padding:'3px 10px',color:col,fontSize:'.58rem',cursor:'pointer',background:'none',flex:1,justifyContent:'center'}} onClick={()=>addZone(type)}>{lbl}</button>
          ))}
        </div>

        {/* Warnings profit */}
        {profitOver && <div className="dca-banner dca-banner-danger" style={{marginTop:8}}>Total profits {profitTotal.toFixed(0)}% dépasse 100% — réduisez les pourcentages.</div>}
        {profitPartial && <div className="dca-banner dca-banner-warn" style={{marginTop:8}}>Profits partiels — {profitTotal.toFixed(0)}% vendus au total, {(100-profitTotal).toFixed(0)}% de position conservée.</div>}
        {profitHasEmpty && <div className="dca-banner dca-banner-danger" style={{marginTop:8}}>Renseignez le % de position vendu pour chaque zone de profit.</div>}
      </div>

      <div className="dca-btm">
        <button className="dca-btn dca-btn-ghost" onClick={onBack}>← Retour</button>
        <span className="dca-step-hint">Étape 3 / 3</span>
        <button className="dca-btn dca-btn-success" disabled={!canSubmit||saving} onClick={()=>setShowConfirm(true)}>Créer le plan DCA ✓</button>
      </div>
    </div>
  )
}

/* ═══ DASHBOARD ═══════════════════════════════════════════════════════════ */
function DcaDashboard({ plan, rawRows, prices, onBack, onRefresh }) {
  const [showCal,     setShowCal]     = useState(false)
  const [showEntry,   setShowEntry]   = useState(false)
  const [savedMsg,    setSavedMsg]    = useState('')
  const [manualPrice, setManualPrice] = useState('')
  const [openTip,     setOpenTip]     = useState(null)

  const effectivePair = plan.pair || ''
  const freqLabel     = PERIOD_LABEL[plan.frequency||'day'] || 'jour'
  const allZones      = useMemo(() => {
    if (plan.zones?.length) return plan.zones
    // Migration depuis ancien format
    const z = []
    ;(plan.accZones||[]).forEach(x => z.push({type:'accum', label:x.label, ecart:String(x.ecartMin||0), action:String(x.amount||10), color:'#3dbf90'}))
    ;(plan.debtZones||[]).forEach(x => z.push({type:'ralent', label:x.label, ecart:String(x.ecartThreshold||0), action:String(x.debtPct||50), color:'#c8a020'}))
    ;(plan.profitZones||[]).forEach(x => z.push({type:'profit', label:x.label, ecart:String(x.ecartThreshold||25), action:String(x.positionPct||25), color:'#E24B4A'}))
    return z.length ? z : DEFAULT_ZONES
  }, [plan])

  const ops = useMemo(() => filterOpsForPlan(rawRows, effectivePair, plan.startDate, plan.endDate), [rawRows, effectivePair, plan.startDate, plan.endDate])

  // Ops du plan : planId en col 8, avec fallback sur plan.pointedOps pour les anciens plans
  const pointedOps = useMemo(() => {
    const byPlanId = ops.filter(o => o.planId && o.planId === plan.id)
    if (byPlanId.length > 0) return byPlanId
    // Fallback : plan.pointedOps (clés getOpKey) pour la migration
    const legacy = plan.pointedOps || []
    return ops.filter((o, i) => legacy.includes(getOpKey(o, i)))
  }, [ops, plan.id, plan.pointedOps])

  const breakeven    = useMemo(() => computeBreakeven(pointedOps),          [pointedOps])
  const rechargement = useMemo(() => computeRechargement(plan, pointedOps), [plan, pointedOps])

  // currentPrice réactif — se met à jour dès que prices ou manualPrice change
  const currentPrice = useMemo(() =>
    prices[effectivePair] || (manualPrice ? parseFloat(manualPrice) : null)
  , [prices, effectivePair, manualPrice])

  const signal  = useMemo(() => computeSignal(plan, currentPrice, breakeven, rechargement), [plan, currentPrice, breakeven, rechargement])
  const delta   = useMemo(() => currentPrice && breakeven ? (currentPrice - breakeven) / breakeven * 100 : null, [currentPrice, breakeven])

  const buys    = useMemo(() => pointedOps.filter(o => o.sens==='Achat' && o.exec), [pointedOps])
  const sells   = useMemo(() => pointedOps.filter(o => o.sens==='Vente' && o.exec), [pointedOps])

  const totalInvested = useMemo(() => buys.reduce((s,o)=>s+o.usdt,0),  [buys])
  const totalSold     = useMemo(() => sells.reduce((s,o)=>s+o.usdt,0), [sells])
  const totalVolBuy   = useMemo(() => buys.reduce((s,o)=>s+(o.vol||0),0),  [buys])
  const totalVolSold  = useMemo(() => sells.reduce((s,o)=>s+(o.vol||0),0), [sells])
  const avgBuyPrice   = useMemo(() => computeAvgPrice(pointedOps), [pointedOps])
  const avgSellPrice  = useMemo(() =>
    totalVolSold > 0 ? totalSold / totalVolSold : 0
  , [totalSold, totalVolSold])

  const position  = useMemo(() => totalVolBuy - totalVolSold, [totalVolBuy, totalVolSold])
  const pnlLatent = useMemo(() =>
    currentPrice && position > 0 && breakeven > 0
      ? position * (currentPrice - breakeven)
      : null   // null → afficher '—' plutôt que 0
  , [currentPrice, position, breakeven])

  const cyclePeriod  = getCurrentPeriodOps(plan, pointedOps)
  const timeline     = useMemo(() => generateTimeline(plan, pointedOps, 15), [plan, pointedOps])
  const missedCount  = timeline.filter(t=>t.type==='missed').length

  const calDays = useMemo(() => {
    const now=new Date(), y=now.getFullYear(), m=now.getMonth()
    const first=new Date(y,m,1), last=new Date(y,m+1,0), days=[]
    for(let i=0;i<(first.getDay()+6)%7;i++) days.push(null)
    for(let d=1;d<=last.getDate();d++) {
      const day=new Date(y,m,d)
      const slot=timeline.find(t=>t.date&&t.date.toDateString()===day.toDateString())
      days.push({day:d,slot,isToday:d===now.getDate()})
    }
    return days
  }, [timeline])

  // Seuil bull run = écart de la 1ère zone profit
  const bull = useMemo(() => {
    const profitEcarts = allZones.filter(z=>z.type==='profit').map(z=>parseFloat(z.ecart)||0)
    return profitEcarts.length > 0 ? Math.min(...profitEcarts) : 25
  }, [allZones])
  const MIN_D=-25, MAX_D=bull*1.5
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
  function tlLabel(slot) { if (!slot||slot.type==='future') return '·'; if (slot.type==='missed') return '–'; if (slot.type==='sell') return '↓'; return '●' }
  function tlTip(slot) {
    const d=slot?.date?.toLocaleDateString('fr-FR')||'—'
    if (!slot||slot.type==='future') return 'Période future'
    if (slot.type==='missed') return `${d} : Manqué`
    if (slot.type==='sell') return `${d} : Vente`
    return `${d} : Acheté ${slot.amount?.toFixed(2)||'?'} USDT (${slot.pct||0}%)`
  }

  function onSaved() { setShowEntry(false); setSavedMsg('✓ Entrée ajoutée — données mises à jour.'); setTimeout(()=>setSavedMsg(''),4000); onRefresh?.() }

  return (
    <div className="dca-scroll">
      {savedMsg && <div className="dca-banner dca-banner-success">{savedMsg}</div>}

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="dca-hero">
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12,flexWrap:'wrap',gap:8}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <button className="dca-back-btn" onClick={onBack} style={{padding:'3px 10px',border:'0.5px solid var(--border)',borderRadius:6,fontSize:'.58rem',background:'none',color:'var(--muted)',cursor:'pointer',fontFamily:'inherit'}}>← Plans</button>
            <span style={{fontFamily:"'Space Mono',monospace",fontWeight:'700',fontSize:'.8rem',color:'var(--text)'}}>{effectivePair}</span>
            <span style={{fontSize:'.56rem',color:'var(--muted)'}}>
              {plan.baseAmount} USDT/{freqLabel}
              {plan.startDate?` · depuis ${new Date(plan.startDate).toLocaleDateString('fr-FR')}`:''} · {buys.length} achats
            </span>
          </div>
          <div style={{fontSize:'.52rem',color:'var(--green)'}}>● Actif</div>
        </div>

        <div className="dca-hero-prices">
          <div className="dca-hero-block">
            <div className="dca-hero-lbl">
              Breakeven
              <KpiTooltip id="dca-be" title="Breakeven" description="Coût de revient net : prix auquel la position est à l'équilibre après toutes les ventes partielles." formula="(Σ achats − Σ recettes ventes) / volume net" openId={openTip} setOpenId={setOpenTip}/>
            </div>
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

        <div className="dca-zone-bar-wrap" style={{marginTop:14}}>
          <div className="dca-zone-bar">
            <div className="dca-zone-seg z4">100%</div><div className="dca-zone-seg z3">75%</div>
            <div className="dca-zone-seg z2">50%</div><div className="dca-zone-seg z1">25%</div>
            <div className="dca-zone-seg z0">Vente</div>
            <div className="dca-zone-needle" style={{left:`${needlePct}%`}}/>
          </div>
          <div className="dca-zone-labels"><span>&lt; 0%</span><span>0–5%</span><span>5–10%</span><span>10–{bull}%</span><span>&gt; {bull}% profit</span></div>
        </div>
      </div>

      {/* ── Signal ────────────────────────────────────────────────────────── */}
      <div className={`dca-signal ${signalClass()}`}>
        <div style={{display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}}>

          {/* Label zone */}
          <div style={{flex:1,minWidth:160}}>
            <div className="dca-signal-title">{signal.label}</div>
            {(cyclePeriod.totalBought>0 || cyclePeriod.totalSold>0) && (
              <div style={{display:'flex',gap:10,marginTop:5,fontSize:'.58rem',opacity:.75}}>
                {cyclePeriod.totalBought>0 && <span>Achats <b>${cyclePeriod.totalBought.toFixed(0)}</b></span>}
                {cyclePeriod.totalSold>0   && <span>Ventes <b>${cyclePeriod.totalSold.toFixed(0)}</b></span>}
                {signal.deployAmount>0&&signal.action!=='sell'&&cyclePeriod.totalBought<signal.deployAmount && (
                  <span>Reste <b>${Math.max(0,signal.deployAmount-cyclePeriod.totalBought).toFixed(0)}</b></span>
                )}
              </div>
            )}
          </div>

          {/* Séparateur */}
          <div style={{width:'0.5px',height:36,background:'rgba(255,255,255,.12)',flexShrink:0}}/>

          {/* Montant à déployer */}
          {signal.action==='sell' ? (
            <div style={{textAlign:'right'}}>
              <div className="dca-signal-amt">Vendre {signal.sellPct}%</div>
              <div className="dca-signal-amt-lbl">de la position</div>
            </div>
          ) : signal.deployAmount>0 ? (
            <div style={{textAlign:'right'}}>
              <div className="dca-signal-amt">{signal.deployAmount.toFixed(2)} <span style={{fontSize:'.65em',opacity:.7}}>USDT</span></div>
              <div className="dca-signal-amt-lbl">cycle du {cyclePeriod.periodStart?.toLocaleDateString('fr-FR')||'—'}</div>
            </div>
          ) : (
            <div style={{fontSize:'.62rem',opacity:.6,fontStyle:'italic'}}>Aucune action ce cycle</div>
          )}

          {/* Bouton */}
          {signal.action!=='sell' && (
            <button className="dca-btn dca-btn-primary" style={{fontSize:'.62rem',padding:'7px 14px',whiteSpace:'nowrap',flexShrink:0}} onClick={()=>setShowEntry(true)}>
              + Journal
            </button>
          )}
        </div>
      </div>

      {/* ── KPIs : PnL latent | Total investi | Total réalisé | Solde rechargement ── */}
      <div className="dca-kpi-grid" style={{gridTemplateColumns:'repeat(4,1fr)'}}>

        {/* 1. PnL latent */}
        <div className="dca-kpi">
          <div className="dca-kpi-val" style={{color:pnlLatent>=0?'var(--green)':'var(--red)'}}>{pnlLatent!=null?(pnlLatent>=0?'+':'')+fmt(pnlLatent,2):'—'}</div>
          <div className="dca-kpi-lbl">
            PnL latent
            <KpiTooltip id="dca-pnl" title="PnL latent" description="Gain ou perte non réalisée sur la position ouverte, calculée par rapport au breakeven." formula="Position × (cours actuel − breakeven)" openId={openTip} setOpenId={setOpenTip}/>
          </div>
          <div className="dca-kpi-sub">{delta!=null?pct(delta)+' vs breakeven':currentPrice?'cours chargé':'cours manquant'}</div>
        </div>

        {/* 2. Total investi + prix moyen d'achat */}
        <div className="dca-kpi">
          <div className="dca-kpi-val">{totalInvested>0?`$${totalInvested.toFixed(0)}`:'—'}</div>
          <div className="dca-kpi-lbl">
            Total investi
            <KpiTooltip id="dca-invested" title="Total investi" description="Somme de tous les achats exécutés pointés dans ce plan DCA." formula={`Σ montants USDT des ${buys.length} achats`} openId={openTip} setOpenId={setOpenTip}/>
          </div>
          <div className="dca-kpi-sub">{buys.length} achats pointés</div>
          {avgBuyPrice>0 && (
            <div style={{marginTop:6,paddingTop:6,borderTop:'0.5px solid var(--border)'}}>
              <div style={{fontFamily:"'Space Mono',monospace",fontWeight:'700',fontSize:'.7rem',color:'var(--text)'}}>{fmt(avgBuyPrice)}</div>
              <div className="dca-kpi-lbl" style={{fontSize:'.5rem',marginTop:2}}>
                Prix moy. d'achat
                <KpiTooltip id="dca-avgbuy" title="Prix moyen d'achat" description="Prix moyen pondéré par le volume de toutes les positions d'achat pointées." formula="Σ(montant) / Σ(volume)" openId={openTip} setOpenId={setOpenTip}/>
              </div>
            </div>
          )}
        </div>

        {/* 3. Total réalisé + prix moyen de vente */}
        <div className="dca-kpi">
          <div className="dca-kpi-val" style={{color:totalSold>0?'var(--green)':'var(--muted)'}}>{totalSold>0?`$${totalSold.toFixed(0)}`:'—'}</div>
          <div className="dca-kpi-lbl">
            Total réalisé
            <KpiTooltip id="dca-sold" title="Total réalisé" description="Somme des ventes exécutées dans ce plan DCA." formula={`Σ montants USDT des ${sells.length} vente${sells.length!==1?'s':''}`} openId={openTip} setOpenId={setOpenTip}/>
          </div>
          <div className="dca-kpi-sub">{sells.length} vente{sells.length!==1?'s':''} exécutée{sells.length!==1?'s':''}</div>
          {avgSellPrice>0 && (
            <div style={{marginTop:6,paddingTop:6,borderTop:'0.5px solid var(--border)'}}>
              <div style={{fontFamily:"'Space Mono',monospace",fontWeight:'700',fontSize:'.7rem',color:'var(--text)'}}>{fmt(avgSellPrice)}</div>
              <div className="dca-kpi-lbl" style={{fontSize:'.5rem',marginTop:2}}>
                Prix moy. de vente
                <KpiTooltip id="dca-avgsell" title="Prix moyen de vente" description="Prix moyen pondéré par le volume de toutes les ventes exécutées pointées." formula="Σ(montant vendu) / Σ(volume vendu)" openId={openTip} setOpenId={setOpenTip}/>
              </div>
            </div>
          )}
        </div>

        {/* 4. Solde rechargement */}
        <div className="dca-kpi">
          <div className="dca-kpi-val" style={{color:rechargement.total>0?'var(--gold)':rechargement.total<0?'var(--green)':'var(--muted)'}}>
            {rechargement.total>=0?'+':''}{rechargement.total.toFixed(0)} USDT
          </div>
          <div className="dca-kpi-lbl">
            Solde rechargement
            <KpiTooltip id="dca-rech" title="Solde de rechargement" description={`Cumul cycle par cycle de la différence entre le montant de base (${plan.baseAmount} USDT) et le montant réellement injecté. Positif = capital à redéployer. Négatif = sur-investissement.`} formula={`Σ (${plan.baseAmount} USDT − injecté) par cycle`} openId={openTip} setOpenId={setOpenTip}/>
          </div>
          <div className="dca-kpi-sub">
            {rechargement.missed} cycle{rechargement.missed!==1?'s':''} incomplet{rechargement.missed!==1?'s':''}
          </div>
        </div>

      </div>

      {/* ── Zones de stratégie ────────────────────────────────────────────── */}
      {(() => {
        const sorted = [...allZones].sort((a,b)=>(parseFloat(a.ecart??a.ecartThreshold??a.ecartMin??0)||0)-(parseFloat(b.ecart??b.ecartThreshold??b.ecartMin??0)||0))
        // Trouver la zone active (la plus haute dont le seuil est atteint côté achat,
        // ou la plus basse côté profit atteint)
        let activeIdx = -1
        if (delta != null) {
          // Zone active = la plus précise correspondant à delta
          // Pour accum/ralent : la zone dont l'écart est >= delta (zone d'achat courante)
          // Pour profit : la première zone profit déclenchée
          const profitIdx = sorted.findIndex(z => z.type==='profit' && delta >= (parseFloat(z.ecart??z.ecartThreshold??0)||0))
          if (profitIdx >= 0) {
            // Prendre la dernière zone profit atteinte
            activeIdx = sorted.reduce((best, z, i) => {
              if (z.type==='profit' && delta >= (parseFloat(z.ecart??z.ecartThreshold??0)||0)) return i
              return best
            }, profitIdx)
          } else {
            // Zone d'achat : la plus haute dont ecart >= delta
            activeIdx = sorted.reduce((best, z, i) => {
              const e = parseFloat(z.ecart??z.ecartThreshold??z.ecartMin??0)||0
              if (z.type!=='profit' && delta <= e) return i
              return best
            }, -1)
            // Si aucune trouvée côté achat, prendre la plus basse
            if (activeIdx < 0) activeIdx = sorted.findIndex(z=>z.type!=='profit')
          }
        }
        // Afficher : zone active + voisines immédiates (idx-1, idx, idx+1)
        const lo   = activeIdx > 0 ? activeIdx - 1 : 0
        const hi   = activeIdx >= 0 ? Math.min(activeIdx + 1, sorted.length - 1) : Math.min(1, sorted.length - 1)
        const visible = new Set([lo, activeIdx >= 0 ? activeIdx : 0, hi])
        return (
          <div className="dca-card">
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
              <div className="dca-card-title" style={{marginBottom:0}}>
                Zones de stratégie
                <KpiTooltip id="dca-zones" title="Zones de stratégie" description="Accum. : cours sous le breakeven → injecter le montant USDT défini. Ralent. : cours légèrement au-dessus → injecter un montant réduit. Profit : cours au-delà du seuil → vendre le % de position défini." openId={openTip} setOpenId={setOpenTip}/>
              </div>
              <button
                onClick={()=>setOpenTip(openTip==='dca-zones-expand'?null:'dca-zones-expand')}
                style={{background:'none',border:'none',cursor:'pointer',fontSize:'.75rem',color:'var(--muted)',padding:'2px 6px',borderRadius:4,lineHeight:1}}
                title={openTip==='dca-zones-expand'?'Réduire':'Tout afficher'}
              >
                {openTip==='dca-zones-expand'?'▲':'▼'}
              </button>
            </div>

            {sorted.map((z, i) => {
              const ecartNum  = parseFloat(z.ecart??z.ecartThreshold??z.ecartMin??0)||0
              const isProfit  = z.type==='profit'
              const isSlow    = z.type==='ralent'||z.type==='slow'
              const actionVal = z.action??z.amount??z.positionPct??z.debtPct??''
              const tp        = breakeven>0 ? breakeven*(1+ecartNum/100) : null
              const isActive  = i === activeIdx
              const col       = z.color||(isProfit?'#E24B4A':isSlow?'#c8a020':'#3dbf90')
              const isShown   = openTip==='dca-zones-expand' || visible.has(i)
              if (!isShown) return null
              return (
                <div key={i} className={`dca-pal-row${isActive?(isProfit?' active-profit':' active-debt'):''}`}
                  style={{opacity: isActive ? 1 : openTip==='dca-zones-expand' ? 0.7 : 0.55}}>
                  <span className="dca-zdot" style={{background:col}}/>
                  <span className="dca-pal-lbl" style={{color: isActive ? (TYPE_COLORS[z.type]||'var(--text)') : 'var(--text2)', fontWeight: isActive ? '600' : '400'}}>
                    {z.label}
                    {isActive && <span style={{marginLeft:6,fontSize:'.5rem',fontWeight:'400',color:'var(--muted)'}}>← position actuelle</span>}
                  </span>
                  <span style={{fontSize:'.58rem',color:'var(--muted)',minWidth:36,textAlign:'center'}}>{ecartNum>=0?'+':''}{ecartNum}%</span>
                  <span className="dca-pal-price">{tp?fmt(tp):'—'}</span>
                  <span className="dca-pal-action">
                    {isProfit?`${actionVal}% pos.`:`${actionVal} USDT`}
                  </span>
                </div>
              )
            })}


          </div>
        )
      })()}

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
            <div key={i} className={`dca-tc ${tlClass(slot)}${i===timeline.length-1?' tc-today':''}`} data-tip={tlTip(slot)}>{tlLabel(slot)}</div>
          ))}
          {Array.from({length:Math.max(0,15-timeline.length)}).map((_,i)=>(
            <div key={`e${i}`} className="dca-tc tc-sk" data-tip="Aucune donnée">·</div>
          ))}
        </div>

        <div className="dca-add-row" style={{cursor:'pointer',userSelect:'none'}} onClick={()=>setShowCal(v=>!v)}>
          <span style={{fontSize:'.75rem'}}>📅</span>
          <span>{showCal?'Masquer le calendrier':'Afficher le calendrier mensuel'}</span>
        </div>

        {showCal && (
          <div style={{marginTop:10}}>
            <div style={{fontSize:'.58rem',fontWeight:'500',color:'var(--text2)',marginBottom:6}}>{new Date().toLocaleDateString('fr-FR',{month:'long',year:'numeric'})}</div>
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


      </div>

      <div style={{height:16}}/>

      {showEntry && (
        <EntryForm onClose={()=>setShowEntry(false)} onSaved={onSaved} defaultPaire={effectivePair} activePlanId={plan.id}/>
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

  const [wizardErr, setWizardErr] = useState('')
  // Générer un planId stable dès le wizard (utilisé dès l'étape de pointage)
  function newPlanId(pair) {
    return `${(pair||'unknown').replace(/\//g,'_')}_${Date.now()}`
  }
  const INIT_WIZARD = () => ({
    pair: pairList[0]?.name||'', customPair:'', startDate:'', endDate:'',
    pointedOps: undefined,
    planId: newPlanId(pairList[0]?.name||'plan'),
    params: { baseAmount:10, frequency:'day', zones:[...DEFAULT_ZONES] }
  })
  const [wizard, setWizard] = useState(INIT_WIZARD)

  useEffect(() => {
    Promise.all([getDcaPlans(), getDcaTemplates()])
      .then(([p, t]) => { setPlans(p); setTemplates(t) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  function openPlan(plan) { setCurrentPlan(plan); setScreen('dashboard') }
  function startNewWizard() { setWizard(INIT_WIZARD()); setCurrentPlan(null); setScreen(1) }
  async function deletePlan(id) {
    await deleteDcaPlan(id)
    setPlans(p => p.filter(x => x.id !== id))
    await unAssignPlanOps(id)
  }
  async function deleteTemplate(id) { await deleteDcaTemplate(id); setTemplates(t=>t.filter(x=>x.id!==id)) }

  async function saveTemplate(name) {
    // Empêcher les doublons de nom
    if (templates.some(t => t.name.trim().toLowerCase() === name.trim().toLowerCase())) {
      return  // doublon géré dans l'UI Step3
    }
    const p = wizard.params || {}
    const tpl = { name, baseAmount: p.baseAmount??10, frequency: p.frequency??'day', zones: p.zones||DEFAULT_ZONES }
    const id = await saveDcaTemplate(tpl)
    setTemplates(prev => { const ex=prev.find(t=>t.id===id); return ex?prev.map(t=>t.id===id?{...tpl,id}:t):[...prev,{...tpl,id}] })
  }

  function loadTemplate(tpl) {
    setWizard(w => ({
      ...w,
      params: { baseAmount: tpl.baseAmount, frequency: tpl.frequency, zones: tpl.zones||DEFAULT_ZONES }
    }))
  }

  function step1Next() {
    const pair = wizard.pair==='NEW' ? wizard.customPair : wizard.pair
    if (plans.some(p => p.pair === pair)) {
      setWizardErr(`Un plan DCA existe déjà pour ${pair}. Supprimez-le avant d'en créer un nouveau.`)
      return
    }
    setWizardErr('')
    const hasOps = rawRows.some(r=>r.pair===pair&&r.exec)
    setScreen(hasOps ? 2 : 3)
  }

  // Affecte/retire le planId (col 8) sur les lignes du journal correspondantes
  async function step2AssignPlan(ops, pointed, planId) {
    try {
      const snap = await loadSnapshot()
      if (!snap?.rows) return
      const rows = snap.rows.map(r => [...r])
      let changed = false

      for (let i = 0; i < ops.length; i++) {
        const op        = ops[i]
        const isPointed = pointed.includes(getOpKey(op, i))

        const rowIdx = rows.findIndex((r, ri) => {
          if (ri === 0) return false
          if (!r[1]) return false
          if (normPair(String(r[1]||'').trim()) !== op.pair) return false
          const snapDate = parseDate(r[0])
          if (!snapDate || !op.date) return false
          if (Math.abs(snapDate.getTime() - op.date.getTime()) > 86400000 * 1.5) return false
          const snapAmt = (parseFloat(r[5])||0) || (parseFloat(r[6])||0) || (parseFloat(r[7])||0)
          return op.usdt > 0 ? Math.abs(snapAmt - op.usdt) < 0.10 : true
        })

        if (rowIdx < 0) continue
        while (rows[rowIdx].length <= 12) rows[rowIdx].push('')
        const currentPlanId = String(rows[rowIdx][8] || '')

        if (isPointed && currentPlanId !== planId) {
          rows[rowIdx][8] = planId   // col 8 = planId
          changed = true
        } else if (!isPointed && currentPlanId === planId) {
          rows[rowIdx][8] = ''       // retirer l'affectation
          changed = true
        }
      }

      if (changed) await saveSnapshot(rows, snap.source)
    } catch(e) {
      console.warn('step2AssignPlan error:', e)
    }
  }

  // Efface le planId (col 8) de toutes les lignes liées à ce plan
  async function unAssignPlanOps(planId) {
    try {
      const snap = await loadSnapshot()
      if (!snap?.rows) return
      const rows = snap.rows.map(r => [...r])
      let changed = false
      for (let ri = 1; ri < rows.length; ri++) {
        while (rows[ri].length <= 8) rows[ri].push('')
        if (String(rows[ri][8] || '') === planId) {
          rows[ri][8] = ''
          changed = true
        }
      }
      if (changed) await saveSnapshot(rows, snap.source)
    } catch(e) { console.warn('unAssignPlanOps error:', e) }
  }

  async function step3Save() {
    setSaving(true)
    try {
      const pair = wizard.pair==='NEW' ? wizard.customPair : wizard.pair
      const ops  = filterOpsForPlan(rawRows, pair, wizard.startDate, wizard.endDate)
      const pointed = wizard.pointedOps||[]
      const pOps = ops.filter((op,i)=>pointed.includes(getOpKey(op,i)))
      const firstDate = pOps.filter(o=>o.sens==='Achat'&&o.date).sort((a,b)=>a.date-b.date)[0]?.date
      const startDate = wizard.startDate || (firstDate?firstDate.toISOString().split('T')[0]:'')
      const p = wizard.params||{}
      const planData = {
        id: wizard.planId || newPlanId(pair),  // id stable depuis le début du wizard
        pair, startDate, endDate: wizard.endDate||null,
        baseAmount: p.baseAmount??10,
        frequency:  p.frequency??'day',
        zones:      p.zones||DEFAULT_ZONES,
      }
      const id   = await saveDcaPlan(planData)
      const saved = {...planData, id}
      setCurrentPlan(saved)
      setPlans(prev => { const ex=prev.find(x=>x.id===id); return ex?prev.map(x=>x.id===id?saved:x):[...prev,saved] })
      setScreen('dashboard')
    } catch(e) { console.error('step3Save:', e) }
    finally { setSaving(false) }
  }

  return (
    <div className="dca-page">
      {screen==='list'      && <DcaList plans={plans} loading={loading} onNew={startNewWizard} onOpen={openPlan} onDelete={deletePlan} templates={templates} onDeleteTpl={deleteTemplate}/>}
      {screen===1           && <Step1 wizard={wizard} setWizard={setWizard} pairList={pairList} rawRows={rawRows} onNext={step1Next} onBack={()=>setScreen('list')} wizardErr={wizardErr}/>}
      {screen===2           && <Step2 wizard={wizard} setWizard={setWizard} rawRows={rawRows} onNext={()=>setScreen(3)} onBack={()=>setScreen(1)} onFlagOps={(ops,pointed)=>step2AssignPlan(ops,pointed,wizard.planId)}/>}
      {screen===3           && <Step3 wizard={wizard} setWizard={setWizard} rawRows={rawRows} onNext={step3Save} onBack={()=>setScreen(2)} saving={saving} templates={templates} onSaveTpl={saveTemplate} onLoadTpl={loadTemplate}/>}
      {screen==='dashboard' && currentPlan && <DcaDashboard plan={currentPlan} rawRows={rawRows} prices={prices} onBack={()=>setScreen('list')} onRefresh={onRefresh}/>}
    </div>
  )
}
