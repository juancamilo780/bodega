import React, { useRef, useState } from 'react';

type Props = { apiBase: string; token: string };

export function CaptureView({ apiBase, token }: Props) {
  const [orderNo, setOrderNo] = useState('');
  const [responsible, setResponsible] = useState('');
  const [note, setNote] = useState('');

  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });

  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const filePickerRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const MAX_FILES = 10;
  const RETRIES = 1; // 1 reintento adicional (total 2 intentos por foto)

  /** Agrega archivos, evitando duplicados por nombre/tamaño/fecha y respetando el límite */
  const appendFiles = (fl: FileList | null) => {
    if (!fl || fl.length === 0) return;
    const current = [...files];
    for (const f of Array.from(fl)) {
      const dup = current.some((c) => c.name === f.name && c.size === f.size && c.lastModified === f.lastModified);
      if (!dup && current.length < MAX_FILES) current.push(f);
    }
    setFiles(current);
    // Limpia los inputs para poder volver a elegir los mismos archivos después
    if (filePickerRef.current) filePickerRef.current.value = '';
    if (cameraRef.current) cameraRef.current.value = '';
  };

  const removeAt = (idx: number) => {
    const next = [...files];
    next.splice(idx, 1);
    setFiles(next);
  };

  /** Sube una foto por petición; reintenta si hay error de red/servidor */
  async function uploadOne(file: File) {
    const fd = new FormData();
    fd.set('order_no', orderNo.trim());
    fd.set('responsible', responsible.trim());
    fd.set('note', note.trim());
    fd.append('files', file);

    let lastErr: any = null;
    for (let attempt = 0; attempt <= RETRIES; attempt++) {
      try {
        const res = await fetch(`${apiBase}/captures`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        if (!res.ok) {
          const t = await res.text().catch(() => '');
          throw new Error(t || `HTTP ${res.status}`);
        }
        return;
      } catch (e) {
        lastErr = e;
        // pequeña espera antes del reintento
        await new Promise((r) => setTimeout(r, 600));
      }
    }
    throw lastErr || new Error('Error de red');
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setErr(null);

    if (!orderNo.trim()) return setErr('Ingresa el número de pedido');
    if (!responsible.trim()) return setErr('Ingresa el responsable');
    if (!note.trim()) return setErr('Ingresa la nota');
    if (files.length === 0) return setErr('Adjunta al menos 1 foto');

    setUploading(true);
    setProgress({ done: 0, total: files.length });
    try {
      for (const f of files.slice(0, MAX_FILES)) {
        await uploadOne(f);
        setProgress((p) => ({ ...p, done: p.done + 1 }));
      }
      setMsg('¡Captura guardada!');
      setOrderNo('');
      setResponsible('');
      setNote('');
      setFiles([]);
    } catch (e: any) {
      setErr(e?.message || 'Error cargando evidencias');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <h3>Capturar evidencia</h3>

      <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
        {/* # Pedido */}
        <div>
          <label># Pedido</label>
          <input
            value={orderNo}
            onChange={(e) => setOrderNo(e.target.value)}
            placeholder='Ej: 12345'
            required
            inputMode='numeric'
            enterKeyHint='done'
            autoCapitalize='off'
            autoComplete='one-time-code'
          />
        </div>

        {/* Responsable */}
        <div>
          <label>Responsable</label>
          <input
            value={responsible}
            onChange={(e) => setResponsible(e.target.value)}
            placeholder='Nombre de quien toma la foto'
            required
            autoCapitalize='words'
          />
        </div>

        {/* Nota */}
        <div>
          <label>Nota</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder='Caja 30x20x15 con burbuja'
            required
          />
        </div>

        {/* Acciones de archivos */}
        <div className='card' style={{ display: 'grid', gap: 8 }}>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>
            Adjunta hasta {MAX_FILES} fotos (se subirán una por una).
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type='button' className='btn' onClick={() => filePickerRef.current?.click()} disabled={uploading}>
              Seleccionar archivo
            </button>
            <button type='button' className='btn' onClick={() => cameraRef.current?.click()} disabled={uploading}>
              Tomar foto
            </button>
          </div>

          {/* inputs ocultos */}
          <input
            ref={filePickerRef}
            type='file'
            accept='image/*'
            multiple
            style={{ display: 'none' }}
            onChange={(e) => appendFiles(e.target.files)}
          />
          <input
            ref={cameraRef}
            type='file'
            accept='image/*'
            capture='environment'
            multiple
            style={{ display: 'none' }}
            onChange={(e) => appendFiles(e.target.files)}
          />

          {/* Previsualización */}
          {files.length > 0 && (
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ fontSize: 13 }}>
                Seleccionadas: {files.length}/{MAX_FILES}
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(120px,1fr))',
                  gap: 8,
                }}
              >
                {files.map((f, idx) => (
                  <div key={idx} className='card' style={{ padding: 8 }}>
                    <img
                      src={URL.createObjectURL(f)}
                      alt=''
                      style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 8 }}
                      onLoad={(e) => URL.revokeObjectURL((e.target as HTMLImageElement).src)}
                    />
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: 6,
                      }}
                    >
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>{f.name.slice(0, 18)}</span>
                      <button
                        type='button'
                        onClick={() => removeAt(idx)}
                        disabled={uploading}
                        style={{
                          border: '1px solid var(--border)',
                          borderRadius: 8,
                          background: '#fff',
                          padding: '4px 8px',
                          cursor: 'pointer',
                        }}
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Progreso */}
          {uploading && (
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              Subiendo {progress.done}/{progress.total}…
            </div>
          )}
        </div>

        <button className='btn' type='submit' disabled={uploading}>
          Guardar
        </button>
      </form>

      {msg && <p style={{ color: '#166534', marginTop: 8 }}>{msg}</p>}
      {err && (
        <p className='error' style={{ marginTop: 8 }}>
          {err}
        </p>
      )}
    </div>
  );
}
