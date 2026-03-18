/**
 * dcaRepository.js — CRUD Firestore pour plans DCA + templates
 */

import { collection, doc, getDocs, setDoc, deleteDoc, getDoc } from 'firebase/firestore'
import { db, auth } from './firebase.js'

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

function plansCol(uid)     { return collection(db, 'users', uid, 'dca_plans') }
function templatesCol(uid) { return collection(db, 'users', uid, 'dca_templates') }

/* ─── Plans ──────────────────────────────────────────────────────────────── */
export async function getDcaPlans() {
  const user = await waitForAuth()
  const snap = await getDocs(plansCol(user.uid))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function saveDcaPlan(plan) {
  const user = await waitForAuth()
  const id   = plan.id || `${(plan.pair||'').replace('/', '_')}_${Date.now()}`
  const ref  = doc(db, 'users', user.uid, 'dca_plans', id)
  const data = { ...plan, id, updatedAt: new Date().toISOString() }
  if (!plan.id) data.createdAt = new Date().toISOString()
  await setDoc(ref, data)
  return id
}

export async function deleteDcaPlan(planId) {
  const user = await waitForAuth()
  await deleteDoc(doc(db, 'users', user.uid, 'dca_plans', planId))
}

/* ─── Templates ──────────────────────────────────────────────────────────── */
export async function getDcaTemplates() {
  const user = await waitForAuth()
  const snap = await getDocs(templatesCol(user.uid))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function saveDcaTemplate(template) {
  const user = await waitForAuth()
  const id   = template.id || `tpl_${Date.now()}`
  const ref  = doc(db, 'users', user.uid, 'dca_templates', id)
  await setDoc(ref, { ...template, id, updatedAt: new Date().toISOString() })
  return id
}

export async function deleteDcaTemplate(tplId) {
  const user = await waitForAuth()
  await deleteDoc(doc(db, 'users', user.uid, 'dca_templates', tplId))
}
