/**
 * dcaUtils.js — Constantes, helpers et fonctions utilitaires DCA
 */

import { normPair } from './parser.js'
export { normPair }
export { parseDate } from './process.js'

/* ── Constantes ──────────────────────────────────────────────────────────── */

export const DEFAULT_ZONES = [
  { type:'accum',  label:'Accumulation forte', ecart:'-10', action:'10',  color:'#3dbf90' },
  { type:'accum',  label:'Accumulation',       ecart:'0',   action:'10',  color:'#2a9d70' },
  { type:'ralent', label:'Ralentissement',      ecart:'10',  action:'5',   color:'#c8a020' },
  { type:'profit', label:'Prise partielle',     ecart:'25',  action:'25',  color:'#F7C1C1' },
  { type:'profit', label:'Prise de profits',    ecart:'50',  action:'50',  color:'#E24B4A' },
]

export const TYPE_LABELS  = { accum:'Accumulation', ralent:'Ralentissement', profit:'Prise de profit' }
export const TYPE_COLORS  = { accum:'var(--green)',  ralent:'var(--gold)',    profit:'var(--red)' }
export const PERIOD_LABEL = { day:'jour', week:'semaine', month:'mois' }

/* ── Formatage ───────────────────────────────────────────────────────────── */

export function fmt(v, dec = 0) {
  if (v == null || isNaN(v)) return '—'
  return '$' + Number(v).toLocaleString('fr-FR', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  })
}

export function pct(v) {
  return v == null ? '—' : (v >= 0 ? '+' : '') + Number(v).toFixed(2) + '%'
}

export function nowLocal() {
  const d = new Date()
  d.setSeconds(0, 0)
  return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

/* ── Filtrage des opérations ─────────────────────────────────────────────── */

export function filterOpsForPlan(rawRows, pair, startDate, endDate) {
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

/**
 * Clé stable d'une opération dans la liste filtrée.
 * Date ISO + index pour différencier les ops du même montant/date.
 */
export function getOpKey(op, idx) {
  return `${op.date?.toISOString?.() || idx}_${idx}`
}

/** Génère un planId unique stable */
export function newPlanId(pair) {
  return `${(pair || 'plan').replace(/\//g, '_')}_${Date.now()}`
}

/** Migre un ancien plan (zones séparées) vers le format zones[] unifié */
export function migratePlanZones(plan) {
  if (plan.zones?.length > 0) return plan.zones
  const z = []
  ;(plan.accZones    || []).forEach(x => z.push({ type:'accum',  label:x.label, ecart:String(x.ecartMin||0),        action:String(x.amount||10),     color:'#3dbf90' }))
  ;(plan.debtZones   || []).forEach(x => z.push({ type:'ralent', label:x.label, ecart:String(x.ecartThreshold||0),  action:String(x.debtPct||50),    color:'#c8a020' }))
  ;(plan.profitZones || []).forEach(x => z.push({ type:'profit', label:x.label, ecart:String(x.ecartThreshold||25), action:String(x.positionPct||25),color:'#E24B4A' }))
  return z.length ? z : DEFAULT_ZONES
}
