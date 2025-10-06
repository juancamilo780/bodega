import React, { useMemo, useState } from 'react';
import logo from '../assets/logo-samara.png';
import { CaptureView } from './CaptureView';
import { LoginView } from './LoginView';
import { OrdersView } from './OrdersView';

type Page = 'capture' | 'orders';
type Role = 'admin' | 'bodega' | 'callcenter';

type OperatorInfo = {
  id: string;
  name: string;
  role: Role;
};

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [operator, setOperator] = useState<OperatorInfo | null>(null);
  const [page, setPage] = useState<Page>('capture');

  // Base de API *relativa* (no se quema dominio/puerto)
  const apiBase = useMemo(() => {
    const prefix = import.meta.env.VITE_API_PREFIX || '/api';
    return prefix.replace(/\/+$/, ''); // sin slash al final
  }, []);

  const canCapture = operator?.role === 'admin' || operator?.role === 'bodega';
  const canConsult = operator?.role === 'admin' || operator?.role === 'callcenter';

  // Estilos pequeños para tabs/botones
  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '10px 16px',
    borderRadius: 12,
    border: active ? '1px solid var(--border, #e6e6e6)' : '1px solid var(--border, #e6e6e6)',
    background: active ? 'linear-gradient(135deg, #f39b4a, #208d45)' : '#fff',
    color: active ? '#fff' : 'var(--text, #111)',
    fontWeight: 700,
    cursor: 'pointer',
  });

  // Sin sesión → pantalla de login
  if (!token || !operator) {
    return (
      <div style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <img src={logo} alt='Samara' style={{ height: 34 }} />
          <h2 style={{ margin: 0 }}>Pack Captures</h2>
        </header>

        <LoginView
          apiBase={apiBase}
          onSuccess={(t: string, info: OperatorInfo) => {
            setToken(t);
            setOperator(info);
            setPage(info.role === 'callcenter' ? 'orders' : 'capture');
          }}
        />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 16 }}>
      {/* Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          justifyContent: 'space-between',
          marginBottom: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src={logo} alt='Samara' style={{ height: 32 }} />
          <h2 style={{ margin: 0 }}>Pack Captures</h2>
        </div>

        <nav style={{ display: 'flex', gap: 8 }}>
          {canCapture && (
            <button type='button' style={tabStyle(page === 'capture')} onClick={() => setPage('capture')}>
              Capturar
            </button>
          )}
          {canConsult && (
            <button type='button' style={tabStyle(page === 'orders')} onClick={() => setPage('orders')}>
              Consultar
            </button>
          )}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 14, color: 'var(--muted, #666)' }}>
            {operator.role === 'admin' && 'Administrador'}
            {operator.role === 'bodega' && 'Bodega'}
            {operator.role === 'callcenter' && 'Call Center'}
            {' · '}
            <strong>{operator.name}</strong>
          </div>
          <button
            className='btn'
            onClick={() => {
              setToken(null);
              setOperator(null);
            }}
          >
            Salir
          </button>
        </div>
      </header>

      {/* Contenido */}
      <main style={{ padding: 16, maxWidth: 1100, margin: '0 auto' }}>
        {page === 'capture' && canCapture && <CaptureView apiBase={apiBase} token={token} />}

        {page === 'orders' && canConsult && <OrdersView apiBase={apiBase} token={token} />}

        {!canCapture && page === 'capture' && (
          <div className='card'>Tu rol no permite capturar. Usa la pestaña Consultar.</div>
        )}
        {!canConsult && page === 'orders' && (
          <div className='card'>Tu rol no permite consultar. Usa la pestaña Capturar.</div>
        )}
      </main>
    </div>
  );
}
