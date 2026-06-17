# 🔷 Tecnossync — Plataforma Omnicanal con IA

> WhatsApp · Messenger · Instagram | Claude AI | Node.js + React | Docker

---

## 🚀 Inicio rápido

### 1. Configurar variables de entorno

```bash
cd omnichannel/backend
cp .env.example .env
# Edita .env y pon tu ANTHROPIC_API_KEY y JWT_SECRET
```

### 2. Levantar con Docker

```bash
cd omnichannel
docker-compose up --build
```

Primera vez: ~5 minutos. Crea automáticamente las tablas y el equipo de 5 empleados.

### 3. Acceder

| URL | Descripción |
|-----|-------------|
| http://localhost:3000 | Frontend (Tecnossync) |
| http://localhost:3001/api | Backend API |
| http://localhost:3001/api/health | Health check |

---

## 👥 Equipo por defecto

| Email | Contraseña | Rol |
|-------|-----------|-----|
| admin@tecnossync.com | Tecnossync2025! | Admin |
| ana.garcia@tecnossync.com | Agente2025! | Agente |
| carlos.lopez@tecnossync.com | Agente2025! | Agente |
| maria.rodriguez@tecnossync.com | Agente2025! | Agente |
| luis.martinez@tecnossync.com | Agente2025! | Agente |

> ⚠️ Cambia las contraseñas antes de producción desde el panel Equipo (admin).

---

## 📁 Estructura

```
omnichannel/
├── backend/
│   └── src/
│       ├── controllers/   authController, messageController, userController,
│       │                  botConfigController, campaignController, webhookController
│       ├── services/      messageService, chatbotService, metaService, campaignService
│       ├── models/        User, Contact, Conversation, Message, BotConfig, Campaign
│       ├── middleware/    auth.js (JWT + RBAC), errorHandler.js
│       ├── routes/        index.js
│       └── index.js       servidor principal
└── frontend/
    └── src/
        ├── components/
        │   ├── Auth/      Login.jsx
        │   ├── Layout/    Layout.jsx (sidebar Tecnossync)
        │   ├── Inbox/     Inbox.jsx, ConversationList.jsx
        │   ├── Chat/      ChatWindow.jsx
        │   ├── BotConfig/ BotConfigPanel.jsx
        │   ├── Campaigns/ CampaignsPanel.jsx
        │   └── Team/      TeamPanel.jsx (nuevo)
        ├── store/         index.js (Zustand)
        ├── services/      api.js, socket.js
        └── App.jsx
```

---

## 🔐 RBAC — Roles y permisos

| Acción | Admin | Agente |
|--------|:-----:|:------:|
| Ver bandeja (todas) | ✅ | ❌ |
| Ver bandeja (asignadas) | ✅ | ✅ |
| Enviar mensajes | ✅ | ✅ (solo asignadas) |
| Asignar conversaciones | ✅ | ❌ |
| Configurar bot | ✅ | ❌ |
| Lanzar campañas | ✅ | ❌ |
| Gestionar equipo | ✅ | ❌ |

---

## 📡 Webhooks Meta

```
GET/POST http://tu-dominio.com/api/webhook/whatsapp
GET/POST http://tu-dominio.com/api/webhook/messenger
GET/POST http://tu-dominio.com/api/webhook/instagram
```

Para pruebas locales: `ngrok http 3001`
