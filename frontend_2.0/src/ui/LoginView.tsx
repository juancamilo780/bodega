import React, { useState } from 'react';

type Role = 'admin' | 'bodega' | 'callcenter';

export type OperatorInfo = {
  id: string;
  name: string;
  role: Role;
};

type Props = {
  apiBase: string;
  onSuccess: (token: string, info: OperatorInfo) => void;
};

export function LoginView({ apiBase, onSuccess }: Props) {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const body = new URLSearchParams();
      body.set('username', user);
      body.set('password', pass);
      body.set('grant_type', 'password');

      const res = await fetch(`/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      if (!res.ok) throw new Error('Credenciales inválidas');

      const data = await res.json();
      // data: { access_token, operator_id, operator_name, role }
      const info: OperatorInfo = {
        id: data.operator_id,
        name: data.operator_name,
        role: data.role as Role,
      };
      onSuccess(data.access_token as string, info);
    } catch (e: any) {
      setError(e?.message || 'Error de inicio de sesión');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className='card' style={{ maxWidth: 420, margin: '0 auto' }}>
      <label>Usuario</label>
      <input value={user} onChange={(e) => setUser(e.target.value)} required />
      <label>Contraseña</label>
      <input type='password' value={pass} onChange={(e) => setPass(e.target.value)} required />
      <button className='btn' type='submit' disabled={busy}>
        Entrar
      </button>
      {error && <p className='error'>{error}</p>}
    </form>
  );
}
