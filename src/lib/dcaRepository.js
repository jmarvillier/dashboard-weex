/**
 * dcaRepository.js — CRUD Firestore pour les plans Scaled Mirror DCA
 * Pattern identique à repository.js (waitForAuth, même structure)
 */

import { collection, doc, getDocs, setDoc, deleteDoc, getDoc } from 'firebase/firestore'
import { db, auth } from './firebase.js'

/* ─── waitForAuth (dupliqué — non exporté depuis repository.js) ──────── */
function waitForAuth() {
  return new Promise((resolve, reject) => {
    if (auth.currentUser) { resolve(auth.currentUser); return }
    const unsub = auth.onAuthStateChanged(user => {
      unsub()
      if (user) resolve(user)
      else reject(new Error('Utilisateur non connecté.'))
    })
    setTimeout(() => { unsub(); reject(new Error('Timeout auth.')) }, 5000)
  })
}

function plansCollection(uid) {
  return collection(db, 'users', uid, 'dca_plans')
}

/* ─── Lire tous les plans ────────────────────────────────────────────── */
export async function getDcaPlans() {
  const user = await waitForAuth()
  const snap = await getDocs(plansCollection(user.uid))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

/* ─── Lire un plan ───────────────────────────────────────────────────── */
export async function getDcaPlan(planId) {
  const user = await waitForAuth()
  const snap = await getDoc(doc(db, 'users', user.uid, 'dca_plans', planId))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() }
}

/* ─── Sauvegarder (créer ou mettre à jour) ───────────────────────────── */
export async function saveDcaPlan(plan) {
  const user = await waitForAuth()
  const id   = plan.id || `${plan.pair.replace('/', '_')}_${Date.now()}`
  const ref  = doc(db, 'users', user.uid, 'dca_plans', id)
  const data = { ...plan, id, updatedAt: new Date().toISOString() }
  if (!plan.id) data.createdAt = new Date().toISOString()
  await setDoc(ref, data)
  return id
}

/* ─── Supprimer un plan (JAMAIS les lignes du journal) ───────────────── */
export async function deleteDcaPlan(planId) {
  const user = await waitForAuth()
  await deleteDoc(doc(db, 'users', user.uid, 'dca_plans', planId))
}
