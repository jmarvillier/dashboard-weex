/**
 * AuthGate.jsx
 * Écran de connexion Firebase (Email/Password + Google)
 * Affiché avant la Landing si l'utilisateur n'est pas connecté.
 */

import { useState } from 'react'
import Logo from './Logo.jsx'
import {
  auth,
  googleProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from '../lib/firebase.js'

export default function AuthGate() {
  const [mode, setMode]       = useState('login')   // 'login' | 'register'
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]     = useState(null)
  const [busy, setBusy]       = useState(false)

  async function handleEmail() {
    if (!email || !password) { setError('Email et mot de passe requis.'); return }
    setBusy(true); setError(null)
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email, password)
      } else {
        await createUserWithEmailAndPassword(auth, email, password)
      }
    } catch (e) {
      setError(friendlyError(e.code))
    } finally {
      setBusy(false)
    }
  }

  async function handleGoogle() {
    setBusy(true); setError(null)
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (e) {
      if (e.code !== 'auth/popup-closed-by-user') setError(friendlyError(e.code))
    } finally {
      setBusy(false)
    }
  }

  function friendlyError(code) {
    const map = {
      'auth/invalid-credential':      'Email ou mot de passe incorrect.',
      'auth/user-not-found':          'Aucun compte avec cet email.',
      'auth/wrong-password':          'Mot de passe incorrect.',
      'auth/email-already-in-use':    'Cet email est déjà utilisé.',
      'auth/weak-password':           'Mot de passe trop faible (6 car. min).',
      'auth/invalid-email':           'Email invalide.',
      'auth/too-many-requests':       'Trop de tentatives. Réessayez plus tard.',
      'auth/network-request-failed':  'Erreur réseau.',
    }
    return map[code] || `Erreur : ${code}`
  }

  return (
    <div className="auth-gate">
      <div className="auth-card">

        <div className="auth-logo">
          <Logo />
        </div>

        <div className="auth-tabs">
          <button
            className={`auth-tab${mode === 'login' ? ' active' : ''}`}
            onClick={() => { setMode('login'); setError(null) }}
          >Connexion</button>
          <button
            className={`auth-tab${mode === 'register' ? ' active' : ''}`}
            onClick={() => { setMode('register'); setError(null) }}
          >Créer un compte</button>
        </div>

        <div className="auth-fields">
          <input
            className="auth-input"
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleEmail()}
            autoComplete="email"
            disabled={busy}
          />
          <input
            className="auth-input"
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleEmail()}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            disabled={busy}
          />
        </div>

        {error && <div className="auth-error">⚠️ {error}</div>}

        <button
          className="auth-btn-primary"
          onClick={handleEmail}
          disabled={busy}
        >
          {busy ? <span className="spin" /> : null}
          {mode === 'login' ? 'Se connecter' : 'Créer le compte'}
        </button>

        <div className="auth-divider"><span>ou</span></div>

        <button
          className="auth-btn-google"
          onClick={handleGoogle}
          disabled={busy}
        >
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.7 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.7-.1-4z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 16 19 12 24 12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34 6.5 29.3 4 24 4c-7.7 0-14.3 4.4-17.7 10.7z"/>
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.8 13.5-4.7l-6.2-5.2C29.5 35.7 26.9 36 24 36c-5.2 0-9.7-2.9-11.3-7H6.1C9.5 39.6 16.2 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.9 2.4-2.5 4.4-4.5 5.8l6.2 5.2C40.8 35.8 44 30.3 44 24c0-1.3-.1-2.7-.4-4z"/>
          </svg>
          Continuer avec Google
        </button>

      </div>
    </div>
  )
}
