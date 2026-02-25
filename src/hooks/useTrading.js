/**
 * useTrading.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Hook principal de l'application.
 *
 * Architecture des sources de données :
 *   1. Charger depuis l'iPad  → parse → saveSnapshot() → ingest
 *   2. Charger depuis GSheets → parse → saveSnapshot() → ingest
 *   3. Ouvrir le dashboard    → loadSnapshot()         → ingest
 *
 * La source de vérité est IndexedDB (repository local gratuit).
 */

import { useState, useCallback, useEffect } from 'react'
import { parseCSV, isUsdPair } from '../lib/parser.js'
import { process, buildPairList } from '../lib/process.js'
import { saveSnapshot, loadSnapshot, hasSnapshot, clearSnapshot } from '../lib/repository.js'

// ── Fetcher CSV depuis un Google Sheet ID ────────────────────────────────────

const SHEET_URLS = (id) => [
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
    } catch (e) {
      lastErr = e.message
    }
  }
  return { csv: null, err: lastErr }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useTrading() {
  const [view, setView]               = useState('landing')
  const [zone, setZone]               = useState(null)       // null | 'local' | 'drive'
  const [loading, setLoading]         = useState(false)
  const [loadingTxt, setLoadingTxt]   = useState('')
  const [fileName, setFileName]       = useState('')
  const [loadedAt, setLoadedAt]       = useState('')
  const [pairList, setPairList]       = useState([])
  const [excluded, setExcluded]       = useState(new Set())
  const [driveErr, setDriveErr]       = useState(null)
  const [repoAvailable, setRepoAvailable] = useState(false)

  // Vérifie si des données existent au montage
  useEffect(() => {
    hasSnapshot().then(setRepoAvailable)
  }, [])

  // ── Helpers ──────────────────────────────────────────────────────────────

  const startLoading = (txt) => { setLoadingTxt(txt); setLoading(true) }
  const stopLoading  = ()    => setLoading(false)

  function ingest(rows, name, isoDate = null) {
    const P    = process(rows)
    const list = buildPairList(P)
    const autoExcl = new Set(list.filter(p => isUsdPair(p.name)).map(p => p.name))
    setPairList(list)
    setExcluded(autoExcl)
    setFileName(name)
    setLoadedAt(
      isoDate
        ? new Date(isoDate).toLocaleTimeString('fr-FR')
        : new Date().toLocaleTimeString('fr-FR')
    )
    setView('dashboard')
    setZone(null)
    setRepoAvailable(true)
  }

  // ── Action 1 : Ouvrir depuis le repository (IndexedDB) ───────────────────

  const openFromRepository = useCallback(async () => {
    startLoading('Chargement depuis le repository…')
    try {
      const snapshot = await loadSnapshot()
      stopLoading()
      if (!snapshot || !snapshot.rows || snapshot.rows.length < 2) {
        alert('Aucune donnée trouvée dans le repository.')
        return
      }
      ingest(snapshot.rows, snapshot.source, snapshot.loadedAt)
    } catch (err) {
      stopLoading()
      alert('Erreur repository : ' + err.message)
    }
  }, [])

  // ── Action 2 : Importer depuis un fichier local (iPad) ───────────────────

  const loadFromFile = useCallback((file) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        startLoading('Lecture du fichier…')
        let rows

        if (file.name.toLowerCase().endsWith('.csv')) {
          rows = parseCSV(new TextDecoder('utf-8').decode(e.target.result))
        } else {
          const wb = window.XLSX.read(new Uint8Array(e.target.result), { type: 'array' })
          const ws = wb.Sheets[wb.SheetNames[0]]
          rows = window.XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
        }

        if (!rows || rows.length < 2) throw new Error('Fichier vide ou format non reconnu.')

        setLoadingTxt('Sauvegarde dans le repository…')
        await saveSnapshot(rows, file.name)

        stopLoading()
        ingest(rows, file.name)
      } catch (err) {
        stopLoading()
        alert('❌ ' + err.message)
      }
    }
    reader.readAsArrayBuffer(file)
  }, [])

  // ── Action 3 : Importer depuis Google Sheets ─────────────────────────────

  const loadFromDrive = useCallback(async (rawUrl) => {
    const m  = rawUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/)
    const id = m
      ? m[1]
      : (/^[a-zA-Z0-9_-]{20,}$/.test(rawUrl) ? rawUrl : null)

    if (!id) {
      setDriveErr({ msg: "❌ Lien non reconnu. Colle l'URL complète du Google Sheet.", type: 'err' })
      return
    }

    setDriveErr(null)
    startLoading('Connexion à Google Sheets…')

    const { csv, err } = await fetchCSV(id)
    if (!csv) {
      stopLoading()
      setDriveErr({
        msg  : `❌ Échec (${err}). Publie via <strong>Fichier → Publier sur le web → CSV</strong>.`,
        type : 'err',
      })
      return
    }

    const rows = parseCSV(csv)
    if (rows.length < 2) {
      stopLoading()
      setDriveErr({ msg: '❌ Données insuffisantes.', type: 'err' })
      return
    }

    setLoadingTxt('Sauvegarde dans le repository…')
    await saveSnapshot(rows, 'Google Sheet')

    stopLoading()
    ingest(rows, 'Google Sheet')
  }, [])

  // ── Effacer le repository ─────────────────────────────────────────────────

  const clearRepository = useCallback(async () => {
    if (!window.confirm('Supprimer toutes les données sauvegardées ?')) return
    await clearSnapshot()
    setRepoAvailable(false)
    backToLanding()
  }, [])

  // ── Flag exclusion ────────────────────────────────────────────────────────

  const toggleFlag = useCallback((pairName) => {
    setExcluded((prev) => {
      const next = new Set(prev)
      next.has(pairName) ? next.delete(pairName) : next.add(pairName)
      return next
    })
  }, [])

  // ── Navigation ────────────────────────────────────────────────────────────

  const backToLanding = useCallback(() => {
    setView('landing')
    setZone(null)
    setPairList([])
    setExcluded(new Set())
    setDriveErr(null)
  }, [])

  return {
    view, zone, loading, loadingTxt,
    fileName, loadedAt, pairList, excluded, driveErr,
    repoAvailable,
    setZone, setDriveErr,
    openFromRepository,
    loadFromFile,
    loadFromDrive,
    clearRepository,
    toggleFlag,
    backToLanding,
  }
}
