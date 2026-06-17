// frontend/src/components/Dashboard/Dashboard.jsx
import React, { useState, useEffect, useCallback } from 'react';
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const INTERVALOS = [
  { label: 'Hoy',             value: 'hoy'       },
  { label: 'Esta semana',     value: 'semana'     },
  { label: 'Este mes',        value: 'mes'        },
  { label: 'Últimos 3 meses', value: 'trimestre'  },
];

const CANALES = [
  { key: 'whatsapp',  label: 'WhatsApp',  color: '#22c55e' },
  { key: 'messenger', label: 'Messenger', color: '#3b82f6' },
  { key: 'instagram', label: 'Instagram', color: '#ec4899' },
];

// ✅ Este es el correcto — dentro del componente



const Bar = ({ value, max, color }) => (
  <div style={{ background: 'var(--db-track-bg)', borderRadius: 4, height: 4, width: '100%' }}>
    <div style={{ width: max > 0 ? `${Math.round((value / max) * 100)}%` : '0%', background: color, borderRadius: 4, height: '100%', transition: 'width 0.6s ease' }} />
  </div>
);

const HorasChart = ({ data }) => {
  if (!data?.length) return null;
  const max = Math.max(...data.map(d => d.chats), 1);
  const pico = data.reduce((a, b) => a.chats > b.chats ? a : b);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120, padding: '0 4px' }}>
        {data.map((d) => {
          const h = Math.round((d.chats / max) * 100);
          const esPico = d.hora === pico.hora;
          return (
            <div key={d.hora} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div title={`${d.hora}: ${d.chats} chats`} style={{ width: '100%', height: `${Math.max(h, 2)}%`, background: esPico ? '#6366f1' : 'rgba(99,102,241,0.3)', borderRadius: '3px 3px 0 0', cursor: 'default', transition: 'height 0.5s ease' }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 6, padding: '6px 4px 0' }}>
        {data.map((d) => (
          <div key={d.hora} style={{ flex: 1, textAlign: 'center', fontSize: 9, color: 'var(--db-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden' }}>
            {d.hora.replace(':00', '')}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: 'var(--db-text-subtle)' }}>
        Pico: <span style={{ color: '#6366f1', fontWeight: 600 }}>{pico.hora}</span> · <span style={{ color: 'var(--db-text-strong)' }}>{pico.chats}</span> chats
      </div>
    </div>
  );
};

const Skeleton = () => (
  <div style={{ padding: 24 }}>
    {[1,2,3].map(i => (
      <div key={i} style={{ background: 'var(--db-skeleton-bg)', borderRadius: 12, height: 80, marginBottom: 12, animation: 'pulse 1.5s ease-in-out infinite' }} />
    ))}
    <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
  </div>
);

export default function Dashboard() {
  const [intervalo, setIntervalo]   = useState('mes');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [data, setData]             = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      let url = `${API_BASE}/stats?intervalo=${intervalo}`;
      if (fechaDesde && fechaHasta) url += `&desde=${fechaDesde}&hasta=${fechaHasta}`;

      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      setData(json.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [intervalo, fechaDesde, fechaHasta]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: 'var(--db-bg)', padding: 24, fontFamily: 'system-ui, sans-serif', color: 'var(--db-text)' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--db-text-strong)', margin: 0 }}>Dashboard</h1>
          <p style={{ fontSize: 13, color: 'var(--db-text-muted)', margin: '2px 0 0' }}>Estadísticas en tiempo real · Tecnossync</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', background: 'var(--db-pill-bg)', borderRadius: 10, padding: 3, gap: 2 }}>
            {INTERVALOS.map(i => (
              <button key={i.value} onClick={() => { setIntervalo(i.value); setFechaDesde(''); setFechaHasta(''); }}
                style={{ padding: '5px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500, background: intervalo === i.value && !fechaDesde ? '#6366f1' : 'transparent', color: intervalo === i.value && !fechaDesde ? '#fff' : 'var(--db-text-muted)', transition: 'all 0.15s' }}>
                {i.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} style={{ background: 'var(--db-pill-bg)', border: '0.5px solid var(--db-pill-border)', borderRadius: 8, padding: '5px 10px', color: 'var(--db-text-subtle)', fontSize: 12, outline: 'none' }} />
            <span style={{ color: 'var(--db-text-faint)', fontSize: 12 }}>→</span>
            <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} style={{ background: 'var(--db-pill-bg)', border: '0.5px solid var(--db-pill-border)', borderRadius: 8, padding: '5px 10px', color: 'var(--db-text-subtle)', fontSize: 12, outline: 'none' }} />
            {fechaDesde && fechaHasta && (
              <button onClick={fetchStats} style={{ background: '#6366f1', border: 'none', borderRadius: 8, padding: '5px 12px', color: '#fff', fontSize: 12, cursor: 'pointer' }}>Aplicar</button>
            )}
          </div>
          <button onClick={fetchStats} style={{ background: 'var(--db-pill-bg)', border: '0.5px solid var(--db-pill-border)', borderRadius: 8, padding: '5px 10px', color: 'var(--db-text-subtle)', cursor: 'pointer', fontSize: 16 }}>↻</button>
        </div>
      </div>

      {loading && <Skeleton />}
      {error && (
        <div style={{ background: 'var(--db-error-bg)', border: '0.5px solid var(--db-error-border)', borderRadius: 12, padding: 16, color: 'var(--db-error-text)', fontSize: 13, marginBottom: 20 }}>
          Error: {error}
          <button onClick={fetchStats} style={{ marginLeft: 12, background: 'var(--db-error-bg)', border: 'none', borderRadius: 6, padding: '3px 10px', color: 'var(--db-error-text)', cursor: 'pointer', fontSize: 12 }}>Reintentar</button>
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* Métricas globales */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Total chats',     value: data.resumen.totalChats,           color: '#6366f1', icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z' },
              { label: 'Total leads',     value: data.resumen.totalLeads,           color: '#10b981', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
              { label: 'Convertidos',     value: data.resumen.totalConvertidos,     color: '#f59e0b', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
              { label: 'Prospectos',      value: data.resumen.totalProspectos,      color: '#3b82f6', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
              { label: 'Tasa conversión', value: `${data.resumen.tasaConversion}%`, color: '#ec4899', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
              { label: 'Contactos',       value: data.resumen.totalContactos,       color: '#8b5cf6', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
            ].map(m => (
              <div key={m.label} style={{ background: 'var(--db-card-bg)', border: '0.5px solid var(--db-card-border)', borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ marginBottom: 6 }}>
                  <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke={m.color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                    <path d={m.icon} />
                  </svg>
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: m.color }}>{m.value}</div>
                <div style={{ fontSize: 11, color: 'var(--db-text-muted)', marginTop: 2 }}>{m.label}</div>
              </div>
            ))}
          </div>

          {/* Leads por canal */}
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 12, fontWeight: 600, color: 'var(--db-text-muted)', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Leads por canal</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              {CANALES.map(canal => {
                const d = data.leadsPorCanal[canal.key] || { total: 0, convertidos: 0, prospectos: 0, nuevos: 0 };
                return (
                  <div key={canal.key} style={{ background: 'var(--db-card-bg)', border: `0.5px solid ${canal.color}30`, borderRadius: 12, padding: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: canal.color }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--db-text-strong)' }}>{canal.label}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 18, fontWeight: 700, color: canal.color }}>{d.total}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {[
                        { label: 'Convertidos', value: d.convertidos, color: '#10b981' },
                        { label: 'Prospectos',  value: d.prospectos,  color: '#f59e0b' },
                        { label: 'Nuevos',      value: d.nuevos,      color: canal.color },
                      ].map(item => (
                        <div key={item.label}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: 11, color: 'var(--db-text-subtle)' }}>{item.label}</span>
                            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--db-text-strong)' }}>{item.value}</span>
                          </div>
                          <Bar value={item.value} max={d.total} color={item.color} />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Horas + Asesores */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div style={{ background: 'var(--db-card-bg)', border: '0.5px solid var(--db-card-border)', borderRadius: 12, padding: 16 }}>
              <h2 style={{ fontSize: 12, fontWeight: 600, color: 'var(--db-text-muted)', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Hora de entrada de clientes</h2>
              <HorasChart data={data.horasEntrada} />
            </div>
            <div style={{ background: 'var(--db-card-bg)', border: '0.5px solid var(--db-card-border)', borderRadius: 12, padding: 16 }}>
              <h2 style={{ fontSize: 12, fontWeight: 600, color: 'var(--db-text-muted)', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Chats por asesor</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {data.asesores.length === 0 && <p style={{ color: 'var(--db-text-faint)', fontSize: 13 }}>Sin datos.</p>}
                {data.asesores.map(a => {
                  const maxChats = Math.max(...data.asesores.map(x => x.chats), 1);
                  const color = `hsl(${(a.id * 47) % 360}, 65%, 60%)`;
                  const ini = a.nombre.split(' ').slice(0,2).map(n=>n[0]).join('').toUpperCase();
                  return (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 10, background: `${color}25`, border: `1.5px solid ${color}50`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color }}>{ini}</div>
                        <div style={{ position: 'absolute', bottom: -1, right: -1, width: 9, height: 9, borderRadius: '50%', background: a.online ? '#22c55e' : '#475569', border: '1.5px solid var(--db-bg)' }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--db-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.nombre}</span>
                          <span style={{ fontSize: 11, color: 'var(--db-text-subtle)', flexShrink: 0, marginLeft: 8 }}>{a.chats}</span>
                        </div>
                        <Bar value={a.chats} max={maxChats} color={color} />
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, flexShrink: 0, background: a.online ? 'rgba(34,197,94,0.1)' : 'rgba(71,85,105,0.3)', color: a.online ? '#22c55e' : 'var(--db-text-muted)' }}>
                        {a.online ? 'En línea' : 'Offline'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Tabla rendimiento */}
          <div style={{ background: 'var(--db-card-bg)', border: '0.5px solid var(--db-card-border)', borderRadius: 12, padding: 16 }}>
            <h2 style={{ fontSize: 12, fontWeight: 600, color: 'var(--db-text-muted)', margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rendimiento de asesores</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '0.5px solid var(--db-card-border)' }}>
                  {['Asesor','Rol','Estado','Chats','Convertidos','Tasa'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--db-text-faint)', fontWeight: 500, fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.asesores.map((a, i) => {
                  const tasa = a.chats > 0 ? Math.round((a.convertidos / a.chats) * 100) : 0;
                  const color = `hsl(${(a.id * 47) % 360}, 65%, 60%)`;
                  const ini = a.nombre.split(' ').slice(0,2).map(n=>n[0]).join('').toUpperCase();
                  return (
                    <tr key={a.id} style={{ borderBottom: i < data.asesores.length-1 ? '0.5px solid var(--db-row-border)' : 'none' }}>
                      <td style={{ padding: '10px 8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 26, height: 26, borderRadius: 8, background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color }}>{ini}</div>
                          <span style={{ color: 'var(--db-text)' }}>{a.nombre}</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: a.role === 'admin' ? 'rgba(245,158,11,0.15)' : 'rgba(99,102,241,0.15)', color: a.role === 'admin' ? '#f59e0b' : '#818cf8' }}>
                          {a.role === 'admin' ? 'Admin' : 'Agente'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: a.online ? 'rgba(34,197,94,0.1)' : 'rgba(71,85,105,0.3)', color: a.online ? '#22c55e' : 'var(--db-text-muted)' }}>
                          {a.online ? 'En línea' : 'Offline'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 8px', color: 'var(--db-text-strong)', fontWeight: 600 }}>{a.chats}</td>
                      <td style={{ padding: '10px 8px', color: '#10b981', fontWeight: 600 }}>{a.convertidos}</td>
                      <td style={{ padding: '10px 8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, background: 'var(--db-track-bg)', borderRadius: 4, height: 4 }}>
                            <div style={{ width: `${tasa}%`, background: color, borderRadius: 4, height: '100%' }} />
                          </div>
                          <span style={{ color, fontWeight: 600, minWidth: 30 }}>{tasa}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
