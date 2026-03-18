/**
 * DcaView.jsx — Orchestrateur Scaled Mirror DCA
 *
 * Responsabilités :
 *   - Gérer l'état global du wizard (écran courant, données)
 *   - Charger/sauvegarder les plans et templates Firestore
 *   - Écrire le planId (col 8) dans le journal via step2AssignPlan
 *   - Router vers les sous-composants selon l'écran actif
 */

import { useState, useEffect } from 'react'
import { getDcaPlans, saveDcaPlan, deleteDcaPlan, getDcaTemplates, saveDcaTemplate, deleteDcaTemplate } from '../../lib/dcaRepository.js'
import { saveSnapshot, loadSnapshot }  from '../../lib/repository.js'
import { filterOpsForPlan, getOpKey, newPlanId, normPair, parseDate, DEFAULT_ZONES } from '../../lib/dcaUtils.js'

import DcaList      from './dca/DcaList.jsx'
import DcaStep1     from './dca/DcaStep1.jsx'
import DcaStep2     from './dca/DcaStep2.jsx'
import DcaStep3     from './dca/DcaStep3.jsx'
import DcaDashboard from './dca/DcaDashboard.jsx'

import '../../styles/dca/dca-base.css'
import '../../styles/dca/dca-list.css'
import '../../styles/dca/dca-wizard.css'
import '../../styles/dca/dca-dashboard.css'

/* ── Wizard initial state ────────────────────────────────────────────────── */

const makeWizard = (firstPair = '') => ({
  pair:        firstPair,
  customPair:  '',
  startDate:   '',
  endDate:     '',
  pointedOps:  undefined,
  planId:      newPlanId(firstPair || 'plan'),
  params: {
    baseAmount: 10,
    frequency:  'day',
    zones:      [...DEFAULT_ZONES],
  },
})

/* ── Assignation du planId dans le journal (col 8) ───────────────────────── */

async function assignPlanIds(ops, pointed, planId) {
  try {
    const snap = await loadSnapshot()
    if (!snap?.rows) return
    const rows = snap.rows.map(r => [...r])
    let changed = false

    // Index snapshot : timestamp → [rowIdx]
    const snapIndex = {}
    for (let ri = 1; ri < rows.length; ri++) {
      const r = rows[ri]
      if (!r[1]) continue
      const d = parseDate(r[0])
      if (!d) continue
      const ts = d.getTime()
      if (!snapIndex[ts]) snapIndex[ts] = []
      snapIndex[ts].push(ri)
    }

    const usedRowIdx = new Set()
    for (let i = 0; i < ops.length; i++) {
      const op        = ops[i]
      const isPointed = pointed.includes(getOpKey(op, i))
      if (!op.date) continue

      let rowIdx = -1
      const opTs = op.date.getTime()

      for (const [tsKey, idxList] of Object.entries(snapIndex)) {
        if (Math.abs(Number(tsKey) - opTs) > 86400000 * 2) continue
        for (const ri of idxList) {
          if (usedRowIdx.has(ri)) continue
          const r = rows[ri]
          if (normPair(String(r[1] || '').trim()) !== op.pair) continue
          const snapSens = String(r[2] || '').trim().toLowerCase()
          const opSens   = String(op.sens || '').trim().toLowerCase()
          if (snapSens && opSens && snapSens !== opSens) continue
          const snapAmt = (parseFloat(r[5]) || 0) || (parseFloat(r[6]) || 0) || (parseFloat(r[7]) || 0)
          if (op.usdt > 0 && Math.abs(snapAmt - op.usdt) > 2) continue
          rowIdx = ri
          break
        }
        if (rowIdx >= 0) break
      }

      if (rowIdx < 0) continue
      usedRowIdx.add(rowIdx)
      while (rows[rowIdx].length <= 12) rows[rowIdx].push('')
      const cur = String(rows[rowIdx][8] || '')
      if (isPointed && cur !== planId) { rows[rowIdx][8] = planId; changed = true }
      else if (!isPointed && cur === planId) { rows[rowIdx][8] = ''; changed = true }
    }

    if (changed) await saveSnapshot(rows, snap.source)
  } catch (e) {
    console.warn('assignPlanIds error:', e)
  }
}

/** Efface le planId (col 8) de toutes les lignes liées à un plan supprimé */
async function clearPlanIds(planId) {
  try {
    const snap = await loadSnapshot()
    if (!snap?.rows) return
    const rows = snap.rows.map(r => [...r])
    let changed = false
    for (let ri = 1; ri < rows.length; ri++) {
      while (rows[ri].length <= 8) rows[ri].push('')
      if (String(rows[ri][8] || '') === planId) { rows[ri][8] = ''; changed = true }
    }
    if (changed) await saveSnapshot(rows, snap.source)
  } catch (e) {
    console.warn('clearPlanIds error:', e)
  }
}

/* ── Orchestrateur ───────────────────────────────────────────────────────── */

export default function DcaView({ pairList = [], rawRows = [], prices = {}, onRefresh }) {
  const [screen,      setScreen]      = useState('list')
  const [plans,       setPlans]       = useState([])
  const [templates,   setTemplates]   = useState([])
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [wizardErr,   setWizardErr]   = useState('')
  const [currentPlan, setCurrentPlan] = useState(null)
  const [wizard,      setWizard]      = useState(() => makeWizard(pairList[0]?.name))

  useEffect(() => {
    Promise.all([getDcaPlans(), getDcaTemplates()])
      .then(([p, t]) => { setPlans(p); setTemplates(t) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  /* ── Navigation ── */
  const openPlan      = plan => { setCurrentPlan(plan); setScreen('dashboard') }
  const startWizard   = ()   => { setWizard(makeWizard(pairList[0]?.name)); setCurrentPlan(null); setScreen(1) }
  const backToList    = ()   => setScreen('list')

  /* ── Plans ── */
  const deletePlan = async id => {
    await deleteDcaPlan(id)
    setPlans(p => p.filter(x => x.id !== id))
    await clearPlanIds(id)
  }

  /* ── Templates ── */
  const saveTemplate = async name => {
    if (templates.some(t => t.name.trim().toLowerCase() === name.toLowerCase())) return
    const p   = wizard.params || {}
    const tpl = { name, baseAmount: p.baseAmount ?? 10, frequency: p.frequency ?? 'day', zones: p.zones || DEFAULT_ZONES }
    const id  = await saveDcaTemplate(tpl)
    setTemplates(prev => { const ex = prev.find(t => t.id === id); return ex ? prev.map(t => t.id === id ? { ...tpl, id } : t) : [...prev, { ...tpl, id }] })
  }

  const deleteTemplate = async id => {
    await deleteDcaTemplate(id)
    setTemplates(t => t.filter(x => x.id !== id))
  }

  const loadTemplate = tpl => setWizard(w => ({
    ...w,
    params: { baseAmount: tpl.baseAmount, frequency: tpl.frequency, zones: tpl.zones || DEFAULT_ZONES },
  }))

  /* ── Wizard navigation ── */
  const step1Next = () => {
    const pair = wizard.pair === 'NEW' ? wizard.customPair : wizard.pair
    if (plans.some(p => p.pair === pair)) {
      setWizardErr(`Un plan DCA existe déjà pour ${pair}. Supprimez-le avant d'en créer un nouveau.`)
      return
    }
    setWizardErr('')
    const hasOps = rawRows.some(r => r.pair === pair && r.exec)
    setScreen(hasOps ? 2 : 3)
  }

  /* ── Sauvegarde finale ── */
  const step3Save = async () => {
    setSaving(true)
    try {
      const pair    = wizard.pair === 'NEW' ? wizard.customPair : wizard.pair
      const ops     = filterOpsForPlan(rawRows, pair, wizard.startDate, wizard.endDate)
      const pointed = wizard.pointedOps || []
      const pOps    = ops.filter((op, i) => pointed.includes(getOpKey(op, i)))
      const firstDate  = pOps.filter(o => o.sens === 'Achat' && o.date).sort((a, b) => a.date - b.date)[0]?.date
      const startDate  = wizard.startDate || (firstDate ? firstDate.toISOString().split('T')[0] : '')
      const planId     = wizard.planId || newPlanId(pair)
      const p          = wizard.params || {}
      const planData   = { id: planId, pair, startDate, endDate: wizard.endDate || null, baseAmount: p.baseAmount ?? 10, frequency: p.frequency ?? 'day', zones: p.zones || DEFAULT_ZONES }
      const id         = await saveDcaPlan(planData)
      await assignPlanIds(ops, pointed, id)
      const saved      = { ...planData, id }
      setCurrentPlan(saved)
      setPlans(prev => { const ex = prev.find(x => x.id === id); return ex ? prev.map(x => x.id === id ? saved : x) : [...prev, saved] })
      onRefresh?.()
      setScreen('dashboard')
    } catch (e) {
      console.error('step3Save:', e)
    } finally {
      setSaving(false)
    }
  }

  /* ── Render ── */
  return (
    <div className="dca-page">
      {screen === 'list' && (
        <DcaList
          plans={plans} loading={loading}
          onNew={startWizard} onOpen={openPlan} onDelete={deletePlan}
          templates={templates} onDeleteTpl={deleteTemplate}
        />
      )}
      {screen === 1 && (
        <DcaStep1
          wizard={wizard} setWizard={setWizard}
          pairList={pairList} rawRows={rawRows}
          onNext={step1Next} onBack={backToList}
          wizardErr={wizardErr}
        />
      )}
      {screen === 2 && (
        <DcaStep2
          wizard={wizard} setWizard={setWizard}
          rawRows={rawRows}
          onNext={() => setScreen(3)} onBack={() => setScreen(1)}
          onAssignPlanIds={(ops, pointed) => assignPlanIds(ops, pointed, wizard.planId)}
        />
      )}
      {screen === 3 && (
        <DcaStep3
          wizard={wizard} setWizard={setWizard}
          rawRows={rawRows}
          onNext={step3Save} onBack={() => setScreen(2)}
          saving={saving}
          templates={templates} onSaveTpl={saveTemplate} onLoadTpl={loadTemplate}
        />
      )}
      {screen === 'dashboard' && currentPlan && (
        <DcaDashboard
          plan={currentPlan}
          rawRows={rawRows}
          prices={prices}
          onBack={backToList}
          onRefresh={onRefresh}
        />
      )}
    </div>
  )
}
