import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: '2rem', maxWidth: 600, margin: '4rem auto',
          background: '#1c1f27', border: '1px solid #3a1f1f',
          borderRadius: 12, color: '#e2e4e9'
        }}>
          <p style={{ fontWeight: 700, color: '#ff6b6b', marginBottom: '0.75rem' }}>
            Something crashed
          </p>
          <pre style={{
            fontSize: 12, color: '#8a8f9a', whiteSpace: 'pre-wrap',
            wordBreak: 'break-word', background: '#111317',
            padding: '0.75rem', borderRadius: 6
          }}>
            {this.state.error?.message ?? String(this.state.error)}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              marginTop: '1rem', padding: '0.5rem 1.25rem',
              background: '#a78fff', border: 'none', borderRadius: 6,
              color: '#fff', fontWeight: 600, cursor: 'pointer'
            }}
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
