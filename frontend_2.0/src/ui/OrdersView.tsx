import React, { useEffect, useMemo, useState } from 'react';

/** Tipos de datos que devuelve el backend */
type OrderItem = { order_no: string; last_capture_at: string; count: number };
type Capture = {
  id: string;
  photo_url: string;
  captured_at: string;
  operator?: string | null;
  station?: string | null;
  note: string;
  responsible: string;
  voided: boolean;
};

type Props = { apiBase: string; token: string };

export function OrdersView({ apiBase, token }: Props) {
  // ---- estado principal ----
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [selected, setSelected] = useState<OrderItem | null>(null);
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [q, setQ] = useState('');
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showList, setShowList] = useState(false); // móvil: mostrar/ocultar lista

  // ---- visor / modal ----
  const [showViewer, setShowViewer] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  // zoom y drag en el visor
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [lastPos, setLastPos] = useState<{ x: number; y: number } | null>(null);

  // ------- cargar lista de pedidos -------
  useEffect(() => {
    (async () => {
      setLoadingList(true);
      setError(null);
      try {
        const res = await fetch(`${apiBase}/orders`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('No se pudo cargar la lista de pedidos.');
        const data: OrderItem[] = await res.json();
        setOrders(data);
        if (data.length) setSelected(data[0]);
      } catch (e: any) {
        setError(e?.message || 'Error cargando pedidos');
      } finally {
        setLoadingList(false);
      }
    })();
  }, [apiBase, token]);

  // ------- cargar detalle del pedido -------
  useEffect(() => {
    if (!selected) return;
    (async () => {
      setLoadingDetail(true);
      setError(null);
      try {
        const res = await fetch(`${apiBase}/captures?order_no=${encodeURIComponent(selected.order_no)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('No se pudo cargar el detalle del pedido.');
        const data: Capture[] = await res.json();
        setCaptures(data);
      } catch (e: any) {
        setError(e?.message || 'Error cargando detalle');
      } finally {
        setLoadingDetail(false);
      }
    })();
  }, [selected, apiBase, token]);

  // ------- filtro por búsqueda -------
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return orders;
    return orders.filter((o) => o.order_no.toLowerCase().includes(s));
  }, [orders, q]);

  // Si cambia el filtro y el seleccionado ya no está, elige el primero visible
  useEffect(() => {
    if (!filtered.length) return;
    if (!selected || !filtered.find((o) => o.order_no === selected.order_no)) {
      setSelected(filtered[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // ------- acciones visor -------
  const openViewerAt = (idx: number) => {
    setViewerIndex(idx);
    setShowViewer(true);
    resetZoom();
  };
  const closeViewer = () => setShowViewer(false);
  const next = () => setViewerIndex((i) => (i + 1) % captures.length);
  const prev = () => setViewerIndex((i) => (i - 1 + captures.length) % captures.length);

  useEffect(() => {
    if (!showViewer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeViewer();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showViewer, captures.length]);

  // ------- zoom / drag helpers -------
  const resetZoom = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };
  const zoomIn = () => setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)));
  const zoomOut = () => setZoom((z) => Math.max(1, +(z - 0.25).toFixed(2)));

  const onWheel: React.WheelEventHandler<HTMLDivElement> = (e) => {
    if (!showViewer) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.25 : 0.25;
    setZoom((z) => Math.max(1, Math.min(4, +(z + delta).toFixed(2))));
  };
  const onMouseDown: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (zoom === 1) return;
    setDragging(true);
    setLastPos({ x: e.clientX, y: e.clientY });
  };
  const onMouseMove: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (!dragging || !lastPos) return;
    const dx = e.clientX - lastPos.x;
    const dy = e.clientY - lastPos.y;
    setOffset((o) => ({ x: o.x + dx, y: o.y + dy }));
    setLastPos({ x: e.clientX, y: e.clientY });
  };
  const onMouseUp: React.MouseEventHandler<HTMLDivElement> = () => {
    setDragging(false);
    setLastPos(null);
  };
  const onDblClick: React.MouseEventHandler = () => {
    if (zoom === 1) setZoom(2);
    else resetZoom();
  };
  const openFullscreen = () => {
    const el = document.getElementById('viewer-container');
    // @ts-ignore
    if (el && el.requestFullscreen) el.requestFullscreen();
  };

  // ------- estilos helpers -------
  const orderBtnStyle = (active: boolean): React.CSSProperties => ({
    textAlign: 'left',
    borderRadius: 10,
    border: active ? '1px solid var(--brand, #1e8543)' : '1px solid var(--border, #e6e6e6)',
    background: active ? 'linear-gradient(135deg, var(--brand, #f39b4a), var(--brand-2, #208d45))' : '#fff',
    color: active ? '#fff' : 'var(--text, #111)',
    padding: '10px 12px',
    cursor: 'pointer',
  });

  return (
    <div className='orders-layout' style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16 }}>
      {/* móvil: buscador + toggle lista */}
      <div className='only-mobile' style={{ display: 'none' }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder='Buscar por # pedido' inputMode='numeric' />
        <button className='btn' onClick={() => setShowList((s) => !s)}>
          {showList ? 'Ocultar pedidos' : `Pedidos (${filtered.length})`}
        </button>
      </div>

      {/* Lista de pedidos */}
      <aside
        className={`card ${showList ? '' : 'hide-on-mobile'}`}
        style={{ height: 'fit-content', alignSelf: 'start' }}
      >
        <div className='hide-on-mobile' style={{ display: 'grid', gap: 8 }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder='Buscar por # pedido'
            inputMode='numeric'
          />
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: -4 }}>Total: {filtered.length}</div>
        </div>

        <div className='orders-list' style={{ marginTop: 8, display: 'grid', gap: 6 }}>
          {loadingList && <div>Cargando lista…</div>}
          {!loadingList &&
            filtered.map((o) => (
              <button
                key={o.order_no}
                onClick={() => {
                  setSelected(o);
                  setShowList(false);
                }}
                style={orderBtnStyle(selected?.order_no === o.order_no)}
                title={`${o.count} fotos`}
              >
                <div style={{ fontWeight: 600 }}>#{o.order_no}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {new Date(o.last_capture_at).toLocaleString()} · {o.count} foto(s)
                </div>
              </button>
            ))}
          {!loadingList && !filtered.length && <div style={{ opacity: 0.7 }}>Sin resultados.</div>}
        </div>
      </aside>

      {/* Detalle / Álbum */}
      <section>
        {error && (
          <div className='error' style={{ marginBottom: 8 }}>
            {error}
          </div>
        )}
        {!selected && <div>Selecciona un pedido de la lista…</div>}

        {selected && (
          <div>
            <h3 style={{ margin: '6px 0 10px' }}>Pedido #{selected.order_no}</h3>
            {loadingDetail && <div>Cargando detalle…</div>}
            {!loadingDetail && (
              <div
                className='grid-auto'
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                  gap: 12,
                }}
              >
                {captures.map((it, idx) => (
                  <figure key={it.id} className='card' style={{ cursor: 'zoom-in' }} onClick={() => openViewerAt(idx)}>
                    <img
                      src={it.photo_url}
                      alt=''
                      style={{ width: '100%', height: 240, objectFit: 'cover', borderRadius: 8, background: '#f4f4f4' }}
                    />
                    <figcaption style={{ fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>
                      <div>
                        <strong>{new Date(it.captured_at).toLocaleString()}</strong>
                      </div>
                      <div>Resp: {it.responsible || '—'}</div>
                      <div>Op: {it.operator || '—'}</div>
                      <div>Nota: {it.note || '—'}</div>
                    </figcaption>
                  </figure>
                ))}
                {!captures.length && <div style={{ opacity: 0.7 }}>Sin fotos para este pedido.</div>}
              </div>
            )}
          </div>
        )}
      </section>

      {/* -------- Modal / Visor -------- */}
      {showViewer && captures.length > 0 && (
        <div
          onClick={closeViewer}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,.7)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 50,
            padding: 16,
          }}
        >
          <div
            className='card'
            style={{ maxWidth: 'min(1200px, 96vw)', width: '100%', color: '#111', background: '#fff' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header + toolbar */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 12px',
                borderBottom: '1px solid #eee',
              }}
            >
              <strong>Pedido #{selected?.order_no}</strong>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className='btn' onClick={prev} aria-label='Anterior'>
                  ←
                </button>
                <button className='btn' onClick={next} aria-label='Siguiente'>
                  →
                </button>
                <button className='btn' onClick={zoomOut} title='Alejar'>
                  –
                </button>
                <button className='btn' onClick={zoomIn} title='Acercar'>
                  +
                </button>
                <button className='btn' onClick={resetZoom} title='Reset'>
                  100%
                </button>
                <button className='btn' onClick={openFullscreen} title='Pantalla completa'>
                  ⤢
                </button>
                <a className='btn' href={captures[viewerIndex].photo_url} target='_blank' rel='noreferrer'>
                  Abrir
                </a>
                <button className='btn' onClick={closeViewer}>
                  Cerrar
                </button>
              </div>
            </div>

            {/* Imagen grande con zoom/drag */}
            <div
              id='viewer-container'
              onWheel={onWheel}
              onDoubleClick={onDblClick}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
              style={{
                height: 'min(85vh, 85svh)',
                background: '#000',
                display: 'grid',
                placeItems: 'center',
                overflow: 'hidden',
                userSelect: 'none',
              }}
            >
              <img
                src={captures[viewerIndex].photo_url}
                alt=''
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  transform: `scale(${zoom}) translate(${offset.x / zoom}px, ${offset.y / zoom}px)`,
                  transformOrigin: 'center center',
                  transition: dragging ? 'none' : 'transform .08s ease',
                  cursor: zoom > 1 ? 'grab' : 'zoom-in',
                  background: '#000',
                }}
                draggable={false}
              />
            </div>

            {/* Metadatos */}
            <div style={{ padding: '10px 12px', borderTop: '1px solid #eee', display: 'grid', gap: 6 }}>
              <div>
                <strong>Fecha/Hora:</strong> {new Date(captures[viewerIndex].captured_at).toLocaleString()}
              </div>
              <div>
                <strong>Responsable:</strong> {captures[viewerIndex].responsible || '—'}
              </div>
              <div>
                <strong>Operador:</strong> {captures[viewerIndex].operator || '—'}
              </div>
              <div>
                <strong>Nota:</strong> {captures[viewerIndex].note || '—'}
              </div>
            </div>

            {/* Tira de miniaturas */}
            {captures.length > 1 && (
              <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '0 12px 12px' }}>
                {captures.map((c, i) => (
                  <img
                    key={c.id}
                    src={c.photo_url}
                    alt=''
                    onClick={() => {
                      setViewerIndex(i);
                      resetZoom();
                    }}
                    style={{
                      width: 96,
                      height: 72,
                      objectFit: 'cover',
                      cursor: 'pointer',
                      borderRadius: 6,
                      border: i === viewerIndex ? '2px solid #f28c3a' : '1px solid #ddd',
                      background: '#f7f7f7',
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default OrdersView;
