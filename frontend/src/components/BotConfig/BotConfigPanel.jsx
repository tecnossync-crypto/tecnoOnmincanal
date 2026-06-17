import { useState, useRef, useEffect } from "react";
import {
  Brain, Play, Save, Power,
  FileText, FileSpreadsheet, Image, File, Trash2,
  CheckCircle, Loader, Clock,
  BookOpen, Plus, Edit2, Copy, Check, X, Info
} from "lucide-react";

/* ─── Tipos de catálogo ──────────────────────────────────── */
const TIPOS = [
  { value: "vehiculos",    label: "Vehículos",    bg: "#dbeafe", fg: "#1d4ed8" },
  { value: "seguros",      label: "Seguros",      bg: "#fef3c7", fg: "#b45309" },
  { value: "tarifas",      label: "Tarifas",      bg: "#ede9fe", fg: "#6d28d9" },
  { value: "productos",    label: "Productos",    bg: "#dcfce7", fg: "#15803d" },
  { value: "servicios",    label: "Servicios",    bg: "#cffafe", fg: "#0e7490" },
  { value: "cotizaciones", label: "Cotizaciones", bg: "#fce7f3", fg: "#9d174d" },
  { value: "general",      label: "General",      bg: "#f1f5f9", fg: "#475569" },
];
const TIPO_CFG = Object.fromEntries(TIPOS.map(t => [t.value, t]));

const CONTENT_PLACEHOLDERS = {
  vehiculos:    `Toyota Corolla GR 2024 - Color: Rojo/Blanco - Precio: $32,500\nHonda Civic Sport 2024 - Color: Azul/Gris - Precio: $29,800\nMazda3 Sedán 2024 - Precio: $27,000`,
  seguros:      `SEGURO BÁSICO (terceros):\n- Vehículo menor 5 años: $1,800/año\n- Vehículo 5-10 años: $2,400/año\n\nSEGURO COMPLETO (todo riesgo):\n- Vehículo menor 5 años: $4,500/año`,
  tarifas:      `Pickup estándar (hasta 1 ton): $45\nPickup pesado (1 a 3 ton): $85\nCamión mediano (3 a 5 ton): $130`,
  productos:    `SKU-001 | Laptop HP 15 | $850 | Stock: 12\nSKU-002 | Monitor LG 24" | $220 | Stock: 8`,
  servicios:    `Limpieza Básico: $80 (2 horas)\nLimpieza Profunda: $150 (4 horas)\nMensual: $280/mes`,
  cotizaciones: `Tipo A - Cobertura básica: desde $1,200\nTipo B - Cobertura media: desde $2,500\nTipo C - Cobertura premium: desde $4,800`,
  general:      `Agrega aquí la información estructurada que el bot debe conocer...\n\nEjemplo:\nOpción 1: descripción - precio`,
};

const PLACEHOLDER = `Eres Sofía, asistente virtual de Mi Empresa.

PERSONALIDAD:
- Tono amigable y profesional
- Respuestas breves y claras

CATÁLOGO DE PRODUCTOS:
Cuando el cliente pregunte por vehículos disponibles, usa la información de {{catalogo:vehiculos_2024}}.

TARIFAS Y SEGUROS:
Para cotizaciones de seguros usa {{catalogo:tarifas_seguros}}.

TIP: Escribe # para ver y seleccionar tus catálogos rápidamente.

REGLAS:
- Escucha al cliente antes de dar precios
- Si no sabes algo: "En breve un asesor te dará esa información"
- Horario: Lunes a Viernes 8am - 6pm`;

const TOKEN = () => localStorage.getItem("token");

const toSlug = (s) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "")
   .toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

/* ─── Modal crear / editar catálogo ──────────────────────── */
function CatalogModal({ catalog, onSave, onClose }) {
  const [form, setForm] = useState({
    nombre:        catalog?.nombre        || "",
    identificador: catalog?.identificador || "",
    tipo:          catalog?.tipo          || "general",
    descripcion:   catalog?.descripcion   || "",
    contenido:     catalog?.contenido     || "",
  });
  const [identManual,  setIdentManual]  = useState(!!catalog);
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState("");
  const [pendingFile,  setPendingFile]  = useState(null);
  const [uploadStatus, setUploadStatus] = useState("idle");
  const [removeFile,   setRemoveFile]   = useState(false);

  const handleNombre = (v) =>
    setForm(f => ({ ...f, nombre: v, identificador: identManual ? f.identificador : toSlug(v) }));

  const handleIdent = (v) => {
    setIdentManual(true);
    setForm(f => ({ ...f, identificador: v.toLowerCase().replace(/[^a-z0-9_-]/g, "_") }));
  };

  const handleSubmit = async () => {
    if (!form.nombre.trim())        return setError("El nombre es obligatorio.");
    if (!form.identificador.trim()) return setError("El identificador es obligatorio.");
    if (!form.contenido.trim() && !pendingFile && !catalog?.archivo_url) {
      return setError("El contenido es obligatorio si no se adjunta un archivo.");
    }
    setSaving(true); setError("");
    try {
      // Paso 1: guardar metadatos con JSON
      const url    = catalog ? `/api/bot-catalogs/${catalog.id}` : "/api/bot-catalogs";
      const method = catalog ? "PUT" : "POST";
      const res    = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN()}` },
        body:    JSON.stringify(form),
      });
      const data = await res.json();
      if (!data.success) { setError(data.message || "Error al guardar."); return; }

      const saved = data.data;

      // Paso 2a: quitar archivo si el usuario lo solicitó
      if (removeFile && catalog?.archivo_url) {
        await fetch(`/api/bot-catalogs/${saved.id}/file`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${TOKEN()}` },
        });
        saved.archivo_url = null; saved.archivo_nombre = null; saved.archivo_tipo = null;
      }

      // Paso 2b: subir nuevo archivo
      if (pendingFile) {
        setUploadStatus("uploading");
        const fd = new FormData();
        fd.append("file", pendingFile);
        const upRes  = await fetch(`/api/bot-catalogs/${saved.id}/file`, {
          method: "POST",
          headers: { Authorization: `Bearer ${TOKEN()}` },
          body:   fd,
        });
        const upData = await upRes.json();
        if (upData.success) {
          setUploadStatus("done");
          onSave(upData.data);
          return;
        } else {
          setUploadStatus("error");
          setError(`Catálogo guardado, pero error al subir archivo: ${upData.message}`);
          onSave(saved);
          return;
        }
      }

      onSave(saved);
    } catch { setError("Error de conexión."); }
    finally   { setSaving(false); }
  };

  const isPDF   = pendingFile?.type === "application/pdf" || catalog?.archivo_tipo === "application/pdf";
  const hasFile = (catalog?.archivo_url && !removeFile) || pendingFile;

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.42)", zIndex: 60,
               display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 620,
                    maxHeight: "94vh", overflow: "auto",
                    boxShadow: "0 24px 64px rgba(0,0,0,0.18)" }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "16px 20px", borderBottom: "1px solid #e5e7eb" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <BookOpen size={16} color="#6b7280" strokeWidth={1.5} />
            <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
              {catalog ? "Editar catálogo" : "Nuevo catálogo"}
            </span>
          </div>
          <button onClick={onClose} style={s.iconBtn}><X size={15} /></button>
        </div>

        <div style={{ padding: "20px 20px 8px", display: "flex", flexDirection: "column", gap: 14 }}>
          {error && (
            <div style={{ fontSize: 12, color: "#b91c1c", background: "#fef2f2",
                          border: "1px solid #fecaca", borderRadius: 8, padding: "8px 12px" }}>
              {error}
            </div>
          )}

          {/* Tag preview */}
          <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 8,
                        padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 11, color: "#9ca3af" }}>Tag para usar en instrucciones:</span>
            <code style={{ fontSize: 12, fontFamily: "monospace", color: "#6d28d9",
                           background: "#ede9fe", padding: "2px 8px", borderRadius: 5 }}>
              {`{{catalogo:${form.identificador || "identificador"}}}`}
            </code>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 160px", gap: 10 }}>
            <div>
              <label style={s.label}>Nombre del catálogo *</label>
              <input autoFocus value={form.nombre} onChange={e => handleNombre(e.target.value)}
                     placeholder="Ej: Catálogo Vehículos 2024" style={s.input} />
            </div>
            <div>
              <label style={s.label}>Tipo</label>
              <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                      style={{ ...s.input, cursor: "pointer" }}>
                {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={s.label}>
              Identificador *
              <span style={{ fontWeight: 400, color: "#9ca3af", marginLeft: 6 }}>
                (letras minúsculas, números y _)
              </span>
            </label>
            <input value={form.identificador} onChange={e => handleIdent(e.target.value)}
                   placeholder="vehiculos_2024" style={s.input} />
          </div>

          <div>
            <label style={s.label}>
              Descripción <span style={{ fontWeight: 400, color: "#9ca3af", marginLeft: 6 }}>(opcional)</span>
            </label>
            <input value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                   placeholder="Para qué usa el bot este catálogo..." style={s.input} />
          </div>

          {/* ── Archivo adjunto ─────────────────────────── */}
          <div>
            <label style={s.label}>
              Archivo adjunto
              <span style={{ fontWeight: 400, color: "#9ca3af", marginLeft: 6 }}>(PDF o imagen, opcional)</span>
            </label>

            {/* Archivo ya guardado */}
            {catalog?.archivo_url && !removeFile && !pendingFile && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
                            background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8,
                            marginBottom: 8 }}>
                <span style={{ fontSize: 18 }}>
                  {catalog.archivo_tipo === "application/pdf" ? <FileText size={16} color="#16a34a" /> : <Image size={16} color="#16a34a" />}
                </span>
                <span style={{ fontSize: 12, color: "#166534", flex: 1, overflow: "hidden",
                               textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {catalog.archivo_nombre}
                </span>
                <button
                  type="button"
                  onClick={() => setRemoveFile(true)}
                  style={{ fontSize: 11, color: "#dc2626", background: "none", border: "1px solid #fca5a5",
                           cursor: "pointer", padding: "2px 8px", borderRadius: 5 }}>
                  Quitar
                </button>
              </div>
            )}

            {/* Zona de subida */}
            {(!catalog?.archivo_url || removeFile || pendingFile) && (
              <label style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center",
                border: pendingFile ? "2px solid #16a34a" : "2px dashed #d1d5db",
                borderRadius: 8, padding: "18px 16px", cursor: "pointer",
                background: pendingFile ? "#f0fdf4" : "#fafafa", transition: "border 0.2s",
              }}>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.gif"
                  style={{ display: "none" }}
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) { setPendingFile(f); setRemoveFile(false); }
                  }}
                />
                {pendingFile ? (
                  <>
                    <span style={{ fontSize: 24 }}>
                      {pendingFile.type === "application/pdf" ? <FileText size={22} color="#16a34a" /> : <Image size={22} color="#16a34a" />}
                    </span>
                    <span style={{ fontSize: 12, color: "#166534", marginTop: 4, fontWeight: 500 }}>
                      {pendingFile.name}
                    </span>
                    <span style={{ fontSize: 10, color: "#4ade80", marginTop: 2 }}>
                      {(pendingFile.size / 1024).toFixed(0)} KB — listo para subir
                    </span>
                    <button
                      type="button"
                      onClick={e => { e.preventDefault(); setPendingFile(null); }}
                      style={{ marginTop: 6, fontSize: 11, color: "#6b7280", background: "none",
                               border: "none", cursor: "pointer" }}>
                      Cancelar
                    </button>
                  </>
                ) : (
                  <>
                    <File size={22} color="#9ca3af" />
                    <span style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>
                      Arrastra o haz clic para seleccionar
                    </span>
                    <span style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>
                      PDF, JPG, PNG, WEBP · máx 20 MB
                    </span>
                  </>
                )}
              </label>
            )}

            {/* Indicadores */}
            {pendingFile?.type === "application/pdf" && (
              <p style={{ fontSize: 11, color: "#0369a1", margin: "4px 0 0" }}>
                <Info size={11} style={{ display:'inline', verticalAlign:'middle', marginRight:4 }} /> El texto del PDF se extraerá automáticamente y completará el campo de contenido.
              </p>
            )}
            {uploadStatus === "uploading" && (
              <p style={{ fontSize: 11, color: "#6b7280", margin: "4px 0 0",
                          display: "flex", alignItems: "center", gap: 4 }}>
                <Loader size={11} style={{ animation: "spin 1s linear infinite" }} />
                Subiendo archivo...
              </p>
            )}
          </div>

          {/* ── Contenido textual ───────────────────────── */}
          <div>
            <label style={s.label}>
              Contenido del catálogo
              {!hasFile && <span style={{ color: "#ef4444", marginLeft: 4 }}>*</span>}
            </label>
            <textarea
              value={form.contenido}
              onChange={e => setForm(f => ({ ...f, contenido: e.target.value }))}
              placeholder={CONTENT_PLACEHOLDERS[form.tipo] || CONTENT_PLACEHOLDERS.general}
              rows={8}
              style={{ ...s.input, resize: "vertical", fontFamily: "'Courier New', monospace",
                       fontSize: 12, lineHeight: 1.7, minHeight: 160 }}
            />
            <p style={{ fontSize: 11, color: "#9ca3af", margin: "4px 0 0" }}>
              {pendingFile?.type === "application/pdf"
                ? "Se rellenará automáticamente con el texto extraído del PDF. Puedes editarlo después."
                : hasFile
                  ? "Las imágenes no se procesan automáticamente. Agrega el texto descriptivo manualmente si necesitas que el bot lo use."
                  : "Escribe la información estructurada que el bot deberá conocer y presentar al cliente."}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8,
                      padding: "14px 20px", borderTop: "1px solid #e5e7eb" }}>
          <button onClick={onClose} style={s.btnCancel}>Cancelar</button>
          <button onClick={handleSubmit} disabled={saving || uploadStatus === "uploading"}
                  style={{ ...s.btnSave, opacity: (saving || uploadStatus === "uploading") ? 0.7 : 1,
                           display: "flex", alignItems: "center", gap: 6 }}>
            {saving || uploadStatus === "uploading"
              ? <><Loader size={12} style={{ animation: "spin 1s linear infinite" }} /> Guardando...</>
              : catalog ? "Guardar cambios" : "Crear catálogo"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── COMPONENTE PRINCIPAL ───────────────────────────────── */
export default function BotConfigPanel() {
  const [instrucciones, setInstrucciones] = useState("");
  const [botActivo,     setBotActivo]     = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [saved,         setSaved]         = useState(false);
  const [testing,       setTesting]       = useState(false);
  const [testMsg,       setTestMsg]       = useState("");
  const [testResp,      setTestResp]      = useState("");
  const [testFile,      setTestFile]      = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [configId,      setConfigId]      = useState(null);

  // Catálogos
  const [catalogs,      setCatalogs]      = useState([]);
  const [catalogModal,  setCatalogModal]  = useState(null);
  const [copiedId,      setCopiedId]      = useState(null);

  // Documentos (plantillas)
  const [docTemplates,  setDocTemplates]  = useState([]);

  // Trigger # autocomplete
  const [showTrigger,   setShowTrigger]   = useState(false);
  const [triggerFilter, setTriggerFilter] = useState("");
  const [triggerIdx,    setTriggerIdx]    = useState(0);
  const textareaRef = useRef();

  /* ─── Carga inicial ──────────────────────────────────── */
  useEffect(() => {
    const load = async () => {
      try {
        const [cfgRes, catRes, docRes] = await Promise.all([
          fetch("/api/bot-configs/active",    { headers: { Authorization: `Bearer ${TOKEN()}` } }),
          fetch("/api/bot-catalogs",           { headers: { Authorization: `Bearer ${TOKEN()}` } }),
          fetch("/api/document-templates",     { headers: { Authorization: `Bearer ${TOKEN()}` } }),
        ]);
        const [cfgData, catData, docData] = await Promise.all([cfgRes.json(), catRes.json(), docRes.json()]);
        if (cfgData.success && cfgData.data) {
          setConfigId(cfgData.data.id);
          setInstrucciones(cfgData.data.system_prompt || "");
          setBotActivo(cfgData.data.is_active ?? true);
        }
        if (catData.success) setCatalogs(catData.data);
        if (docData.success) setDocTemplates(docData.data || []);
      } catch (e) {
        console.error("Error cargando configuración:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  /* ─── Guardar configuración ──────────────────────────── */
  const handleSave = async () => {
    setSaving(true);
    try {
      const body   = { system_prompt: instrucciones, is_active: botActivo, name: "Mi Asistente IA" };
      const url    = configId ? `/api/bot-configs/${configId}` : "/api/bot-configs";
      const method = configId ? "PUT" : "POST";
      const res    = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN()}` },
        body:    JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        if (!configId && data.data?.id) setConfigId(data.data.id);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (e) { console.error(e); }
    finally     { setSaving(false); }
  };

  /* ─── Probar bot ─────────────────────────────────────── */
  const handleTest = async () => {
    if (!testMsg.trim() || !instrucciones.trim()) return;
    setTesting(true); setTestResp(""); setTestFile(null);
    try {
      const res  = await fetch("/api/bot-configs/test", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN()}` },
        body:   JSON.stringify({ instrucciones, mensaje: testMsg }),
      });
      const data = await res.json();
      setTestResp(data.respuesta || data.data?.response || "Sin respuesta");
      setTestFile(data.archivo || null);
    } catch { setTestResp("Error al conectar con el bot."); }
    finally   { setTesting(false); }
  };

  /* ─── Trigger # autocomplete ─────────────────────────── */
  const filteredCatsTrigger = catalogs.filter(c =>
    !triggerFilter ||
    c.nombre.toLowerCase().includes(triggerFilter) ||
    c.identificador.toLowerCase().includes(triggerFilter)
  );
  const filteredDocsTrigger = docTemplates.filter(d =>
    !triggerFilter || d.name.toLowerCase().includes(triggerFilter)
  );
  const filteredForTrigger = [
    ...filteredCatsTrigger.map(c => ({ ...c, _type: 'catalog' })),
    ...filteredDocsTrigger.map(d => ({ ...d, _type: 'doc' })),
  ];

  const handleInstrChange = (e) => {
    const val    = e.target.value;
    setInstrucciones(val);
    const cursor = e.target.selectionStart;
    const before = val.slice(0, cursor);
    const match  = before.match(/#([a-zA-Z0-9_]*)$/);
    if (match) {
      setShowTrigger(true);
      setTriggerFilter(match[1].toLowerCase());
      setTriggerIdx(0);
    } else {
      setShowTrigger(false);
    }
  };

  const handleInstrKeyDown = (e) => {
    if (!showTrigger) return;
    const total = filteredForTrigger.length;
    if (e.key === "ArrowDown")  { e.preventDefault(); setTriggerIdx(i => Math.min(i + 1, total - 1)); }
    else if (e.key === "ArrowUp")   { e.preventDefault(); setTriggerIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" || e.key === "Tab") {
      if (total > 0) { e.preventDefault(); selectFromTrigger(filteredForTrigger[triggerIdx]); }
    }
    else if (e.key === "Escape") { setShowTrigger(false); }
  };

  const selectFromTrigger = (item) => {
    const ta     = textareaRef.current;
    const cursor = ta.selectionStart;
    const val    = instrucciones;
    const before = val.slice(0, cursor);
    const hash   = before.lastIndexOf("#");
    if (hash === -1) return;
    const tag  = item._type === 'doc'
      ? `[START_DOC:${item.name}]`
      : `{{catalogo:${item.identificador}}}`;
    const next = val.slice(0, hash) + tag + val.slice(cursor);
    setInstrucciones(next);
    setShowTrigger(false);
    setTriggerFilter("");
    setTimeout(() => {
      ta.focus();
      const pos = hash + tag.length;
      ta.setSelectionRange(pos, pos);
    }, 0);
  };

  /* ─── Catálogos CRUD ─────────────────────────────────── */
  const handleCatalogSave = (saved) => {
    setCatalogs(prev => {
      const exists = prev.find(c => c.id === saved.id);
      return exists ? prev.map(c => c.id === saved.id ? saved : c) : [saved, ...prev];
    });
    setCatalogModal(null);
  };

  const deleteCatalog = async (id) => {
    if (!confirm("¿Eliminar este catálogo?")) return;
    try {
      await fetch(`/api/bot-catalogs/${id}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${TOKEN()}` }
      });
      setCatalogs(prev => prev.filter(c => c.id !== id));
    } catch (e) { console.error(e); }
  };

  const deleteCatalogFile = async (id) => {
    if (!confirm("¿Eliminar el documento adjunto de este catálogo?")) return;
    try {
      const res  = await fetch(`/api/bot-catalogs/${id}/file`, {
        method: "DELETE", headers: { Authorization: `Bearer ${TOKEN()}` }
      });
      const data = await res.json();
      if (data.success) {
        setCatalogs(prev => prev.map(c => c.id === id
          ? { ...c, archivo_url: null, archivo_nombre: null, archivo_tipo: null }
          : c
        ));
      }
    } catch (e) { console.error(e); }
  };

  const copyTag = (identificador) => {
    navigator.clipboard.writeText(`{{catalogo:${identificador}}}`);
    setCopiedId(identificador);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const insertTag = (identificador) => {
    const ta  = textareaRef.current;
    const pos = ta?.selectionStart ?? instrucciones.length;
    const tag = `{{catalogo:${identificador}}}`;
    const sep = instrucciones && !instrucciones.slice(0, pos).endsWith("\n") ? "\n" : "";
    const next = instrucciones.slice(0, pos) + sep + tag + instrucciones.slice(pos);
    setInstrucciones(next);
    setTimeout(() => {
      ta?.focus();
      const newPos = pos + sep.length + tag.length;
      ta?.setSelectionRange(newPos, newPos);
    }, 0);
  };

  /* ─── Loading ────────────────────────────────────────── */
  if (loading) return (
    <div style={{ padding: "3rem", textAlign: "center", color: "#9ca3af", fontSize: 14,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
      <Loader size={16} style={{ animation: "spin 1s linear infinite" }} />
      Cargando configuración...
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={s.wrap}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

      {/* ── HEADER ─────────────────────────────────────── */}
      <div style={s.header}>
        <div>
          <h1 style={s.title}>Configuración del bot</h1>
          <p style={s.sub}>Define cómo responde tu asistente automático</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div onClick={() => setBotActivo(!botActivo)}
                 style={{ ...s.toggle, background: botActivo ? "#16a34a" : "#d1d5db" }}>
              <div style={{ ...s.toggleThumb, left: botActivo ? 20 : 3 }} />
            </div>
            <span style={{ fontSize: 13, color: botActivo ? "#16a34a" : "#9ca3af",
                           fontWeight: 500, display: "flex", alignItems: "center", gap: 4 }}>
              <Power size={13} strokeWidth={2} />
              {botActivo ? "Bot activo" : "Bot pausado"}
            </span>
          </div>
          <button onClick={handleSave} disabled={saving}
                  style={{ ...s.btnSave, opacity: saving ? 0.7 : 1,
                           display: "flex", alignItems: "center", gap: 6 }}>
            {saving ? <><Loader size={13} style={{ animation: "spin 1s linear infinite" }} /> Guardando...</>
            : saved  ? <><CheckCircle size={13} /> Guardado</>
            :           <><Save size={13} /> Guardar</>}
          </button>
        </div>
      </div>

      {/* ── DOS COLUMNAS: instrucciones | probar ──────────── */}
      <div style={s.cols}>

        {/* INSTRUCCIONES con trigger # */}
        <div style={s.card}>
          <div style={s.cardHeader}>
            <div style={s.iconBox}><Brain size={16} strokeWidth={1.5} color="#6b7280" /></div>
            <div>
              <div style={s.cardTitle}>Instrucciones</div>
              <div style={s.cardSub}>
                Define la personalidad, servicios y reglas del bot.
                Escribe <code style={s.code}>#</code> para insertar un catálogo de forma rápida.
              </div>
            </div>
          </div>

          {/* Wrapper con posición relativa para el dropdown */}
          <div style={{ position: "relative" }}>

            {/* Dropdown trigger # */}
            {showTrigger && (
              <div style={{
                position: "absolute", bottom: "calc(100% + 6px)", left: 0, right: 0,
                background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10,
                boxShadow: "0 -4px 28px rgba(0,0,0,0.12)", zIndex: 40,
                maxHeight: 260, overflow: "auto",
              }}>
                {/* Header dropdown */}
                <div style={{ padding: "8px 12px", borderBottom: "1px solid #f3f4f6",
                              display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 500 }}>
                    {triggerFilter
                      ? `Resultados para "${triggerFilter}"`
                      : "Selecciona un catálogo o documento"}
                  </span>
                  <span style={{ fontSize: 10, color: "#9ca3af" }}>↑↓ navegar · Enter insertar · Esc cerrar</span>
                </div>

                {filteredForTrigger.length === 0 ? (
                  <div style={{ padding: "16px 14px", textAlign: "center" }}>
                    <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>
                      {(catalogs.length + docTemplates.length) === 0
                        ? "No hay catálogos ni documentos creados."
                        : `Sin resultados para "${triggerFilter}"`}
                    </p>
                  </div>
                ) : (
                  <>
                    {/* ── Sección Catálogos ── */}
                    {filteredCatsTrigger.length > 0 && (
                      <>
                        <div style={{ padding: "5px 12px 3px", fontSize: 10, fontWeight: 700,
                                      color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em",
                                      background: "#f9fafb", borderBottom: "1px solid #f3f4f6" }}>
                          Catálogos
                        </div>
                        {filteredCatsTrigger.map((cat, i) => {
                          const flatIdx = i;
                          const tc = TIPO_CFG[cat.tipo] || TIPO_CFG.general;
                          return (
                            <button
                              key={`cat-${cat.id}`}
                              onMouseDown={e => { e.preventDefault(); selectFromTrigger({ ...cat, _type: 'catalog' }); }}
                              style={{
                                display: "flex", alignItems: "center", gap: 10, width: "100%",
                                padding: "9px 14px", border: "none", textAlign: "left", cursor: "pointer",
                                background: flatIdx === triggerIdx ? "#f0f9ff" : "#fff",
                                borderBottom: "1px solid #f9fafb", transition: "background 0.1s",
                              }}
                              onMouseEnter={() => setTriggerIdx(flatIdx)}
                            >
                              <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px",
                                             borderRadius: 20, background: tc.bg, color: tc.fg,
                                             flexShrink: 0, whiteSpace: "nowrap" }}>
                                {tc.label}
                              </span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 500, color: "#111827",
                                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {cat.nombre}
                                </div>
                                <code style={{ fontSize: 10, color: "#6d28d9", background: "#ede9fe",
                                               padding: "1px 5px", borderRadius: 4 }}>
                                  {`{{catalogo:${cat.identificador}}}`}
                                </code>
                              </div>
                              {flatIdx === triggerIdx && (
                                <span style={{ fontSize: 10, color: "#9ca3af", flexShrink: 0 }}>Enter ↵</span>
                              )}
                            </button>
                          );
                        })}
                      </>
                    )}

                    {/* ── Sección Documentos ── */}
                    {filteredDocsTrigger.length > 0 && (
                      <>
                        <div style={{ padding: "5px 12px 3px", fontSize: 10, fontWeight: 700,
                                      color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em",
                                      background: "#f9fafb", borderBottom: "1px solid #f3f4f6" }}>
                          Documentos
                        </div>
                        {filteredDocsTrigger.map((doc, j) => {
                          const flatIdx = filteredCatsTrigger.length + j;
                          return (
                            <button
                              key={`doc-${doc.id}`}
                              onMouseDown={e => { e.preventDefault(); selectFromTrigger({ ...doc, _type: 'doc' }); }}
                              style={{
                                display: "flex", alignItems: "center", gap: 10, width: "100%",
                                padding: "9px 14px", border: "none", textAlign: "left", cursor: "pointer",
                                background: flatIdx === triggerIdx ? "#f0f9ff" : "#fff",
                                borderBottom: "1px solid #f9fafb", transition: "background 0.1s",
                              }}
                              onMouseEnter={() => setTriggerIdx(flatIdx)}
                            >
                              <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px",
                                             borderRadius: 20, background: "#dcfce7", color: "#15803d",
                                             flexShrink: 0, whiteSpace: "nowrap" }}>
                                Documento
                              </span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 500, color: "#111827",
                                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {doc.name}
                                </div>
                                <code style={{ fontSize: 10, color: "#15803d", background: "#dcfce7",
                                               padding: "1px 5px", borderRadius: 4 }}>
                                  {`[START_DOC:${doc.name}]`}
                                </code>
                              </div>
                              {flatIdx === triggerIdx && (
                                <span style={{ fontSize: 10, color: "#9ca3af", flexShrink: 0 }}>Enter ↵</span>
                              )}
                            </button>
                          );
                        })}
                      </>
                    )}
                  </>
                )}
              </div>
            )}

            <textarea
              ref={textareaRef}
              value={instrucciones}
              onChange={handleInstrChange}
              onKeyDown={handleInstrKeyDown}
              onBlur={() => setTimeout(() => setShowTrigger(false), 160)}
              placeholder={PLACEHOLDER}
              style={s.bigTextarea}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            <span style={s.hint}>{instrucciones.length} caracteres</span>
            <span style={s.hint}>Escribe # para insertar catálogos rápidamente</span>
          </div>
        </div>

        {/* PROBAR BOT */}
        <div style={s.card}>
          <div style={s.cardHeader}>
            <div style={s.iconBox}><Play size={16} strokeWidth={1.5} color="#6b7280" /></div>
            <div>
              <div style={s.cardTitle}>Probar bot</div>
              <div style={s.cardSub}>Simula una conversación con las instrucciones actuales</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 6 }}>
            <input
              type="text" value={testMsg}
              onChange={e => setTestMsg(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleTest()}
              placeholder="Escribe una pregunta..."
              style={{ ...s.input, flex: 1 }}
            />
            <button onClick={handleTest}
                    disabled={testing || !instrucciones.trim()}
                    style={{ ...s.btnTest, opacity: (!instrucciones.trim() || testing) ? 0.5 : 1,
                             display: "flex", alignItems: "center", gap: 5 }}>
              {testing ? <Loader size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Play size={12} />}
              {testing ? "..." : "Enviar"}
            </button>
          </div>

          {!instrucciones.trim() && (
            <p style={{ fontSize: 11, color: "#b45309", marginTop: 6 }}>
              Escribe las instrucciones primero.
            </p>
          )}
          {testResp && (
            <div style={s.testResp}>
              <span style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4, fontWeight: 500 }}>
                Respuesta del bot:
              </span>
              <p style={{ fontSize: 13, color: "#111827", margin: 0, lineHeight: 1.6 }}>{testResp}</p>

              {/* Archivo adjunto detectado */}
              {testFile && (
                <div style={{ marginTop: 10, padding: "8px 10px", background: "#f0fdf4",
                              border: "1px solid #bbf7d0", borderRadius: 8,
                              display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 20 }}>
                    {testFile.tipo === "application/pdf" ? <FileText size={20} color="#16a34a" /> : <Image size={20} color="#16a34a" />}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 11, color: "#166534", fontWeight: 600, margin: 0,
                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {testFile.nombre}
                    </p>
                    <p style={{ fontSize: 10, color: "#4ade80", margin: "2px 0 0" }}>
                      El bot enviaría este archivo al cliente en la conversación real
                    </p>
                  </div>
                  <a
                    href={testFile.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 11, color: "#16a34a", background: "#dcfce7",
                             border: "1px solid #86efac", borderRadius: 6,
                             padding: "4px 10px", textDecoration: "none", whiteSpace: "nowrap" }}>
                    Ver archivo
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Mini guía de catálogos */}
          {catalogs.length > 0 && (
            <div style={{ marginTop: 14, borderTop: "1px solid #f3f4f6", paddingTop: 12 }}>
              <p style={{ fontSize: 11, color: "#6b7280", fontWeight: 500, margin: "0 0 6px" }}>
                Catálogos disponibles:
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {catalogs.slice(0, 5).map(cat => {
                  const tc = TIPO_CFG[cat.tipo] || TIPO_CFG.general;
                  return (
                    <div key={cat.id}
                         style={{ display: "flex", alignItems: "center", gap: 6,
                                  padding: "4px 8px", background: "#f9fafb",
                                  borderRadius: 6, border: "1px solid #f3f4f6" }}>
                      <span style={{ fontSize: 9, fontWeight: 600, padding: "1px 5px",
                                     borderRadius: 20, background: tc.bg, color: tc.fg, flexShrink: 0 }}>
                        {tc.label}
                      </span>
                      <span style={{ fontSize: 11, color: "#374151", flex: 1, overflow: "hidden",
                                     textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {cat.nombre}
                      </span>
                      <button
                        onClick={() => insertTag(cat.identificador)}
                        title="Insertar en instrucciones"
                        style={{ fontSize: 10, background: "#ede9fe", color: "#6d28d9",
                                 border: "none", borderRadius: 4, padding: "2px 6px",
                                 cursor: "pointer", flexShrink: 0 }}>
                        + Insertar
                      </button>
                    </div>
                  );
                })}
                {catalogs.length > 5 && (
                  <p style={{ fontSize: 10, color: "#9ca3af", margin: 0, textAlign: "center" }}>
                    y {catalogs.length - 5} más en la sección de abajo
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          CATÁLOGOS DE CONTEXTO (sección completa)
      ══════════════════════════════════════════════════ */}
      <div style={{ ...s.card, marginTop: 12 }}>

        <div style={{ display: "flex", alignItems: "flex-start",
                      justifyContent: "space-between", marginBottom: 12, gap: 10 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div style={s.iconBox}><BookOpen size={16} strokeWidth={1.5} color="#6b7280" /></div>
            <div>
              <div style={s.cardTitle}>Catálogos de Contexto</div>
              <div style={s.cardSub}>
                Información estructurada que el bot usará al responder (vehículos, tarifas, seguros, productos...).
                Escribe <code style={s.code}>#</code> en las instrucciones para insertar rápidamente.
              </div>
            </div>
          </div>
          <button
            onClick={() => setCatalogModal("create")}
            style={{ ...s.btnSave, display: "flex", alignItems: "center", gap: 5,
                     whiteSpace: "nowrap", flexShrink: 0 }}>
            <Plus size={13} /> Nuevo catálogo
          </button>
        </div>

        {/* Aviso informativo */}
        <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8,
                      padding: "10px 14px", marginBottom: 14,
                      display: "flex", alignItems: "flex-start", gap: 8 }}>
          <Info size={15} style={{ flexShrink: 0, color: '#0369a1' }} />
          <p style={{ fontSize: 12, color: "#0369a1", margin: 0, lineHeight: 1.6 }}>
            <strong>¿Cómo funciona?</strong> Crea un catálogo y usa su tag en las instrucciones.
            El bot recibirá toda la información del catálogo en su contexto cuando le llegue un mensaje.
            Ejemplo: <code style={{ fontFamily: "monospace", fontSize: 11, background: "#e0f2fe",
                                    padding: "1px 5px", borderRadius: 3 }}>
              {"Cuando pregunten por precios usa {{catalogo:vehiculos_2024}}"}
            </code>
          </p>
        </div>

        {/* Grid de catálogos */}
        {catalogs.length === 0 ? (
          <div style={{ textAlign: "center", padding: "2.5rem 1rem", color: "#9ca3af" }}>
            <BookOpen size={34} strokeWidth={1} style={{ marginBottom: 8, color: "#d1d5db" }} />
            <p style={{ fontSize: 13, margin: 0, color: "#6b7280" }}>No hay catálogos creados aún.</p>
            <p style={{ fontSize: 12, margin: "4px 0 0" }}>
              Crea el primero para que el bot use información estructurada al responder.
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
            {catalogs.map(cat => {
              const tc       = TIPO_CFG[cat.tipo] || TIPO_CFG.general;
              const isCopied = copiedId === cat.identificador;
              return (
                <div key={cat.id} style={s.catalogCard}>
                  <div style={{ display: "flex", alignItems: "flex-start",
                                justifyContent: "space-between", gap: 6 }}>
                    <div style={{ minWidth: 0 }}>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px",
                                     borderRadius: 20, background: tc.bg, color: tc.fg,
                                     display: "inline-block" }}>
                        {tc.label}
                      </span>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginTop: 4,
                                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {cat.nombre}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
                      <button onClick={() => setCatalogModal(cat)} style={s.iconBtn} title="Editar">
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => deleteCatalog(cat.id)}
                              style={{ ...s.iconBtn, color: "#ef4444" }} title="Eliminar">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {cat.descripcion && (
                    <p style={{ fontSize: 11, color: "#6b7280", margin: "6px 0 0", lineHeight: 1.5,
                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {cat.descripcion}
                    </p>
                  )}

                  {/* Indicador de archivo adjunto con botón de eliminar */}
                  {cat.archivo_url ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6,
                                  padding: "5px 10px", background: "#f0fdf4",
                                  border: "1px solid #bbf7d0", borderRadius: 6 }}>
                      <span style={{ fontSize: 14, flexShrink: 0 }}>
                        {cat.archivo_tipo === "application/pdf" ? "📄" : "🖼️"}
                      </span>
                      <span style={{ fontSize: 11, color: "#166534", overflow: "hidden",
                                     textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1,
                                     fontWeight: 500 }}>
                        {cat.archivo_nombre}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); deleteCatalogFile(cat.id); }}
                        title="Eliminar archivo adjunto"
                        style={{ display: "flex", alignItems: "center", gap: 3,
                                 background: "#fee2e2", border: "1px solid #fca5a5",
                                 borderRadius: 5, cursor: "pointer", padding: "3px 8px",
                                 color: "#dc2626", fontSize: 11, fontWeight: 500,
                                 flexShrink: 0, lineHeight: 1 }}>
                        <Trash2 size={11} />
                        Quitar PDF
                      </button>
                    </div>
                  ) : null}

                  <div style={{ fontSize: 11, color: "#374151", background: "#f9fafb",
                                border: "1px solid #f3f4f6", borderRadius: 6, padding: "6px 8px",
                                marginTop: 8, fontFamily: "monospace", lineHeight: 1.6,
                                maxHeight: 54, overflow: "hidden" }}>
                    {cat.contenido?.trim()
                      ? `${cat.contenido.slice(0, 120)}${cat.contenido.length > 120 ? "…" : ""}`
                      : cat.archivo_url
                        ? <span style={{ color: "#9ca3af", fontFamily: "sans-serif" }}>Contenido desde archivo adjunto</span>
                        : <span style={{ color: "#fbbf24", fontFamily: "sans-serif" }}>Sin contenido</span>}
                  </div>

                  <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                    <button
                      onClick={() => copyTag(cat.identificador)}
                      style={{
                        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                        gap: 5, fontSize: 11, fontFamily: "monospace",
                        background: isCopied ? "#dcfce7" : "#f3f4f6",
                        color: isCopied ? "#16a34a" : "#374151",
                        border: "none", borderRadius: 6, padding: "6px 8px", cursor: "pointer",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                      {isCopied ? <Check size={11} /> : <Copy size={11} />}
                      {isCopied ? "¡Copiado!" : `{{catalogo:${cat.identificador}}}`}
                    </button>
                    <button
                      onClick={() => insertTag(cat.identificador)}
                      style={{ fontSize: 11, background: "#ede9fe", color: "#6d28d9",
                               border: "none", borderRadius: 6, padding: "6px 10px",
                               cursor: "pointer", display: "flex", alignItems: "center",
                               gap: 4, whiteSpace: "nowrap" }}>
                      <Plus size={11} /> Insertar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal catálogo */}
      {catalogModal && (
        <CatalogModal
          catalog={catalogModal === "create" ? null : catalogModal}
          onSave={handleCatalogSave}
          onClose={() => setCatalogModal(null)}
        />
      )}
    </div>
  );
}

/* ─── Estilos ────────────────────────────────────────────── */
const s = {
  wrap:        { fontFamily: "'Inter', system-ui, sans-serif", maxWidth: 1160, margin: "0 auto",
                 padding: "1.25rem 1rem", color: "#111827" },
  header:      { display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                 marginBottom: "1rem", flexWrap: "wrap", gap: 10 },
  title:       { fontSize: 18, fontWeight: 700, margin: 0 },
  sub:         { fontSize: 13, color: "#6b7280", margin: "3px 0 0" },
  cols:        { display: "grid", gridTemplateColumns: "1fr 360px", gap: 12, alignItems: "start" },
  card:        { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "1rem 1.1rem" },
  cardHeader:  { display: "flex", gap: 10, alignItems: "flex-start", marginBottom: "0.75rem" },
  iconBox:     { width: 30, height: 30, borderRadius: 7, background: "#f3f4f6",
                 display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  cardTitle:   { fontSize: 14, fontWeight: 600, color: "#111827" },
  cardSub:     { fontSize: 11, color: "#6b7280", marginTop: 2, lineHeight: 1.5 },
  code:        { background: "#f3f4f6", padding: "1px 5px", borderRadius: 3,
                 fontSize: 10, fontFamily: "monospace", color: "#374151" },
  hint:        { fontSize: 11, color: "#9ca3af" },
  bigTextarea: { width: "100%", fontSize: 13, padding: "10px 12px", border: "1px solid #d1d5db",
                 borderRadius: 8, color: "#111827", background: "#fafafa", resize: "vertical",
                 fontFamily: "'Courier New', monospace", lineHeight: 1.6, boxSizing: "border-box",
                 outline: "none", height: "calc(100vh - 280px)", minHeight: 320, maxHeight: 700 },
  input:       { width: "100%", fontSize: 13, padding: "8px 10px", border: "1px solid #d1d5db",
                 borderRadius: 7, color: "#111827", background: "#fafafa", outline: "none",
                 boxSizing: "border-box" },
  label:       { display: "block", fontSize: 12, fontWeight: 500, color: "#374151", marginBottom: 5 },
  btnTest:     { fontSize: 12, fontWeight: 600, color: "#fff", background: "#3b82f6",
                 border: "none", borderRadius: 7, padding: "8px 14px", cursor: "pointer", whiteSpace: "nowrap" },
  btnSave:     { fontSize: 13, fontWeight: 600, color: "#fff", background: "#16a34a",
                 border: "none", borderRadius: 8, padding: "8px 18px", cursor: "pointer" },
  btnCancel:   { fontSize: 13, color: "#6b7280", background: "none", border: "1px solid #d1d5db",
                 borderRadius: 8, padding: "8px 16px", cursor: "pointer" },
  iconBtn:     { color: "#9ca3af", background: "none", border: "none", cursor: "pointer",
                 padding: "4px 6px", display: "flex", alignItems: "center", borderRadius: 6 },
  testResp:    { marginTop: 10, background: "#f8fafc", border: "1px solid #e2e8f0",
                 borderRadius: 7, padding: "10px 12px" },
  toggle:      { width: 42, height: 24, borderRadius: 20, cursor: "pointer",
                 position: "relative", transition: "background 0.2s", flexShrink: 0 },
  toggleThumb: { position: "absolute", width: 18, height: 18, borderRadius: "50%",
                 background: "#fff", top: 3, transition: "left 0.2s" },
  catalogCard: { background: "#fafafa", border: "1px solid #e5e7eb", borderRadius: 10, padding: "12px 14px" },
};
