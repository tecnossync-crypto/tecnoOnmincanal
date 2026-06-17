// frontend/src/components/BotConfig/BotFilesPanel.jsx
import React, { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { FileText, Image, Video, Music, FileSpreadsheet, File, Folder, Bot, Paperclip } from 'lucide-react';

function getFileIcon(mime) {
  if (mime === 'application/pdf') return <FileText size={18} className="text-red-400" />;
  if (mime?.startsWith('image/'))  return <Image    size={18} className="text-blue-400" />;
  if (mime?.startsWith('video/'))  return <Video    size={18} className="text-purple-400" />;
  if (mime?.startsWith('audio/'))  return <Music    size={18} className="text-green-400" />;
  if (mime?.includes('excel') || mime?.includes('spreadsheet')) return <FileSpreadsheet size={18} className="text-emerald-400" />;
  if (mime?.includes('word') || mime?.includes('document'))     return <FileText        size={18} className="text-blue-400" />;
  return <Paperclip size={18} className="text-slate-400" />;
}

const BACKEND = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001';

export default function BotFilesPanel() {
  const [files,       setFiles]       = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [showForm,    setShowForm]    = useState(false);
  const [editingFile, setEditingFile] = useState(null);
  const [uploading,   setUploading]   = useState(false);
  const fileRef = useRef(null);

  const [form, setForm] = useState({
    name:          '',
    category:      '',
    caption:       '',
    ai_can_send:   true,
    trigger_rules: [],
    sort_order:    0
  });

  const [newKeyword, setNewKeyword] = useState('');

  useEffect(() => { fetchFiles(); }, []);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const res = await api.get('/bot-files');
      setFiles(res.data || []);
    } catch { toast.error('Error cargando archivos'); }
    finally { setLoading(false); }
  };

  const handleOpenForm = (file = null) => {
    if (file) {
      setEditingFile(file);
      setForm({
        name:          file.name,
        category:      file.category || '',
        caption:       file.caption || '',
        ai_can_send:   file.ai_can_send,
        trigger_rules: file.trigger_rules || [],
        sort_order:    file.sort_order || 0
      });
    } else {
      setEditingFile(null);
      setForm({ name: '', category: '', caption: '', ai_can_send: true, trigger_rules: [], sort_order: 0 });
    }
    setShowForm(true);
  };

  const handleAddKeyword = () => {
    if (!newKeyword.trim()) return;
    setForm(f => ({
      ...f,
      trigger_rules: [
        ...f.trigger_rules.filter(r => r.type !== 'keyword'),
        {
          type:   'keyword',
          values: [
            ...(f.trigger_rules.find(r => r.type === 'keyword')?.values || []),
            newKeyword.trim()
          ]
        }
      ]
    }));
    setNewKeyword('');
  };

  const handleRemoveKeyword = (kw) => {
    setForm(f => ({
      ...f,
      trigger_rules: f.trigger_rules.map(r =>
        r.type === 'keyword'
          ? { ...r, values: r.values.filter(v => v !== kw) }
          : r
      ).filter(r => r.type !== 'keyword' || r.values.length > 0)
    }));
  };

  const handleSave = async () => {
    const file = fileRef.current?.files[0];
    if (!editingFile && !file) return toast.error('Selecciona un archivo');
    if (!form.name.trim()) return toast.error('El nombre es requerido');

    setUploading(true);
    try {
      const formData = new FormData();
      if (file) formData.append('file', file);
      formData.append('name',          form.name);
      formData.append('category',      form.category);
      formData.append('caption',       form.caption);
      formData.append('ai_can_send',   form.ai_can_send);
      formData.append('trigger_rules', JSON.stringify(form.trigger_rules));
      formData.append('sort_order',    form.sort_order);

      if (editingFile) {
        await api.put(`/bot-files/${editingFile.id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        toast.success('Archivo actualizado');
      } else {
        await api.post('/bot-files', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        toast.success('Archivo subido');
      }

      setShowForm(false);
      if (fileRef.current) fileRef.current.value = '';
      fetchFiles();
    } catch (e) {
      toast.error(e.message);
    } finally { setUploading(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este archivo?')) return;
    try {
      await api.delete(`/bot-files/${id}`);
      toast.success('Eliminado');
      fetchFiles();
    } catch (e) { toast.error(e.message); }
  };

  const keywords = form.trigger_rules.find(r => r.type === 'keyword')?.values || [];

  // Agrupar por categoría
  const grouped = files.reduce((acc, f) => {
    const cat = f.category || 'Sin categoría';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(f);
    return acc;
  }, {});

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Archivos del Bot</h2>
            <p className="text-xs text-gray-400 mt-1">
              Sube archivos que el bot puede enviar automáticamente según reglas o decisión de IA
            </p>
          </div>
          <button
            onClick={() => handleOpenForm()}
            className="px-4 py-2 text-sm font-medium text-white rounded-xl transition-all"
            style={{ background: '#6366f1' }}
          >
            + Subir archivo
          </button>
        </div>

        {/* Formulario */}
        {showForm && (
          <div className="rounded-2xl p-6 mb-6 bg-white" style={{ border: '0.5px solid #e2e8f0' }}>
            <h3 className="font-semibold text-gray-800 mb-4 text-sm">
              {editingFile ? 'Editar archivo' : 'Nuevo archivo'}
            </h3>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nombre</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ej: Cotización seguro básico"
                  className="input-field text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Categoría</label>
                <input
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  placeholder="Ej: Cotizaciones, Tarifas"
                  className="input-field text-sm"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Archivo {editingFile && <span className="text-gray-400">(deja vacío para mantener el actual)</span>}
              </label>
              <input ref={fileRef} type="file" className="input-field text-sm" />
            </div>

            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Mensaje que acompaña al archivo
              </label>
              <textarea
                value={form.caption}
                onChange={e => setForm(f => ({ ...f, caption: e.target.value }))}
                placeholder="Ej: Aquí tienes tu cotización personalizada"
                className="input-field text-sm"
                rows={2}
              />
            </div>

            {/* Palabras clave */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Palabras clave que activan este archivo
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  value={newKeyword}
                  onChange={e => setNewKeyword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddKeyword()}
                  placeholder="Ej: cotización, precio, tarifa"
                  className="flex-1 input-field text-sm"
                />
                <button
                  onClick={handleAddKeyword}
                  className="px-3 py-2 text-sm rounded-lg text-white"
                  style={{ background: '#6366f1' }}
                >
                  Agregar
                </button>
              </div>
              {keywords.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {keywords.map(kw => (
                    <span key={kw}
                      className="flex items-center gap-1 text-xs px-2 py-1 rounded-full"
                      style={{ background: '#ede9fe', color: '#6d28d9' }}
                    >
                      {kw}
                      <button onClick={() => handleRemoveKeyword(kw)} className="hover:opacity-70">×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* IA puede enviar */}
            <div className="flex items-center gap-3 mb-4">
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer"
                  checked={form.ai_can_send}
                  onChange={e => setForm(f => ({ ...f, ai_can_send: e.target.checked }))} />
                <div className="w-10 h-6 bg-gray-200 rounded-full peer peer-checked:bg-indigo-600
                                peer-checked:after:translate-x-4 after:content-[''] after:absolute
                                after:top-[2px] after:left-[2px] after:bg-white after:rounded-full
                                after:h-5 after:w-5 after:transition-all" />
              </label>
              <div>
                <p className="text-sm text-gray-700">La IA puede enviar este archivo por decisión propia</p>
                <p className="text-xs text-gray-400">Si está activo, la IA decide cuándo es relevante enviarlo</p>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={uploading}
                className="px-4 py-2 text-sm rounded-xl text-white font-medium disabled:opacity-50"
                style={{ background: '#6366f1' }}>
                {uploading ? 'Subiendo...' : editingFile ? 'Actualizar' : 'Subir archivo'}
              </button>
            </div>
          </div>
        )}

        {/* Lista de archivos */}
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2">
            <div className="animate-spin w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full" />
            <span className="text-sm text-gray-400">Cargando...</span>
          </div>
        ) : files.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Folder size={40} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm">Sin archivos configurados</p>
            <p className="text-xs mt-1">Sube archivos que el bot podrá enviar automáticamente</p>
          </div>
        ) : (
          Object.entries(grouped).map(([cat, catFiles]) => (
            <div key={cat} className="mb-6">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{cat}</p>
              <div className="flex flex-col gap-3">
                {catFiles.map(file => {
                  const icon    = getFileIcon(file.file_type);
                  const kws     = file.trigger_rules?.find(r => r.type === 'keyword')?.values || [];
                  const sizeKB  = file.file_size ? Math.round(file.file_size / 1024) : null;
                  return (
                    <div key={file.id}
                      className="flex items-start gap-4 p-4 rounded-2xl bg-white"
                      style={{ border: '0.5px solid #e2e8f0' }}
                    >
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                           style={{ background: '#f8fafc' }}>
                        {icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-semibold text-gray-900 truncate">{file.name}</p>
                          {file.ai_can_send && (
                            <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full"
                                  style={{ background: '#ede9fe', color: '#6d28d9' }}>
                              <Bot size={10} /> IA
                            </span>
                          )}
                          {!file.is_active && (
                            <span className="text-xs px-1.5 py-0.5 rounded-full"
                                  style={{ background: '#f1f5f9', color: '#94a3b8' }}>
                              Inactivo
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mb-2">
                          {file.file_name} {sizeKB && `· ${sizeKB} KB`}
                        </p>
                        {file.caption && (
                          <p className="text-xs text-gray-500 mb-2 italic">"{file.caption}"</p>
                        )}
                        {kws.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {kws.map(kw => (
                              <span key={kw} className="text-xs px-2 py-0.5 rounded-full"
                                    style={{ background: '#f0fdf4', color: '#16a34a' }}>
                                {kw}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <a href={`${BACKEND}${file.file_path}`} target="_blank" rel="noreferrer"
                           className="text-xs px-3 py-1.5 rounded-lg transition-all"
                           style={{ background: '#f1f5f9', color: '#64748b' }}>
                          Ver
                        </a>
                        <button onClick={() => handleOpenForm(file)}
                          className="text-xs px-3 py-1.5 rounded-lg transition-all"
                          style={{ background: '#ede9fe', color: '#6d28d9' }}>
                          Editar
                        </button>
                        <button onClick={() => handleDelete(file.id)}
                          className="text-xs px-3 py-1.5 rounded-lg transition-all"
                          style={{ background: '#fef2f2', color: '#dc2626' }}>
                          Eliminar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}