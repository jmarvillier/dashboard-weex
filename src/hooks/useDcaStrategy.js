/**
 * useDcaStrategy.js — v3
 * Renommage dette → rechargement DCA.
 * Calcul rechargement : shortfalls par période (manquées + achats partiels).
 */

import { useMemo } from 'react'

/* ─── Breakeven ─────────────────────────────────────────────────────────── */
export function computeBreakeven(pointedOps) {
  const buys  = pointedOps.filter(o => o.sens === 'Achat' && o.exec)
  const sells = pointedOps.filter(o => o.sens === 'Vente' && o.exec)
  const volBought  = buys.reduce((s, o)  => s + (o.vol  || 0), 0)
  const volSold    = sells.reduce((s, o) => s + (o.vol  || 0), 0)
  const netPos     = volBought - volSold
  const totalInv   = buys.reduce((s, o)  => s + (o.usdt || 0), 0)
  const sellRev    = sells.reduce((s, o) => s + (o.usdt || 0), 0)
  const netInv     = Math.max(0, totalInv - sellRev)
  if (netPos > 0) return netInv / netPos
  if (volBought > 0) return totalInv / volBought
  return 0
}

/* ─── Prix moyen d'achat ────────────────────────────────────────────────── */
export function computeAvgPrice(pointedOps) {
  const buys    = pointedOps.filter(o => o.sens === 'Achat' && o.exec && o.vol > 0)
  const vol     = buys.reduce((s, o) => s + o.vol,  0)
  const usdt    = buys.reduce((s, o) => s + o.usdt, 0)
  return vol > 0 ? usdt / vol : 0
}

/* ─── Date de début effective ───────────────────────────────────────────── */
export function getEffectiveStart(plan, pointedOps) {
  if (plan.startDate) {
    const d = new Date(plan.startDate)
    if (!isNaN(d.getTime())) return d
  }
  const buyOps = pointedOps.filter(o => o.sens === 'Achat' && o.exec && o.date)
  if (buyOps.length > 0)
    return new Date(Math.min(...buyOps.map(o => o.date.getTime())))
  return null
}

const PERIOD_MS = { day: 86400000, week: 604800000, month: 30 * 86400000 }

/* ─── Solde de rechargement DCA ────────────────────────────────────────────
   solde = Σ (baseAmount − injected) pour chaque cycle passé
   Peut être positif (sous-investissement) ou négatif (sur-investissement).
   Exemple : base 10 USDT
     cycle 1 → injecté 2  → +8
     cycle 2 → injecté 0  → +10
     cycle 3 → injecté 30 → −20
     solde cumulé = −2
   ─────────────────────────────────────────────────────────────────────────── */
export function computeRechargement(plan, pointedOps) {
  const baseAmount = plan.baseAmount || 10
  const ms         = PERIOD_MS[plan.frequency || 'day'] || PERIOD_MS.day
  const start      = getEffectiveStart(plan, pointedOps)
  if (!start) return { total: 0, missed: 0 }

  const now          = new Date()
  const totalPeriods = Math.max(0, Math.floor((now.getTime() - start.getTime()) / ms))
  let solde          = 0
  let missedPeriods  = 0

  for (let i = 0; i < totalPeriods; i++) {
    const pStart = new Date(start.getTime() + i * ms)
    const pEnd   = new Date(start.getTime() + (i + 1) * ms)
    const injected = pointedOps
      .filter(o => o.sens === 'Achat' && o.exec && o.date && o.date >= pStart && o.date < pEnd)
      .reduce((s, o) => s + (o.usdt || 0), 0)
    solde += baseAmount - injected           // peut être négatif
    if (injected === 0) missedPeriods++
  }

  return { total: solde, missed: missedPeriods }
}

/* ─── Ops du cycle en cours ─────────────────────────────────────────────── */
export function getCurrentPeriodOps(plan, pointedOps) {
  const ms    = PERIOD_MS[plan.frequency || 'day'] || PERIOD_MS.day
  const start = getEffectiveStart(plan, pointedOps)
  if (!start) return { buys: [], sells: [], totalBought: 0, totalSold: 0 }
  const now          = new Date()
  const elapsed      = now.getTime() - start.getTime()
  const currentIdx   = Math.max(0, Math.floor(elapsed / ms))
  const periodStart  = new Date(start.getTime() + currentIdx * ms)
  const periodEnd    = new Date(periodStart.getTime() + ms)

  const ops   = pointedOps.filter(o => o.exec && o.date && o.date >= periodStart && o.date < periodEnd)
  const buys  = ops.filter(o => o.sens === 'Achat')
  const sells = ops.filter(o => o.sens === 'Vente')
  return {
    buys,
    sells,
    totalBought : buys.reduce((s, o)  => s + (o.usdt || 0), 0),
    totalSold   : sells.reduce((s, o) => s + (o.usdt || 0), 0),
    periodStart,
    periodEnd,
  }
}

/* ─── Timeline ───────────────────────────────────────────────────────────── */
export function generateTimeline(plan, pointedOps, slots = 15) {
  const baseAmount = plan.baseAmount || 10
  const ms         = PERIOD_MS[plan.frequency || 'day'] || PERIOD_MS.day
  const start      = getEffectiveStart(plan, pointedOps)
  if (!start) return []

  const now           = new Date()
  const totalExpected = Math.max(1, Math.floor((now.getTime() - start.getTime()) / ms) + 1)
  const firstIdx      = Math.max(0, totalExpected - slots)
  const result        = []

  for (let i = firstIdx; i < totalExpected; i++) {
    const pStart  = new Date(start.getTime() + i * ms)
    const pEnd    = new Date(start.getTime() + (i + 1) * ms)
    const isFuture = pEnd > now

    const opsInPeriod = pointedOps.filter(o =>
      o.exec && o.date && o.date >= pStart && o.date < pEnd
    )
    const buys  = opsInPeriod.filter(o => o.sens === 'Achat')
    const sells = opsInPeriod.filter(o => o.sens === 'Vente')

    if (isFuture) {
      result.push({ type: 'future', date: pStart, idx: i })
    } else if (buys.length > 0) {
      const amount = buys.reduce((s, o) => s + (o.usdt || 0), 0)
      const pct    = baseAmount > 0 ? Math.round(amount / baseAmount * 100) : 100
      result.push({ type: 'bought', date: pStart, pct, amount, idx: i })
    } else if (sells.length > 0) {
      result.push({ type: 'sell', date: pStart, idx: i })
    } else {
      result.push({ type: 'missed', date: pStart, idx: i })
    }
  }
  return result
}

/* ─── Signal ─────────────────────────────────────────────────────────────── */
export function computeSignal(plan, currentPrice, breakeven, rechargement) {
  const rechargeTotal = rechargement?.total ?? 0
  if (!currentPrice || !breakeven) {
    return { zone: 'UNKNOWN', action: 'hold', deployAmount: 0, label: 'Cours non disponible', description: 'Cours live indisponible.', sellPct: null, forceRecharge: false }
  }

  const delta = (currentPrice - breakeven) / breakeven * 100

  // ── Lire les zones unifiées (nouveau format) ou l'ancien format ──────────
  const zones = plan.zones || []
  const profitZones  = zones.filter(z => z.type === 'profit').sort((a,b)=>(parseFloat(a.ecart)||0)-(parseFloat(b.ecart)||0))
  const accumZones   = zones.filter(z => z.type === 'accum' || z.type === 'ralent').sort((a,b)=>(parseFloat(b.ecart)||0)-(parseFloat(a.ecart)||0))

  // ── Bull run / Distribution ──────────────────────────────────────────────
  // Seuil bull run = écart de la première zone profit (la plus basse)
  const firstProfitEcart = profitZones.length > 0
    ? Math.min(...profitZones.map(z => parseFloat(z.ecart) || 0))
    : Infinity
  const bullZones = profitZones.filter(z => delta >= (parseFloat(z.ecart) || 0))
  if (delta >= firstProfitEcart && bullZones.length > 0) {
    const totalSell = bullZones.reduce((s, z) => s + (parseFloat(z.action) || 0), 0)
    const labels    = bullZones.map(z => z.label).join(', ')
    return {
      zone: 'PROFIT', action: 'sell', deployAmount: 0,
      label: `Prise de profits — ${labels}`,
      description: `Prix +${delta.toFixed(1)}% vs breakeven. DCA suspendu. Vendre ${totalSell}% de la position.`,
      sellPct: totalSell, delta, forceRecharge: false, activeZone: null,
    }
  }

  // ── Zone d'accumulation/ralentissement ───────────────────────────────────
  // Trouver la zone dont l'écart max est la borne inférieure
  // zones triées par écart décroissant → prend la 1ère dont ecart >= delta
  const activeZone = accumZones.find(z => delta <= (parseFloat(z.ecart) || 0)) || accumZones[accumZones.length - 1] || null

  const base       = activeZone ? (parseFloat(activeZone.action) || 0) : 0
  const rechargeInject = 0
  const deployAmount   = base

  let label, description, zone
  if (activeZone && deployAmount > 0) {
    const typeLabel = activeZone.type === 'ralent' ? 'Ralentissement' : 'Accumulation'
    const pctAmt    = plan.baseAmount > 0 ? Math.round(deployAmount / plan.baseAmount * 100) : 100
    zone        = activeZone.type
    label       = `${typeLabel} — ${activeZone.label} (${pctAmt}%)`
    description = delta <= 0
      ? `Prix ${Math.abs(delta).toFixed(1)}% sous le breakeven. Déployer ${deployAmount.toFixed(2)} USDT (${activeZone.label}).`
      : `Prix +${delta.toFixed(1)}% au-dessus du breakeven. Zone ${activeZone.label} active — déployer ${deployAmount.toFixed(2)} USDT.`
  } else {
    zone        = 'HOLD'
    label       = 'Aucune zone active'
    description = `Prix +${delta.toFixed(1)}% au-dessus du breakeven — au-delà des zones configurées. Aucune injection ce cycle.`
  }

  return { zone, action: deployAmount > 0 ? 'buy' : 'hold', deployAmount, base, rechargeInject, label, description, sellPct: null, delta, forceRecharge: false, activeZone }
}

/* ─── Hook React ─────────────────────────────────────────────────────────── */
export function useDcaStrategy(plan, currentPrice, pointedOps) {
  return useMemo(() => {
    if (!plan) return null
    const ops         = pointedOps || []
    const breakeven   = computeBreakeven(ops)
    const avgPrice    = computeAvgPrice(ops)
    const rechargement = computeRechargement(plan, ops)
    const signal      = computeSignal(plan, currentPrice, breakeven, rechargement)
    const buys        = ops.filter(o => o.sens === 'Achat' && o.exec)
    const sells       = ops.filter(o => o.sens === 'Vente' && o.exec)
    const totalInvested  = buys.reduce((s, o) => s + o.usdt, 0)
    const volBought      = buys.reduce((s, o) => s + (o.vol || 0), 0)
    const volSold        = sells.reduce((s, o) => s + (o.vol || 0), 0)
    const position       = volBought - volSold
    const pnlLatent      = currentPrice && position > 0 && breakeven > 0 ? position * (currentPrice - breakeven) : 0
    const rechargePct    = plan.debtCeiling ? Math.min(100, (rechargement.total / plan.debtCeiling) * 100) : 0
    return { signal, breakeven, avgPrice, rechargement, rechargePct, totalInvested, position, pnlLatent }
  }, [plan, currentPrice, pointedOps])
}
