/**
 * ErrorBoundary.jsx
 * Capture les erreurs React et affiche un message au lieu d'un écran noir.
 */
import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null, info: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    this.setState({ info })
    console.error('[ErrorBoundary]', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: '40px 24px',
          fontFamily: 'monospace',
          background: '#0d1117',
          color: '#e6edf3',
          minHeight: '100vh',
          boxSizing: 'border-box',
        }}>
          <div style={{ color: '#f85149', fontSize: '1.2rem', fontWeight: 700, marginBottom: 16 }}>
            💥 Erreur — {this.state.error.message}
          </div>
          <pre style={{
            background: '#161b22',
            padding: 16,
            borderRadius: 8,
            fontSize: '0.7rem',
            overflowX: 'auto',
            color: '#8b949e',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}>
            {this.state.error.stack}
          </pre>
          {this.state.info && (
            <pre style={{
              background: '#161b22',
              padding: 16,
              borderRadius: 8,
              fontSize: '0.7rem',
              overflowX: 'auto',
              color: '#8b949e',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              marginTop: 12,
            }}>
              {this.state.info.componentStack}
            </pre>
          )}
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 24,
              padding: '10px 20px',
              background: '#21262d',
              border: '1px solid #30363d',
              color: '#e6edf3',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: '0.8rem',
            }}
          >
            ↺ Recharger
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
