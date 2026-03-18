/**
 * DcaList.jsx — Liste des plans DCA et gestion des templates
 */
import { useState } from 'react'
import { PERIOD_LABEL } from '../../lib/dcaUtils.js'

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

export default DcaList
