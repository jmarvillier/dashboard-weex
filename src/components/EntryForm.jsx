/**
 * EntryForm.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Formulaire de saisie d'une nouvelle ligne de trading.
 *
 * Structure des colonnes (identique au journal Excel) :
 *   [0]  Date + heure
 *   [1]  Paire
 *   [2]  Sens         (Achat | Vente | Dépôt | Retrait)
 *   [3]  Statut       (Exécuté | Annulé | En attente)
 *   [4]  Cours
 *   [5]  Montant USDT
 *   [6]  Montant USDC
 *   [7]  Montant EUR
 *   [8]  (réservé)
 *   [9]  (réservé)
 *   [10] Volume
 *   [11] Notes
 *   [12] Dashboard    (true | false)
 */

import { useState, useRef, useEffect } from 'react'
import { appendRow } from '../lib/repository.js'

// ── Helpers date ──────────────────────────────────────────────────────────────

/** Retourne "YYYY-MM-DDTHH:MM" (format datetime-local) pour maintenant */
function nowLocal() {
  const d = new Date()
  d.setSeconds(0, 0)
  // Compense le décalage UTC → local
  const offset = d.getTimezoneOffset() * 60000
  return new Date(d - offset).toISOString().slice(0, 16)
}

// ── Données statiques ─────────────────────────────────────────────────────────

const makeInitial = (paire = '') => ({
  datetime  : nowLocal(),
  paire,
  sens      : 'Achat',
  statut    : 'Exécuté',
  cours     : '',
  usdt      : '',
  usdc      : '',
  eur       : '',
  volume    : '',
  notes     : '',
  dashboard : true,
})
const INITIAL = makeInitial()

const SENS_OPTIONS = [
  { label: 'Achat',   icon: '↑', key: 'achat'   },
  { label: 'Vente',   icon: '↓', key: 'vente'   },
  { label: 'Dépôt',  icon: '⊕', key: 'depot'   },
  { label: 'Retrait', icon: '⊖', key: 'retrait' },
]

const STATUT_OPTIONS = ['Exécuté', 'Annulé', 'En attente']

// Paires connues — base de l'autocomplete
const ALL_PAIRS = [
  'BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT',
  'ADA/USDT', 'AVAX/USDT', 'DOT/USDT', 'MATIC/USDT', 'LINK/USDT',
  'DOGE/USDT', 'LTC/USDT', 'BCH/USDT', 'UNI/USDT', 'ATOM/USDT',
  'FIL/USDT', 'APT/USDT', 'ARB/USDT', 'OP/USDT', 'SUI/USDT',
  'XAG/USDT', 'USDT/EUR', 'USDC/EUR', 'BTC/EUR', 'ETH/EUR',
]

// ── Sous-composant : PaireInput (autocomplete custom) ─────────────────────────

function PaireInput({ value, onChange }) {
  const [open, setOpen]         = useState(false)
  const [highlighted, setHl]    = useState(0)
  const wrapRef                 = useRef()
  const inputRef                = useRef()

  // Suggestions filtrées selon la saisie
  const suggestions = value.length === 0
    ? ALL_PAIRS.slice(0, 8)
    : ALL_PAIRS.filter(p =>
        p.toLowerCase().includes(value.toLowerCase())
      ).slice(0, 8)

  // Ferme la liste si clic extérieur
  useEffect(() => {
    function onClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function handleInput(e) {
    onChange(e.target.value.toUpperCase())
    setOpen(true)
    setHl(0)
  }

  function handleSelect(pair) {
    onChange(pair)
    setOpen(false)
    inputRef.current?.blur()
  }

  function handleKeyDown(e) {
    if (!open) { if (e.key === 'ArrowDown') setOpen(true); return }
    if (e.key === 'ArrowDown')  { e.preventDefault(); setHl(h => Math.min(h + 1, suggestions.length - 1)) }
    if (e.key === 'ArrowUp')    { e.preventDefault(); setHl(h => Math.max(h - 1, 0)) }
    if (e.key === 'Enter')      { e.preventDefault(); if (suggestions[highlighted]) handleSelect(suggestions[highlighted]) }
    if (e.key === 'Escape')     { setOpen(false) }
  }

  return (
    <div className="ac-wrap" ref={wrapRef}>
      <input
        ref={inputRef}
        type="text"
        className="ef-input"
        placeholder="ex: BTC/USDT"
        value={value}
        onChange={handleInput}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
      />
      {open && suggestions.length > 0 && (
        <ul className="ac-list">
          {suggestions.map((pair, i) => (
            <li
              key={pair}
              className={`ac-item${i === highlighted ? ' ac-item-hl' : ''}`}
              onMouseDown={() => handleSelect(pair)}
              onMouseEnter={() => setHl(i)}
            >
              <span className="ac-pair">{pair}</span>
              {value && pair.startsWith(value) && (
                <span className="ac-badge">exact</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────

export default function EntryForm({ onClose, onSaved, defaultPaire = '', flagDca = false, flagRecharge = false }) {
  const [form, setForm]       = useState(() => makeInitial(defaultPaire))
  const [isDca, setIsDca]         = useState(flagDca)
  const [isRecharge, setIsRecharge] = useState(flagRecharge)
  const [busy, setBusy]       = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError]     = useState(null)

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
    setError(null)
  }

  function validate() {
    if (!form.datetime)       return 'La date et heure sont obligatoires.'
    if (!form.paire.trim())   return 'La paire est obligatoire.'
    if (!form.sens)           return 'Le sens est obligatoire.'
    if (!form.statut)         return 'Le statut est obligatoire.'
    return null
  }

  function toRow() {
    // Construit la note : texte libre + flags techniques
    const flags = []
    if (isDca)      flags.push('[DCA]')
    if (isRecharge) flags.push('[RECHARGE_DCA]')
    const notesValue = [form.notes.trim(), ...flags].filter(Boolean).join(' ')
    return [
      form.datetime,
      form.paire.trim(),
      form.sens,
      form.statut,
      form.cours  || '',
      form.usdt   || '',
      form.usdc   || '',
      form.eur    || '',
      '',
      '',
      form.volume || '',
      notesValue,
      form.dashboard ? 'true' : 'false',
    ]
  }

  async function handleSubmit() {
    const err = validate()
    if (err) { setError(err); return }

    setBusy(true)
    try {
      await appendRow(toRow())
      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        setForm(makeInitial(defaultPaire))
        onSaved?.()
      }, 1400)
    } catch (e) {
      setError('Erreur lors de la sauvegarde : ' + e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="ef-overlay">
      <div className="ef-modal">

        {/* Header */}
        <div className="ef-header">
          <div className="ef-title">✏️ Nouvelle entrée</div>
          <button className="ef-close" onClick={onClose}>✕</button>
        </div>

        {success && <div className="ef-success">✅ Entrée sauvegardée dans le repository !</div>}
        {error   && <div className="ef-error">❌ {error}</div>}

        <div className="ef-body">

          {/* ── Ligne 1 : Date + heure / Paire ── */}
          <div className="ef-row">
            <div className="ef-field">
              <label className="ef-label">Date &amp; heure *</label>
              <input
                type="datetime-local"
                className="ef-input"
                value={form.datetime}
                onChange={e => set('datetime', e.target.value)}
              />
            </div>
            <div className="ef-field ef-field-wide">
              <label className="ef-label">Paire *</label>
              <PaireInput
                value={form.paire}
                onChange={v => set('paire', v)}
              />
            </div>
          </div>

          {/* ── Ligne 2 : Sens + Statut ── */}
          <div className="ef-row">
            <div className="ef-field">
              <label className="ef-label">Sens *</label>
              <div className="ef-seg ef-seg-wrap">
                {SENS_OPTIONS.map(({ label, icon, key }) => (
                  <button
                    key={label}
                    type="button"
                    className={`ef-seg-btn${form.sens === label ? ' active' : ''} sens-${key}`}
                    onClick={() => set('sens', label)}
                  >
                    {icon} {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="ef-field">
              <label className="ef-label">Statut *</label>
              <div className="ef-seg ef-seg-wrap">
                {STATUT_OPTIONS.map(opt => (
                  <button
                    key={opt}
                    type="button"
                    className={`ef-seg-btn${form.statut === opt ? ' active' : ''}`}
                    onClick={() => set('statut', opt)}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Ligne 3 : Cours + Volume ── */}
          <div className="ef-row">
            <div className="ef-field">
              <label className="ef-label">Cours</label>
              <div className="ef-input-wrap">
                <input
                  type="number"
                  className="ef-input"
                  placeholder="0.00"
                  min="0"
                  step="any"
                  value={form.cours}
                  onChange={e => set('cours', e.target.value)}
                />
                <span className="ef-unit">USDT</span>
              </div>
            </div>
            <div className="ef-field">
              <label className="ef-label">Volume</label>
              <input
                type="number"
                className="ef-input"
                placeholder="0.00000"
                min="0"
                step="any"
                value={form.volume}
                onChange={e => set('volume', e.target.value)}
              />
            </div>
          </div>

          {/* ── Ligne 4 : Montants ── */}
          <div className="ef-section-title">Montant</div>
          <div className="ef-row ef-row-3">
            <div className="ef-field">
              <label className="ef-label">USDT</label>
              <div className="ef-input-wrap">
                <input
                  type="number" className="ef-input" placeholder="0.00"
                  min="0" step="any" value={form.usdt}
                  onChange={e => set('usdt', e.target.value)}
                />
                <span className="ef-unit">$</span>
              </div>
            </div>
            <div className="ef-field">
              <label className="ef-label">USDC</label>
              <div className="ef-input-wrap">
                <input
                  type="number" className="ef-input" placeholder="0.00"
                  min="0" step="any" value={form.usdc}
                  onChange={e => set('usdc', e.target.value)}
                />
                <span className="ef-unit">$</span>
              </div>
            </div>
            <div className="ef-field">
              <label className="ef-label">EUR</label>
              <div className="ef-input-wrap">
                <input
                  type="number" className="ef-input" placeholder="0.00"
                  min="0" step="any" value={form.eur}
                  onChange={e => set('eur', e.target.value)}
                />
                <span className="ef-unit">€</span>
              </div>
            </div>
          </div>

          {/* ── Ligne 5 : Notes ── */}
          <div className="ef-field">
            <label className="ef-label">Notes</label>
            <textarea
              className="ef-textarea"
              placeholder="Commentaire libre…"
              rows={2}
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
            />
          </div>

          {/* ── DCA flags — même style que le toggle Dashboard ── */}
          <div className="ef-toggle-row" style={{flexDirection:'column',alignItems:'stretch',gap:8}}>
            <label className="ef-toggle-label">
              <div
                className={`ef-toggle${isDca ? ' on' : ''}`}
                onClick={() => setIsDca(v => !v)}
              >
                <div className="ef-toggle-thumb" />
              </div>
              Inclure dans le plan DCA
              <span className="ef-toggle-hint" style={{marginLeft:'auto'}}>
                {isDca ? '✅ Compté dans le suivi DCA' : '⛔ Ignoré du suivi DCA'}
              </span>
            </label>
            <label className="ef-toggle-label">
              <div
                className={`ef-toggle${isRecharge ? ' on' : ''}`}
                style={isRecharge ? {background:'rgba(74,128,168,.2)',borderColor:'rgba(74,128,168,.5)'} : {}}
                onClick={() => setIsRecharge(v => !v)}
              >
                <div className="ef-toggle-thumb" style={isRecharge ? {left:18,background:'var(--blue)'} : {}} />
              </div>
              Rechargement DCA
              <span className="ef-toggle-hint" style={{marginLeft:'auto'}}>
                {isRecharge ? '⚡ Décompté du solde de rechargement' : '— Achat DCA standard'}
              </span>
            </label>
          </div>

          {/* ── Ligne 6 : Dashboard toggle ── */}
          <div className="ef-toggle-row">
            <label className="ef-toggle-label">
              <div
                className={`ef-toggle${form.dashboard ? ' on' : ''}`}
                onClick={() => set('dashboard', !form.dashboard)}
              >
                <div className="ef-toggle-thumb" />
              </div>
              Inclure dans le Dashboard
            </label>
            <span className="ef-toggle-hint">
              {form.dashboard ? '✅ Visible dans les calculs' : '⛔ Exclu des calculs'}
            </span>
          </div>

        </div>

        {/* Footer */}
        <div className="ef-footer">
          <button className="ef-btn-cancel" onClick={onClose} disabled={busy}>
            Annuler
          </button>
          <button className="ef-btn-save" onClick={handleSubmit} disabled={busy || success}>
            {busy ? <><span className="spin" /> Sauvegarde…</> : '💾 Sauvegarder'}
          </button>
        </div>

      </div>
    </div>
  )
}
