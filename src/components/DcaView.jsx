/**
 * DcaView.jsx — Scaled Mirror DCA — POC complet
 * Écrans : Liste → Étape 1 → Étape 2 → Étape 3 → Dashboard
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import '../styles/dca.css'
import { getDcaPlans, saveDcaPlan, deleteDcaPlan } from '../lib/dcaRepository.js'
import { computeAvgPrice, computeDebt, computeSignal } from '../hooks/useDcaStrategy.js'

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
  { label: 'Palier 1', ecartThreshold: 20,  positionPct: 5  },
  { label: 'Palier 2', ecartThreshold: 50,  positionPct: 10 },
  { label: 'Palier 3', ecartThreshold: 100, positionPct: 15 },
  { label: 'Palier 4', ecartThreshold: 200, positionPct: 25 },
  { label: 'Palier 5', ecartThreshold: 400, positionPct: 30 },
]
const ZONE_COLORS = { acc: ['#3dbf90','#2a9d70','#c8a020','#d4720a'], debt: ['#85B7EB','#378ADD'], profit: ['#F7C1C1','#F09595','#E24B4A','#A32D2D','#501313'] }

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function fmt(v, decimals = 0) {
  if (v == null || isNaN(v)) return '—'
  return '$' + Number(v).toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}
function pct(v) { return v == null ? '—' : (v >= 0 ? '+' : '') + v.toFixed(2) + '%' }

function isoToDate(s) { try { return s ? new Date(s) : null } catch { return null } }

function filterOpsForPlan(rawRows, pair, startDate, endDate) {
  if (!rawRows || !rawRows.length) return []
  const start = isoToDate(startDate)
  const end   = endDate ? isoToDate(endDate) : new Date()
  return rawRows.filter(r => {
    if (!r.exec) return false
    if (r.pair !== pair) return false
    if (start && r.date && r.date < start) return false
    if (end   && r.date && r.date > end)   return false
    return true
  })
}

function getOpKey(op, idx) { return `${op.date?.toISOString?.() || idx}_${idx}` }

/* ── Stepper ─────────────────────────────────────────────────────────────── */
function Stepper({ step }) {
  const steps = [['Paire', '& période'], ['Pointage', 'opérations'], ['Paramètres', 'stratégie'], ['Dashboard', 'de suivi']]
  return (
    <div className="dca-stepper">
      {steps.map(([label, sub], i) => {
        const done   = i + 1 < step
        const active = i + 1 === step
        return (
          <>
            <div key={i} className={`dca-step${active ? ' active' : done ? ' done' : ''}`}>
              <div className="dca-step-circle">{done ? '✓' : i + 1}</div>
              <div className="dca-step-text">{label}<br />{sub}</div>
            </div>
            {i < steps.length - 1 && <div key={`l${i}`} className={`dca-step-line${done ? ' done' : ''}`} />}
          </>
        )
      })}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   SCREEN 0 — Liste des plans
   ═══════════════════════════════════════════════════════════════════════════ */
function DcaList({ onNew, onOpen, plans, loading, onDelete }) {
  const [confirm, setConfirm] = useState(null)

  function handleDelete(e, id) {
    e.stopPropagation()
    setConfirm(id)
  }
  async function confirmDelete(id) {
    await onDelete(id)
    setConfirm(null)
  }

  function iconClass(pair) {
    if (pair.startsWith('BTC')) return 'dca-plan-icon dca-plan-icon-btc'
    if (pair.startsWith('ETH')) return 'dca-plan-icon dca-plan-icon-eth'
    return 'dca-plan-icon dca-plan-icon-def'
  }
  function iconLabel(pair) { return pair.split('/')[0].slice(0, 3) }

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
          <div className={iconClass(plan.pair)}>{iconLabel(plan.pair)}</div>
          <div className="dca-plan-info">
            <div className="dca-plan-pair">{plan.pair}</div>
            <div className="dca-plan-meta">
              {plan.baseAmount} USDT/{plan.frequency === 'day' ? 'jour' : plan.frequency === 'week' ? 'sem.' : 'mois'}
              {' · '}{plan.startDate ? `depuis ${new Date(plan.startDate).toLocaleDateString('fr-FR')}` : ''}
            </div>
          </div>
          <div className="dca-plan-right">
            <div className="dca-plan-status dca-status-acc">Accumulation</div>
          </div>
          <button className="dca-plan-del-btn" onClick={e => handleDelete(e, plan.id)} title="Supprimer le plan">✕</button>
        </div>
      ))}

      {confirm && (
        <div className="dca-banner dca-banner-danger" style={{ marginTop: 8 }}>
          Supprimer ce plan ? Les lignes du journal <b>ne seront pas modifiées</b>.{' '}
          <button className="dca-btn" style={{ marginLeft: 8, padding: '3px 10px', fontSize: '.6rem' }} onClick={() => confirmDelete(confirm)}>Confirmer</button>
          <button className="dca-btn dca-btn-ghost" style={{ marginLeft: 4, padding: '3px 8px', fontSize: '.6rem' }} onClick={() => setConfirm(null)}>Annuler</button>
        </div>
      )}

      <div className="dca-banner dca-banner-info" style={{ marginTop: 8 }}>
        La suppression d'un plan efface uniquement la configuration DCA — les lignes du journal ne sont pas modifiées.
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   STEP 1 — Paire & Période
   ═══════════════════════════════════════════════════════════════════════════ */
function Step1({ wizard, setWizard, pairList, rawRows, onNext, onBack }) {
  const pairs     = pairList.map(p => p.name).filter(n => !n.startsWith('USD'))
  const opsCount  = useMemo(() => filterOpsForPlan(rawRows, wizard.pair, wizard.startDate, wizard.endDate).length, [rawRows, wizard.pair, wizard.startDate, wizard.endDate])

  function warnForPair(pair) {
    if (!pair || pair === 'NEW') return null
    if (pair.startsWith('BTC')) return null
    if (pair.startsWith('ETH')) return 'warn'
    return 'danger'
  }
  const warnLevel = warnForPair(wizard.pair)

  return (
    <div className="dca-scroll">
      <Stepper step={1} />

      <div className="dca-card">
        <div className="dca-card-title">Paire <span className="dca-tag dca-tag-req">requis</span></div>
        <div className="dca-chip-grid">
          {pairs.map(p => (
            <button key={p} className={`dca-chip${wizard.pair === p ? ' sel' : ''}`} onClick={() => setWizard(w => ({ ...w, pair: p }))}>
              {p}
            </button>
          ))}
          <button className={`dca-chip new-pair${wizard.pair === 'NEW' ? ' sel' : ''}`} onClick={() => setWizard(w => ({ ...w, pair: 'NEW' }))}>
            + Nouvelle paire
          </button>
        </div>

        {wizard.pair === 'NEW' && (
          <div className="dca-form-row" style={{ marginBottom: 0 }}>
            <div className="dca-form-group">
              <label>Nom de la paire</label>
              <input className="dca-input" placeholder="ex: AVAX/USDT" value={wizard.customPair || ''} onChange={e => setWizard(w => ({ ...w, customPair: e.target.value }))} />
            </div>
          </div>
        )}

        {warnLevel === 'warn' && (
          <div className="dca-banner dca-banner-warn" style={{ marginTop: 10 }}>
            ⚠️ ETH peut être intégré avec prudence — volatilité plus élevée que BTC. Adaptez vos paliers en conséquence.
          </div>
        )}
        {warnLevel === 'danger' && (
          <div className="dca-banner dca-banner-danger" style={{ marginTop: 10 }}>
            ⛔ Le DCA gradué est <b>fortement déconseillé</b> sur les altcoins hors BTC. Seul BTC (et ETH avec précaution) sont adaptés à cette approche.
          </div>
        )}

        {wizard.pair && wizard.pair !== 'NEW' && (
          <div className="dca-banner dca-banner-info" style={{ marginTop: 10 }}>
            <b>{wizard.pair}</b> — {opsCount} opération{opsCount !== 1 ? 's' : ''} exécutée{opsCount !== 1 ? 's' : ''} trouvée{opsCount !== 1 ? 's' : ''}{wizard.startDate ? ` depuis le ${new Date(wizard.startDate).toLocaleDateString('fr-FR')}` : ''}.
          </div>
        )}
      </div>

      <div className="dca-card">
        <div className="dca-card-title">Période</div>
        <div className="dca-form-row">
          <div className="dca-form-group">
            <label>Date de début du DCA</label>
            <input className="dca-input" type="date" value={wizard.startDate || ''} onChange={e => setWizard(w => ({ ...w, startDate: e.target.value }))} />
          </div>
          <div className="dca-form-group">
            <label>Date de fin <span style={{ color: 'var(--muted)' }}>(aujourd'hui par défaut)</span></label>
            <input className="dca-input" type="date" value={wizard.endDate || ''} onChange={e => setWizard(w => ({ ...w, endDate: e.target.value }))} />
          </div>
        </div>
      </div>

      <div className="dca-btm">
        <button className="dca-btn dca-btn-ghost" onClick={onBack}>← Retour</button>
        <span className="dca-step-hint">Étape 1 / 4</span>
        <button className="dca-btn dca-btn-primary" disabled={!wizard.pair || wizard.pair === 'NEW' && !wizard.customPair} onClick={onNext}>
          {opsCount > 0 ? 'Voir les opérations →' : 'Paramétrer la stratégie →'}
        </button>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   STEP 2 — Pointage
   ═══════════════════════════════════════════════════════════════════════════ */
function Step2({ wizard, setWizard, rawRows, onNext, onBack }) {
  const effectivePair = wizard.pair === 'NEW' ? (wizard.customPair || '') : wizard.pair
  const ops = useMemo(() => filterOpsForPlan(rawRows, effectivePair, wizard.startDate, wizard.endDate), [rawRows, effectivePair, wizard.startDate, wizard.endDate])

  // Init pointedOps quand ops arrive
  useEffect(() => {
    if (ops.length && wizard.pointedOps === undefined) {
      // Par défaut : achats cochés, ventes décochées
      const keys = ops.map((op, i) => op.sens === 'Achat' ? getOpKey(op, i) : null).filter(Boolean)
      setWizard(w => ({ ...w, pointedOps: keys }))
    }
  }, [ops.length])

  const pointed = wizard.pointedOps || []

  function toggle(key) {
    setWizard(w => {
      const s = new Set(w.pointedOps || [])
      s.has(key) ? s.delete(key) : s.add(key)
      return { ...w, pointedOps: [...s] }
    })
  }
  function setAll(val) {
    const keys = val ? ops.map((op, i) => getOpKey(op, i)) : []
    setWizard(w => ({ ...w, pointedOps: keys }))
  }

  const pointedOps = ops.filter((op, i) => pointed.includes(getOpKey(op, i)))
  const avgPrice   = computeAvgPrice(pointedOps)
  const totalUsdt  = pointedOps.filter(o => o.sens === 'Achat').reduce((s, o) => s + o.usdt, 0)

  if (ops.length === 0) {
    return (
      <div className="dca-scroll">
        <Stepper step={2} />
        <div className="dca-banner dca-banner-warn">Aucune opération exécutée trouvée pour <b>{effectivePair}</b> sur la période sélectionnée. Vous passerez directement au paramétrage.</div>
        <div className="dca-btm">
          <button className="dca-btn dca-btn-ghost" onClick={onBack}>← Retour</button>
          <button className="dca-btn dca-btn-primary" onClick={onNext}>Paramétrer la stratégie →</button>
        </div>
      </div>
    )
  }

  return (
    <div className="dca-scroll">
      <Stepper step={2} />
      <div className="dca-card">
        <div className="dca-ops-header">
          <div>
            <div className="dca-ops-title">{effectivePair} — Opérations exécutées</div>
            <div className="dca-ops-meta">{ops.length} opérations · <b style={{ color: 'var(--green)' }}>{pointed.length} intégrées au DCA</b></div>
          </div>
          <div className="dca-ops-btns">
            <button className="dca-ops-btn" onClick={() => setAll(true)}>Tout cocher</button>
            <button className="dca-ops-btn" onClick={() => setAll(false)}>Tout décocher</button>
          </div>
        </div>

        <div className="dca-banner dca-banner-info" style={{ marginBottom: 10 }}>
          Seuls les ordres exécutés sont affichés. Cochez uniquement les lignes à intégrer dans le calcul DCA. Les ventes de profit peuvent être exclues.
        </div>

        <div className="dca-ops-tbl-wrap">
          <table className="dca-ops-tbl">
            <thead>
              <tr>
                <th>Date</th>
                <th>Sens</th>
                <th style={{ textAlign: 'right' }}>Prix</th>
                <th style={{ textAlign: 'right' }}>Montant</th>
                <th style={{ textAlign: 'right' }}>Volume</th>
                <th className="th-dca">DCA ✓</th>
              </tr>
            </thead>
            <tbody>
              {ops.map((op, i) => {
                const key = getOpKey(op, i)
                const chk = pointed.includes(key)
                return (
                  <tr key={key}>
                    <td>{op.date ? op.date.toLocaleDateString('fr-FR') : '—'}</td>
                    <td><span className={`db-badge ${op.sens === 'Achat' ? 'badge-buy' : 'badge-sell'}`}>{op.sens}</span></td>
                    <td style={{ textAlign: 'right', fontFamily: "'Space Mono', monospace", fontSize: '.6rem' }}>{op.prix ? fmt(op.prix) : '—'}</td>
                    <td style={{ textAlign: 'right', fontFamily: "'Space Mono', monospace", fontSize: '.6rem' }}>{op.usdt ? `$${op.usdt.toFixed(2)}` : '—'}</td>
                    <td style={{ textAlign: 'right', fontFamily: "'Space Mono', monospace", fontSize: '.58rem', color: 'var(--muted)' }}>{op.vol ? op.vol.toFixed(6) : '—'}</td>
                    <td className="td-chk"><input type="checkbox" className="dca-ops-chk" checked={chk} onChange={() => toggle(key)} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="dca-ops-summary">
          <div><span>Investi DCA : </span><b>{totalUsdt > 0 ? `$${totalUsdt.toFixed(2)}` : '—'}</b></div>
          <div><span>Prix moyen : </span><b style={{ color: 'var(--gold)' }}>{avgPrice > 0 ? fmt(avgPrice) : '—'}</b></div>
          <div><span>Lignes DCA : </span><b>{pointed.length} / {ops.length}</b></div>
        </div>
      </div>

      <div className="dca-btm">
        <button className="dca-btn dca-btn-ghost" onClick={onBack}>← Retour</button>
        <span className="dca-step-hint">Étape 2 / 4</span>
        <button className="dca-btn dca-btn-primary" onClick={onNext}>Paramétrer la stratégie →</button>
      </div>
    </div>
  )
}

/* ─── Ligne tableau paramètre ────────────────────────────────────────────── */
function ParamRow({ row, colorArr, idx, avgPrice, onChange, onDelete, showHint, unitLabel, col1Label, col2Label }) {
  const ecartNum = parseFloat(row.ecartThreshold ?? row.ecartMax ?? row.ecartMin ?? 0)
  const targetPrice = avgPrice > 0 && !isNaN(ecartNum) ? avgPrice * (1 + ecartNum / 100) : null
  const color = (colorArr || [])[idx] || 'var(--muted)'

  return (
    <tr>
      <td><span className="dca-zdot" style={{ background: color }} /></td>
      <td><input className="dca-pi" value={row.label || ''} onChange={e => onChange(idx, 'label', e.target.value)} style={{ width: 80 }} /></td>
      <td>
        <input className="dca-pi" value={row[col2Label] != null ? row[col2Label] : ''} onChange={e => onChange(idx, col2Label, e.target.value)}
          style={{ width: 80 }} placeholder={col2Label === 'ecartMin' ? '< 0' : col2Label === 'ecartThreshold' ? '+20' : '0%→5%'} />
      </td>
      <td>
        <div className="dca-pi-group">
          <input className="dca-pi" type="number" value={row[col1Label] != null ? row[col1Label] : ''} onChange={e => onChange(idx, col1Label, parseFloat(e.target.value) || 0)} style={{ width: 60 }} />
          <span className="dca-pi-sfx">{unitLabel}</span>
        </div>
      </td>
      {showHint && <td><span className="dca-price-hint">{targetPrice ? fmt(targetPrice) : '—'}</span></td>}
      <td><button className="dca-del-btn" onClick={() => onDelete(idx)}>×</button></td>
    </tr>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   STEP 3 — Paramétrage
   ═══════════════════════════════════════════════════════════════════════════ */
function Step3({ wizard, setWizard, rawRows, onNext, onBack, saving }) {
  const effectivePair = wizard.pair === 'NEW' ? (wizard.customPair || '') : wizard.pair
  const ops = useMemo(() => filterOpsForPlan(rawRows, effectivePair, wizard.startDate, wizard.endDate), [rawRows, effectivePair, wizard.startDate, wizard.endDate])
  const pointedOps = useMemo(() => {
    const p = wizard.pointedOps || []
    return ops.filter((op, i) => p.includes(getOpKey(op, i)))
  }, [ops, wizard.pointedOps])
  const avgPrice = computeAvgPrice(pointedOps)

  const p = wizard.params || {}
  function setP(key, val) { setWizard(w => ({ ...w, params: { ...(w.params || {}), [key]: val } })) }

  // Acc zones
  const accZones  = p.accZones  || DEFAULT_ACC_ZONES
  const debtZones = p.debtZones || DEFAULT_DEBT_ZONES
  const profitZones = p.profitZones || DEFAULT_PROFIT_ZONES

  function updateZone(arr, key, idx, field, val) {
    const next = arr.map((r, i) => i === idx ? { ...r, [field]: val } : r)
    setP(key, next)
  }
  function deleteZone(arr, key, idx) {
    if (arr.length <= 1) return
    setP(key, arr.filter((_, i) => i !== idx))
  }
  function addZone(key, template) {
    const arr = p[key] || (key === 'accZones' ? DEFAULT_ACC_ZONES : key === 'debtZones' ? DEFAULT_DEBT_ZONES : DEFAULT_PROFIT_ZONES)
    setP(key, [...arr, template])
  }

  const canSubmit = accZones.length >= 1 && profitZones.length >= 1 && p.baseAmount > 0

  return (
    <div className="dca-scroll">
      <Stepper step={3} />

      {/* Base */}
      <div className="dca-card">
        <div className="dca-card-title">Paramètres de base</div>
        <div className="dca-form-row">
          <div className="dca-form-group">
            <label>Montant de base *</label>
            <div className="dca-input-group">
              <input className="dca-input" type="number" value={p.baseAmount ?? 10} onChange={e => setP('baseAmount', parseFloat(e.target.value) || 0)} />
              <span className="dca-input-sfx">USDT</span>
            </div>
          </div>
          <div className="dca-form-group">
            <label>Fréquence *</label>
            <select className="dca-select" value={p.frequency || 'day'} onChange={e => setP('frequency', e.target.value)}>
              <option value="day">Tous les jours</option>
              <option value="week">Toutes les semaines</option>
              <option value="month">Tous les mois</option>
            </select>
          </div>
          <div className="dca-form-group">
            <label>Seuil bull run <span className="dca-tag dca-tag-opt">opt.</span></label>
            <div className="dca-input-group">
              <input className="dca-input" type="number" value={p.bullThreshold ?? 20} onChange={e => setP('bullThreshold', parseFloat(e.target.value) || null)} />
              <span className="dca-input-sfx">% au-dessus</span>
            </div>
          </div>
          <div className="dca-form-group">
            <label>Plafond dette <span className="dca-tag dca-tag-opt">opt.</span></label>
            <div className="dca-input-group">
              <input className="dca-input" type="number" value={p.debtCeiling ?? 300} onChange={e => setP('debtCeiling', parseFloat(e.target.value) || null)} />
              <span className="dca-input-sfx">USDT</span>
            </div>
          </div>
        </div>
      </div>

      {/* Accumulation */}
      <div className="dca-card">
        <div className="dca-card-title">Zones d'accumulation <span className="dca-tag dca-tag-req">min. 1 ligne</span></div>
        <table className="dca-ptbl">
          <thead><tr><th /><th>Zone</th><th>Écart min. (% vs moy.)</th><th>Montant</th><th /></tr></thead>
          <tbody>
            {accZones.map((r, i) => (
              <ParamRow key={i} row={r} colorArr={ZONE_COLORS.acc} idx={i} avgPrice={0}
                col1Label="amount" col2Label="ecartMin" unitLabel="USDT" showHint={false}
                onChange={(idx, field, val) => updateZone(accZones, 'accZones', idx, field, val)}
                onDelete={idx => deleteZone(accZones, 'accZones', idx)} />
            ))}
          </tbody>
        </table>
        <div className="dca-add-row" onClick={() => addZone('accZones', { label: `Zone ${String.fromCharCode(65 + accZones.length)}`, ecartMin: 0, ecartMax: null, amount: 5 })}>
          <div className="dca-add-ic">+</div> Ajouter une zone
        </div>
      </div>

      {/* Redistribution dette */}
      <div className="dca-card">
        <div className="dca-card-title">Redistribution de la dette <span className="dca-tag dca-tag-opt">optionnel</span></div>
        <div style={{ fontSize: '.6rem', color: 'var(--text2)', marginBottom: 10, lineHeight: 1.6 }}>
          Lorsque le prix plonge fortement, injecter une partie de la dette accumulée pour renforcer la position.
        </div>
        <table className="dca-ptbl">
          <thead><tr><th /><th>Condition</th><th>Écart ≤ (% vs moy.)</th><th>% dette injectée</th><th>Prix cible</th><th /></tr></thead>
          <tbody>
            {debtZones.map((r, i) => (
              <ParamRow key={i} row={r} colorArr={ZONE_COLORS.debt} idx={i} avgPrice={avgPrice}
                col1Label="debtPct" col2Label="ecartThreshold" unitLabel="%" showHint={true}
                onChange={(idx, field, val) => updateZone(debtZones, 'debtZones', idx, field, val)}
                onDelete={idx => deleteZone(debtZones, 'debtZones', idx)} />
            ))}
          </tbody>
        </table>
        <div className="dca-add-row" onClick={() => addZone('debtZones', { label: 'Signal', ecartThreshold: -15, debtPct: 75 })}>
          <div className="dca-add-ic">+</div> Ajouter un palier
        </div>
      </div>

      {/* Profits */}
      <div className="dca-card">
        <div className="dca-card-title">Paliers de prise de profits <span className="dca-tag dca-tag-req">min. 1 ligne</span></div>
        <table className="dca-ptbl">
          <thead><tr><th /><th>Palier</th><th>Écart ≥ (% vs moy.)</th><th>% position vendu</th><th>Prix cible</th><th /></tr></thead>
          <tbody>
            {profitZones.map((r, i) => (
              <ParamRow key={i} row={r} colorArr={ZONE_COLORS.profit} idx={i} avgPrice={avgPrice}
                col1Label="positionPct" col2Label="ecartThreshold" unitLabel="%" showHint={true}
                onChange={(idx, field, val) => updateZone(profitZones, 'profitZones', idx, field, val)}
                onDelete={idx => deleteZone(profitZones, 'profitZones', idx)} />
            ))}
          </tbody>
        </table>
        <div className="dca-add-row" onClick={() => addZone('profitZones', { label: `Palier ${profitZones.length + 1}`, ecartThreshold: 50, positionPct: 10 })}>
          <div className="dca-add-ic">+</div> Ajouter un palier
        </div>
      </div>

      <div className="dca-btm">
        <button className="dca-btn dca-btn-ghost" onClick={onBack}>← Retour</button>
        <span className="dca-step-hint">Étape 3 / 4</span>
        <button className="dca-btn dca-btn-success" disabled={!canSubmit || saving} onClick={onNext}>
          {saving ? '⏳ Sauvegarde…' : 'Créer le plan DCA ✓'}
        </button>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   STEP 4 — Dashboard
   ═══════════════════════════════════════════════════════════════════════════ */
function DcaDashboard({ plan, rawRows, prices, onEditParams }) {
  const effectivePair = plan.pair === 'NEW' ? (plan.customPair || '') : plan.pair
  const ops       = useMemo(() => filterOpsForPlan(rawRows, effectivePair, plan.startDate, plan.endDate), [rawRows, effectivePair, plan.startDate, plan.endDate])
  const pointed   = plan.pointedOps || []
  const pointedOps = useMemo(() => ops.filter((op, i) => pointed.includes(getOpKey(op, i))), [ops, pointed])

  const p          = plan.params || {}
  const avgPrice   = computeAvgPrice(pointedOps)
  const debt       = computeDebt({ ...p, startDate: plan.startDate }, pointedOps)
  const debtPct    = p.debtCeiling ? Math.min(100, (debt / p.debtCeiling) * 100) : 0

  // Prix live
  const currentPrice = prices[effectivePair] || null
  const [manualPrice, setManualPrice] = useState('')
  const livePrice = currentPrice || (manualPrice ? parseFloat(manualPrice) : null)

  const signal     = useMemo(() => computeSignal({ ...p }, livePrice, avgPrice, debt), [p, livePrice, avgPrice, debt])
  const delta      = livePrice && avgPrice ? (livePrice - avgPrice) / avgPrice * 100 : null

  // KPIs
  const buys         = pointedOps.filter(o => o.sens === 'Achat')
  const totalInvested = buys.reduce((s, o) => s + o.usdt, 0)
  const position     = buys.reduce((s, o) => s + o.vol, 0) - pointedOps.filter(o => o.sens === 'Vente').reduce((s, o) => s + o.vol, 0)
  const breakeven    = position > 0 && totalInvested > 0 ? totalInvested / position : 0
  const pnlLatent    = livePrice && position > 0 && breakeven > 0 ? position * (livePrice - breakeven) : 0

  // Zone needle
  const bull = p.bullThreshold || 20
  const MIN_D = -25, MAX_D = bull * 1.5
  const needlePct = delta != null ? Math.min(98, Math.max(2, (delta - MIN_D) / (MAX_D - MIN_D) * 100)) : 50

  // Signal box class
  function signalClass() {
    if (signal.zone === 'PROFIT') return 'profit'
    if (signal.zone === 'DEBT' || signal.zone === 'FORCE') return 'debt'
    if (signal.deployAmount >= (p.baseAmount || 10)) return 'buy'
    if (signal.deployAmount > 0) return 'buy50'
    return 'hold'
  }

  // Timeline — 15 dernières ops
  const recentOps = [...pointedOps].sort((a, b) => (b.date || 0) - (a.date || 0)).slice(0, 15).reverse()
  function tlClass(op) {
    if (op.sens === 'Vente') return 'tc-sl'
    if (!op.usdt || !p.baseAmount) return 'tc-100'
    const r = op.usdt / p.baseAmount
    if (r >= 0.9) return 'tc-100'
    if (r >= 0.65) return 'tc-75'
    if (r >= 0.4) return 'tc-50'
    return 'tc-25'
  }
  function tlLabel(op) {
    if (op.sens === 'Vente') return '↓'
    return '●'
  }
  function tlTip(op) {
    const d = op.date?.toLocaleDateString('fr-FR') || '—'
    return `${d} : ${op.sens} $${op.usdt?.toFixed(2) || '—'}`
  }

  const profitZones = p.profitZones || DEFAULT_PROFIT_ZONES
  const debtZones   = p.debtZones   || []

  return (
    <div className="dca-scroll">
      <Stepper step={4} />

      <div className="dca-banner dca-banner-success">
        Plan <b>{effectivePair}</b> actif
        {plan.startDate ? ` depuis le ${new Date(plan.startDate).toLocaleDateString('fr-FR')}` : ''}
        {p.baseAmount ? ` · ${p.baseAmount} USDT/${p.frequency === 'day' ? 'jour' : p.frequency === 'week' ? 'sem.' : 'mois'}` : ''}
      </div>

      {/* Price hero */}
      <div className="dca-hero">
        <div className="dca-hero-prices">
          <div className="dca-hero-block">
            <div className="dca-hero-lbl">Prix moyen d'achat</div>
            <div className="dca-hero-val dca-hero-val-main">{avgPrice > 0 ? fmt(avgPrice) : '—'}</div>
            <div className="dca-hero-sub">référence DCA · {buys.length} achats</div>
          </div>
          <div className="dca-hero-sep" />
          <div className="dca-hero-delta">
            {delta != null ? (
              <>
                <div className={`dca-hero-delta-arrow ${delta < 0 ? 'down' : 'up'}`}>{delta < 0 ? '↓' : '↑'}</div>
                <div className={`dca-hero-delta-pct ${delta < 0 ? 'down' : 'up'}`}>{pct(delta)}</div>
                <div className="dca-hero-delta-lbl">cours vs moyenne</div>
              </>
            ) : (
              <div style={{ fontSize: '.58rem', color: 'var(--muted)', textAlign: 'center' }}>
                {currentPrice == null && <div style={{ marginTop: 4 }}>
                  <input className="dca-input" type="number" placeholder="Saisir cours ($)" value={manualPrice} onChange={e => setManualPrice(e.target.value)} style={{ width: 110, textAlign: 'center', fontSize: '.6rem' }} />
                </div>}
              </div>
            )}
          </div>
          <div className="dca-hero-sep" />
          <div className="dca-hero-block">
            <div className="dca-hero-lbl">Cours actuel</div>
            <div className="dca-hero-val">{livePrice ? fmt(livePrice) : '—'}</div>
            <div className="dca-hero-sub">{currentPrice ? 'mis à jour en direct' : 'saisie manuelle'}</div>
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
            <div className="dca-zone-needle" style={{ left: `${needlePct}%` }} />
          </div>
          <div className="dca-zone-labels">
            <span>&lt; 0%</span><span>0–5%</span><span>5–10%</span><span>10–{bull}%</span><span>&gt; {bull}%</span>
          </div>
        </div>
      </div>

      {/* Signal */}
      <div className={`dca-signal ${signalClass()}`}>
        <div>
          <div className="dca-signal-title">{signal.label}</div>
          <div className="dca-signal-desc">{signal.description}</div>
        </div>
        <div className="dca-signal-amount">
          <div className="dca-signal-amt">
            {signal.action === 'sell' ? `Vendre ${signal.sellPct}%` : signal.deployAmount > 0 ? `${signal.deployAmount.toFixed(2)} USDT` : '—'}
          </div>
          <div className="dca-signal-amt-lbl">{signal.action === 'sell' ? 'de la position' : signal.deployAmount > 0 ? 'à déployer' : 'aucune action'}</div>
        </div>
      </div>

      {/* KPIs */}
      <div className="dca-kpi-grid">
        <div className="dca-kpi">
          <div className="dca-kpi-val">{totalInvested > 0 ? fmt(totalInvested, 2).replace('$', '$') : '—'}</div>
          <div className="dca-kpi-lbl">Total investi</div>
          <div className="dca-kpi-sub">{buys.length} opérations pointées</div>
        </div>
        <div className="dca-kpi">
          <div className="dca-kpi-val" style={{ color: debtPct > 50 ? 'var(--gold)' : 'var(--text)' }}>
            ${debt.toFixed(0)}
          </div>
          <div className="dca-kpi-lbl">Dette accumulée</div>
          <div className="dca-kpi-sub">
            {debtPct > 0 ? `${debtPct.toFixed(0)}% du plafond` : 'pas de plafond configuré'}
          </div>
        </div>
        <div className="dca-kpi">
          <div className="dca-kpi-val" style={{ color: pnlLatent >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {pnlLatent !== 0 ? (pnlLatent >= 0 ? '+' : '') + fmt(pnlLatent, 2) : '—'}
          </div>
          <div className="dca-kpi-lbl">PnL latent</div>
          <div className="dca-kpi-sub">{delta != null ? pct(delta) + ' vs moy.' : 'cours manquant'}</div>
        </div>
      </div>

      {/* Paliers */}
      <div className="dca-two-col">
        {/* Redistribution dette */}
        {debtZones.length > 0 && (
          <div className="dca-card">
            <div className="dca-card-title">Redistribution de la dette</div>
            {debtZones.map((z, i) => {
              const tp = avgPrice > 0 ? avgPrice * (1 + z.ecartThreshold / 100) : null
              const active = delta != null && delta <= z.ecartThreshold
              return (
                <div key={i} className={`dca-pal-row${active ? ' active-debt' : ''}`}>
                  <span className="dca-zdot" style={{ background: ZONE_COLORS.debt[i] || '#378ADD' }} />
                  <span className="dca-pal-lbl">{z.label} · <b>{z.ecartThreshold > 0 ? '+' : ''}{z.ecartThreshold}%</b></span>
                  <span className="dca-pal-price">{tp ? fmt(tp) : '—'}</span>
                  <span className="dca-pal-action">{active ? '⚡ ' : ''}{z.debtPct}% dette</span>
                </div>
              )
            })}
          </div>
        )}
        {/* Profits */}
        <div className="dca-card">
          <div className="dca-card-title">Paliers de profits</div>
          {profitZones.slice(0, 5).map((z, i) => {
            const tp = avgPrice > 0 ? avgPrice * (1 + z.ecartThreshold / 100) : null
            const active = delta != null && delta >= z.ecartThreshold
            return (
              <div key={i} className={`dca-pal-row${active ? ' active-profit' : ''}`}>
                <span className="dca-zdot" style={{ background: ZONE_COLORS.profit[i] || '#E24B4A' }} />
                <span className="dca-pal-lbl">{z.label} · <b>+{z.ecartThreshold}%</b></span>
                <span className="dca-pal-price">{tp ? fmt(tp) : '—'}</span>
                <span className="dca-pal-action">{active ? '✓ ' : ''}Vendre {z.positionPct}%</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Timeline */}
      <div className="dca-card">
        <div className="dca-card-title">Opérations récentes ({recentOps.length})</div>
        <div className="dca-tl-legend">
          <span><span className="dca-tl-leg-dot" style={{ background: 'rgba(61,191,144,.35)' }} />100%</span>
          <span><span className="dca-tl-leg-dot" style={{ background: 'rgba(61,191,144,.2)' }} />75%</span>
          <span><span className="dca-tl-leg-dot" style={{ background: 'rgba(200,160,32,.22)' }} />50%</span>
          <span><span className="dca-tl-leg-dot" style={{ background: 'rgba(200,160,32,.38)' }} />25%</span>
          <span><span className="dca-tl-leg-dot" style={{ background: 'rgba(212,90,80,.22)' }} />Vente</span>
        </div>
        <div className="dca-tl">
          {recentOps.map((op, i) => (
            <div key={i} className={`dca-tc ${tlClass(op)}${i === recentOps.length - 1 ? ' tc-today' : ''}`} data-tip={tlTip(op)}>
              {tlLabel(op)}
            </div>
          ))}
          {Array.from({ length: Math.max(0, 15 - recentOps.length) }).map((_, i) => (
            <div key={`e${i}`} className="dca-tc tc-sk" data-tip="Aucune donnée">–</div>
          ))}
        </div>
        <div style={{ fontSize: '.56rem', color: 'var(--muted)', marginTop: 8 }}>
          {buys.length} achats · {pointedOps.filter(o => o.sens === 'Vente').length} ventes · Investi total {totalInvested > 0 ? `$${totalInvested.toFixed(0)}` : '—'}
        </div>
      </div>

      <div className="dca-btm">
        <button className="dca-btn dca-btn-ghost" onClick={onEditParams}>← Modifier les paramètres</button>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   DcaView — Orchestrateur principal
   ═══════════════════════════════════════════════════════════════════════════ */
export default function DcaView({ pairList = [], rawRows = [], prices = {} }) {
  const [screen, setScreen]   = useState('list')  // 'list' | 1 | 2 | 3 | 4
  const [plans, setPlans]     = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [currentPlan, setCurrentPlan] = useState(null)

  // Wizard state accumulé
  const [wizard, setWizard] = useState({
    pair: '', customPair: '', startDate: '', endDate: '',
    pointedOps: undefined, params: { baseAmount: 10, frequency: 'day', bullThreshold: 20, debtCeiling: 300, accZones: [...DEFAULT_ACC_ZONES], debtZones: [...DEFAULT_DEBT_ZONES], profitZones: [...DEFAULT_PROFIT_ZONES] }
  })

  // Charger les plans
  useEffect(() => {
    setLoading(true)
    getDcaPlans().then(setPlans).catch(console.error).finally(() => setLoading(false))
  }, [])

  function startNewWizard() {
    setWizard({ pair: pairList[0]?.name || '', customPair: '', startDate: '', endDate: '', pointedOps: undefined, params: { baseAmount: 10, frequency: 'day', bullThreshold: 20, debtCeiling: 300, accZones: [...DEFAULT_ACC_ZONES], debtZones: [...DEFAULT_DEBT_ZONES], profitZones: [...DEFAULT_PROFIT_ZONES] } })
    setCurrentPlan(null)
    setScreen(1)
  }

  function openPlan(plan) {
    setCurrentPlan(plan)
    setScreen(4)
  }

  async function deletePlan(id) {
    await deleteDcaPlan(id)
    setPlans(p => p.filter(x => x.id !== id))
  }

  // Step 1 → 2 ou 3
  function step1Next() {
    const pair = wizard.pair === 'NEW' ? wizard.customPair : wizard.pair
    const hasOps = rawRows.some(r => r.pair === pair && r.exec)
    setScreen(hasOps ? 2 : 3)
  }

  // Step 3 → Save → 4
  async function step3Save() {
    setSaving(true)
    try {
      const pair = wizard.pair === 'NEW' ? wizard.customPair : wizard.pair
      const planData = {
        id        : currentPlan?.id || null,
        pair,
        startDate : wizard.startDate,
        endDate   : wizard.endDate   || null,
        pointedOps: wizard.pointedOps || [],
        ...wizard.params,
      }
      const id = await saveDcaPlan(planData)
      const saved = { ...planData, id }
      setCurrentPlan(saved)
      setPlans(prev => {
        const exists = prev.find(p => p.id === id)
        return exists ? prev.map(p => p.id === id ? saved : p) : [...prev, saved]
      })
      setScreen(4)
    } catch (e) {
      alert('Erreur sauvegarde : ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  // Effectivité du plan affiché au dashboard
  const dashPlan = useMemo(() => {
    if (screen !== 4) return null
    if (currentPlan) return currentPlan
    return null
  }, [screen, currentPlan])

  return (
    <div className="dca-page">
      {/* Back bar (steps 1-4) */}
      {screen !== 'list' && (
        <div className="dca-back-bar" style={{ padding: '12px 20px 0' }}>
          <button className="dca-back-btn" onClick={() => setScreen('list')}>← Plans DCA</button>
          {(wizard.pair || currentPlan?.pair) && (
            <span className="dca-back-pair">·  {wizard.pair === 'NEW' ? wizard.customPair : (currentPlan?.pair || wizard.pair)}</span>
          )}
        </div>
      )}

      {screen === 'list' && (
        <DcaList plans={plans} loading={loading} onNew={startNewWizard} onOpen={openPlan} onDelete={deletePlan} />
      )}

      {screen === 1 && (
        <Step1 wizard={wizard} setWizard={setWizard} pairList={pairList} rawRows={rawRows} onNext={step1Next} onBack={() => setScreen('list')} />
      )}

      {screen === 2 && (
        <Step2 wizard={wizard} setWizard={setWizard} rawRows={rawRows} onNext={() => setScreen(3)} onBack={() => setScreen(1)} />
      )}

      {screen === 3 && (
        <Step3 wizard={wizard} setWizard={setWizard} rawRows={rawRows} onNext={step3Save} onBack={() => setScreen(2)} saving={saving} />
      )}

      {screen === 4 && dashPlan && (
        <DcaDashboard plan={dashPlan} rawRows={rawRows} prices={prices} onEditParams={() => {
          setWizard({ pair: dashPlan.pair, customPair: '', startDate: dashPlan.startDate, endDate: dashPlan.endDate, pointedOps: dashPlan.pointedOps, params: { baseAmount: dashPlan.baseAmount, frequency: dashPlan.frequency, bullThreshold: dashPlan.bullThreshold, debtCeiling: dashPlan.debtCeiling, accZones: dashPlan.accZones, debtZones: dashPlan.debtZones, profitZones: dashPlan.profitZones } })
          setScreen(3)
        }} />
      )}
    </div>
  )
}
