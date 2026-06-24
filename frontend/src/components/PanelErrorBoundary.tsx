import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  name?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class PanelErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error(`ErrorBoundary [${this.props.name || 'Panel'}]:`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          color: '#94a3b8',
          background: '#0f172a',
          borderRadius: '8px',
          border: '1px solid #1e293b',
          gap: '0.5rem',
          minHeight: '100px',
        }}>
          <AlertTriangle size={24} color="#f59e0b" />
          <p style={{ fontSize: '0.85rem', margin: 0 }}>
            {this.props.name || 'Component'} encountered an error
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              padding: '0.3rem 0.6rem',
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '4px',
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: '0.75rem',
            }}
          >
            <RefreshCcw size={12} /> Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
