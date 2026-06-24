/**
 * DcaDashboard.jsx — Tableau de bord d'un plan DCA actif
 */
import { useState, useMemo } from 'react'
import { fmt, pct, filterOpsForPlan, getOpKey, normPair, parseDate, migratePlanZones,
         TYPE_LABELS, TYPE_COLORS, PERIOD_LABEL, DEFAULT_ZONES } from '../../lib/dcaUtils.js'
import {
  computeBreakeven, computeAvgPrice, computeRechargement,
  computeSignal, generateTimeline, getCurrentPeriodOps,
} from '../../hooks/useDcaStrategy.js'
import { saveSnapshot, loadSnapshot } from '../../lib/repository.js'
import EntryForm from '../EntryForm.jsx'
import KpiTooltip from '../KpiTooltip.jsx'

/* ═══ DASHBOARD ═══════════════════════════════════════════════════════════ */
function DcaDashboard({ plan, rawRows, prices, priceSources = {}, onBack, onRefresh, onRegularize }) {
  const [showEntry,   setShowEntry]   = useState(false)
  const [savedMsg,    setSavedMsg]    = useState('')
  const [manualPrice, setManualPrice] = useState('')
  const [openTip,     setOpenTip]     = useState(null)
  const [syncing,     setSyncing]     = useState(false)

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

  // Lignes de régularisation en attente d'affiliation pour cette paire (flag isRegul)
  const regulCount = useMemo(
    () => (rawRows || []).filter(r => r.isRegul && r.pair === effectivePair).length,
    [rawRows, effectivePair]
  )

  // Ops du plan : planId en col 8 (source de vérité)
  // Fallback pour plans antérieurs à la migration : matcher par date+paire+montant
  // sur les rawRows correspondant aux clés plan.pointedOps
  const pointedOps = useMemo(() => {
    const byPlanId = ops.filter(o => o.planId && o.planId === plan.id)
    if (byPlanId.length > 0) return byPlanId

    // Fallback robuste : reconstruire les ops depuis les clés stockées
    // Les clés sont `${date.toISOString()}_${idx}` — on extrait la date ISO
    const legacy = plan.pointedOps || []
    if (legacy.length === 0) return []

    // Extraire les timestamps des clés stockées
    const legacyDates = legacy.map(key => {
      const iso = key.split('_')[0]
      const d = new Date(iso)
      return isNaN(d.getTime()) ? null : d.getTime()
    }).filter(Boolean)

    // Matcher chaque op par date (±2min) + paire + montant
    return ops.filter(o => {
      if (!o.date) return false
      return legacyDates.some(ts => Math.abs(o.date.getTime() - ts) < 120000)
    })
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

  async function resyncPlanIds() {
    setSyncing(true)
    try {
      const snap = await loadSnapshot()
      if (!snap?.rows) return
      const rows = snap.rows.map(r => [...r])
      let changed = false
      // Mettre planId sur toutes les lignes dont les dates correspondent aux pointedOps du plan
      const legacy = plan.pointedOps || []
      const legacyTs = legacy.map(key => {
        const iso = key.split('_')[0]; const d = new Date(iso)
        return isNaN(d.getTime()) ? null : d.getTime()
      }).filter(Boolean)
      for (let ri = 1; ri < rows.length; ri++) {
        const r = rows[ri]
        if (!r[1] || normPair(String(r[1]||'')) !== effectivePair) continue
        while (rows[ri].length <= 12) rows[ri].push('')
        const snapDate = parseDate(r[0])
        if (!snapDate) continue
        const matches = legacyTs.some(ts => Math.abs(snapDate.getTime() - ts) < 120000)
        if (matches && String(rows[ri][8]||'') !== plan.id) {
          rows[ri][8] = plan.id; changed = true
        }
      }
      if (changed) { await saveSnapshot(rows, snap.source); onRefresh?.() }
      setSavedMsg('✓ Lignes DCA synchronisées.')
      setTimeout(()=>setSavedMsg(''), 4000)
    } catch(e) { console.warn('resync:', e) }
    finally { setSyncing(false) }
  }

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
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <div style={{fontSize:'.52rem',color:'var(--green)'}}>● Actif</div>
            {pointedOps.length === 0 && (
              <button className="dca-btn" style={{fontSize:'.52rem',padding:'3px 8px',borderColor:'var(--gold)',color:'var(--gold)'}}
                onClick={resyncPlanIds} disabled={syncing}>
                {syncing ? '⏳' : '⟳ Sync lignes DCA'}
              </button>
            )}
          </div>
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
            <div className="dca-hero-sub">
            {prices[effectivePair]
             ? <>live <span style={{opacity:.6}}>· {priceSources?.[effectivePair] ?? '—'}</span></>
             : 'saisie manuelle'}
            </div>
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
          {/* Régularisation — affilier des lignes importées (OKX) au plan */}
          <button
            className="dca-btn dca-btn-ghost"
            disabled={!regulCount}
            title={regulCount ? `${regulCount} ligne(s) de régularisation pour ${effectivePair}` : `Aucune ligne de régularisation pour ${effectivePair}`}
            style={{fontSize:'.62rem',padding:'7px 14px',whiteSpace:'nowrap',flexShrink:0,borderColor:'var(--gold)',color:regulCount?'var(--gold)':'var(--muted)',opacity:regulCount?1:.45,cursor:regulCount?'pointer':'not-allowed'}}
            onClick={()=>{ if (regulCount) onRegularize?.() }}>
            ⚖️ Régularisation{regulCount?` (${regulCount})`:''}
          </button>
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
          // Zones profit : prendre la DERNIÈRE déclenchée (delta >= seuil le plus élevé atteint)
          const triggeredProfits = sorted
            .map((z, i) => ({ z, i }))
            .filter(({ z }) => z.type === 'profit' && delta >= (parseFloat(z.ecart ?? z.ecartThreshold ?? 0) || 0))
          if (triggeredProfits.length > 0) {
            activeIdx = triggeredProfits[triggeredProfits.length - 1].i
          } else {
            // Zone accum/ralent : prendre la PREMIÈRE dont le seuil >= delta
            // (zone la plus précise/proche au-dessus du cours)
            const above = sorted
              .map((z, i) => ({ z, i }))
              .filter(({ z }) => z.type !== 'profit')
              .filter(({ z }) => (parseFloat(z.ecart ?? z.ecartThreshold ?? z.ecartMin ?? 0) || 0) >= delta)
            if (above.length > 0) {
              activeIdx = above[0].i  // premier = seuil le plus bas >= delta = zone la plus précise
            } else {
              // delta dépasse toutes les zones accum/ralent → prendre la dernière
              const nonProfit = sorted.map((z, i) => ({ z, i })).filter(({ z }) => z.type !== 'profit')
              activeIdx = nonProfit.length > 0 ? nonProfit[nonProfit.length - 1].i : 0
            }
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




      </div>

      <div style={{height:16}}/>

      {showEntry && (
        <EntryForm onClose={()=>setShowEntry(false)} onSaved={onSaved} defaultPaire={effectivePair} activePlanId={plan.id}/>
      )}
    </div>
  )
}

export default DcaDashboard
