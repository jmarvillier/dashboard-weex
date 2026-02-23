import { useState, useCallback } from 'react'
import { DEFAULT_SHEET_ID, DEFAULT_SHEET_NAME, DEFAULT_SHEET_URL } from '../lib/config.js'
import { parseCSV, isUsdPair } from '../lib/parser.js'
import { process, buildPairList } from '../lib/process.js'

const SHEET_URLS = id => [
  `https://docs.google.com/spreadsheets/d/${id}/export?format=csv`,
  `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv`,
]

async function fetchCSV(id) {
  let lastErr = ''
  for (const url of SHEET_URLS(id)) {
    try {
      const res = await fetch(url, { mode: 'cors' })
      if (!res.ok) { lastErr = `HTTP ${res.status}`; continue }
      const txt = await res.text()
      if (txt.trim().startsWith('<')) { lastErr = 'Accès refusé (HTML)'; continue }
      if (txt.length < 10) { lastErr = 'Contenu vide'; continue }
      return { csv: txt, err: null }
    } catch (e) { lastErr = e.message }
  }
  return { csv: null, err: lastErr }
}

export function useTrading() {
  const [view, setView]           = useState('landing')   // 'landing' | 'dashboard'
  const [zone, setZone]           = useState(null)        // null | 'local' | 'drive'
  const [loading, setLoading]     = useState(false)
  const [loadingTxt, setLoadingTxt] = useState('')
  const [fileName, setFileName]   = useState('')
  const [loadedAt, setLoadedAt]   = useState('')
  const [pairList, setPairList]   = useState([])
  const [excluded, setExcluded]   = useState(new Set())
  const [driveErr, setDriveErr]   = useState(null)        // { msg, type }

  // ── Helpers ──
  const startLoading = txt => { setLoadingTxt(txt); setLoading(true) }
  const stopLoading  = ()  => setLoading(false)

  function ingest(rows, name) {
    const P    = process(rows)
    const list = buildPairList(P)
    const autoExcl = new Set(list.filter(p => isUsdPair(p.name)).map(p => p.name))
    setPairList(list)
    setExcluded(autoExcl)
    setFileName(name)
    setLoadedAt(new Date().toLocaleTimeString('fr-FR'))
    setView('dashboard')
    setZone(null)
  }

  // ── Loaders ──
  const loadDefault = useCallback(async () => {
    startLoading('Chargement de ton journal WEEX…')
    const { csv, err } = await fetchCSV(DEFAULT_SHEET_ID)
    stopLoading()
    if (!csv) {
      setZone('drive')
      setDriveErr({ msg: `⚠️ Sheet non publié (${err}). Publie-le via <strong>Fichier → Publier sur le web → CSV</strong> puis clique Charger.`, type: 'warn' })
      return
    }
    const rows = parseCSV(csv)
    if (rows.length < 2) {
      setZone('drive')
      setDriveErr({ msg: '❌ Données insuffisantes.', type: 'err' })
      return
    }
    ingest(rows, DEFAULT_SHEET_NAME)
  }, [])

  const reloadDefault = useCallback(async () => {
    startLoading('Actualisation…')
    const { csv } = await fetchCSV(DEFAULT_SHEET_ID)
    stopLoading()
    if (!csv) { alert('Impossible de recharger. Vérifie que le sheet est publié.'); return }
    const rows = parseCSV(csv)
    if (rows.length < 2) { alert('Données insuffisantes.'); return }
    ingest(rows, DEFAULT_SHEET_NAME)
  }, [])

  const loadFromDrive = useCallback(async (rawUrl) => {
    const m = rawUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/)
    const id = m ? m[1] : (/^[a-zA-Z0-9_-]{20,}$/.test(rawUrl) ? rawUrl : null)
    if (!id) { setDriveErr({ msg: '❌ Lien non reconnu.', type: 'err' }); return }
    setDriveErr(null)
    startLoading('Chargement…')
    const { csv, err } = await fetchCSV(id)
    stopLoading()
    if (!csv) {
      setDriveErr({ msg: `❌ Échec (${err}). Publie via <strong>Fichier → Publier sur le web → CSV</strong>.`, type: 'err' })
      return
    }
    const rows = parseCSV(csv)
    if (rows.length < 2) { setDriveErr({ msg: '❌ Données insuffisantes.', type: 'err' }); return }
    ingest(rows, 'Google Sheet')
  }, [])

  const loadFromFile = useCallback((file) => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        let rows
        if (file.name.toLowerCase().endsWith('.csv')) {
          rows = parseCSV(new TextDecoder('utf-8').decode(e.target.result))
        } else {
          const wb = window.XLSX.read(new Uint8Array(e.target.result), { type: 'array' })
          const ws = wb.Sheets[wb.SheetNames[0]]
          rows = window.XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
        }
        if (!rows || rows.length < 2) throw new Error('Fichier vide ou format non reconnu.')
        ingest(rows, file.name)
      } catch (err) {
        alert('❌ ' + err.message)
      }
    }
    reader.readAsArrayBuffer(file)
  }, [])

  // ── Flag exclusion ──
  const toggleFlag = useCallback((pairName) => {
    setExcluded(prev => {
      const next = new Set(prev)
      next.has(pairName) ? next.delete(pairName) : next.add(pairName)
      return next
    })
  }, [])

  // ── Nav ──
  const backToLanding = useCallback(() => {
    setView('landing')
    setZone(null)
    setPairList([])
    setExcluded(new Set())
    setDriveErr(null)
  }, [])

  return {
    // state
    view, zone, loading, loadingTxt,
    fileName, loadedAt, pairList, excluded, driveErr,
    // actions
    setZone, setDriveErr,
    loadDefault, reloadDefault, loadFromDrive, loadFromFile,
    toggleFlag, backToLanding,
  }
}
