/**
 * DcaStep3.jsx — Wizard étape 3 : paramétrage de la stratégie
 */
import { useState, useMemo } from 'react'
import { filterOpsForPlan, getOpKey, fmt, DEFAULT_ZONES, TYPE_LABELS, TYPE_COLORS } from '../../../lib/dcaUtils.js'
import { computeBreakeven } from '../../../hooks/useDcaStrategy.js'
import Stepper from './DcaStepper.jsx'

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

      <div className="dca-btm" style={{position:'sticky',bottom:0,background:'var(--bg2)',zIndex:10,borderTop:'1px solid var(--border)',marginTop:8}}>
        <button className="dca-btn dca-btn-ghost" onClick={onBack}>← Retour</button>
        <span className="dca-step-hint">Étape 3 / 3</span>
        <button className="dca-btn dca-btn-success" disabled={!canSubmit||saving} onClick={()=>setShowConfirm(true)}>Créer le plan DCA ✓</button>
      </div>
    </div>
  )
}

export default Step3
