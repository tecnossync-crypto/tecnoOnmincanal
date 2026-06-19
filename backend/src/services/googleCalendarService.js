// backend/src/services/googleCalendarService.js
// Google Calendar via OAuth2 REST (no SDK, usa node-fetch igual que Outlook)
const fetch  = require('node-fetch');
const logger = require('../config/logger');

const TOKEN_URL  = 'https://oauth2.googleapis.com/token';
const GCAL_BASE  = 'https://www.googleapis.com/calendar/v3';
const OAUTH_BASE = 'https://accounts.google.com/o/oauth2/v2/auth';

const CLIENT_ID     = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI  = process.env.GOOGLE_REDIRECT_URI
  || `${process.env.API_BASE_URL || 'http://localhost:3001'}/api/gcal/callback`;

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
].join(' ');

// ── OAuth ──────────────────────────────────────────────────────────────────────

function getAuthUrl(state) {
  const params = new URLSearchParams({
    client_id:     CLIENT_ID,
    redirect_uri:  REDIRECT_URI,
    response_type: 'code',
    scope:         SCOPES,
    access_type:   'offline',   // necesario para refresh_token
    prompt:        'consent',   // fuerza refresh_token incluso si ya autorizó
    state,
  });
  return `${OAUTH_BASE}?${params}`;
}

async function exchangeCode(code) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      redirect_uri:  REDIRECT_URI,
      grant_type:    'authorization_code',
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error_description || data.error);
  return {
    access_token:  data.access_token,
    refresh_token: data.refresh_token,
    expires_at:    Date.now() + (data.expires_in || 3600) * 1000,
  };
}

async function refreshTokens(refresh_token) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token,
      grant_type:    'refresh_token',
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error_description || data.error);
  return {
    access_token:  data.access_token,
    refresh_token: data.refresh_token || refresh_token, // Google no siempre rota el RT
    expires_at:    Date.now() + (data.expires_in || 3600) * 1000,
  };
}

// ── Token válido (refresca si expiró) ─────────────────────────────────────────

async function getValidToken(company) {
  const tokens = company.google_calendar_tokens;
  if (!tokens?.access_token) throw new Error('Google Calendar no conectado');

  if (Date.now() < tokens.expires_at - 60000) return tokens.access_token;

  logger.info(`🔄 Refrescando token Google Calendar empresa ${company.id}`);
  const newTokens = await refreshTokens(tokens.refresh_token);
  await company.update({ google_calendar_tokens: { ...tokens, ...newTokens } });
  return newTokens.access_token;
}

// ── REST helpers ──────────────────────────────────────────────────────────────

async function gcalGet(token, path) {
  const res = await fetch(`${GCAL_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `GCal GET error ${res.status}`);
  }
  return res.json();
}

async function gcalPost(token, path, body) {
  const res = await fetch(`${GCAL_BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `GCal POST error ${res.status}`);
  }
  return res.json();
}

async function gcalPatch(token, path, body) {
  const res = await fetch(`${GCAL_BASE}${path}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `GCal PATCH error ${res.status}`);
  }
  return res.json();
}

async function gcalDelete(token, path) {
  const res = await fetch(`${GCAL_BASE}${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 410) { // 410 = ya borrado
    throw new Error(`GCal DELETE error ${res.status}`);
  }
}

// ── Perfil del usuario ────────────────────────────────────────────────────────

async function getUserInfo(access_token) {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  if (!res.ok) throw new Error('No se pudo obtener info de usuario Google');
  return res.json(); // { id, email, name, picture }
}

// ── Eventos del calendario ────────────────────────────────────────────────────

async function getCalendarEvents(company, startDate, endDate) {
  const token = await getValidToken(company);
  const params = new URLSearchParams({
    timeMin:      `${startDate}T00:00:00Z`,
    timeMax:      `${endDate}T23:59:59Z`,
    singleEvents: 'true',
    orderBy:      'startTime',
    maxResults:   '100',
  });
  const data = await gcalGet(token, `/calendars/primary/events?${params}`);
  return data.items || [];
}

async function createCalendarEvent(company, appointment) {
  const token = await getValidToken(company);
  const { date, start_time, duration_minutes, title, contact_name, contact_phone, notes } = appointment;

  const tz      = company.google_calendar_tokens?.timezone || 'America/Santo_Domingo';
  const startDT = new Date(`${date}T${start_time}:00`);
  const endDT   = new Date(startDT.getTime() + (duration_minutes || 30) * 60000);

  const event = {
    summary:     title || `Cita — ${contact_name}`,
    description: [
      `Cliente: ${contact_name}`,
      contact_phone ? `Teléfono: ${contact_phone}` : '',
      notes         ? `Notas: ${notes}`              : '',
      '',
      'Creado desde Tecnossync Omnichannel',
    ].filter(l => l !== undefined).join('\n').trim(),
    start: { dateTime: startDT.toISOString(), timeZone: tz },
    end:   { dateTime: endDT.toISOString(),   timeZone: tz },
  };

  const created = await gcalPost(token, '/calendars/primary/events', event);
  return created.id;
}

async function updateCalendarEvent(company, googleEventId, appointment) {
  if (!googleEventId) return;
  const token = await getValidToken(company);
  const { date, start_time, duration_minutes, title, contact_name } = appointment;

  const tz      = company.google_calendar_tokens?.timezone || 'America/Santo_Domingo';
  const startDT = new Date(`${date}T${start_time}:00`);
  const endDT   = new Date(startDT.getTime() + (duration_minutes || 30) * 60000);

  await gcalPatch(token, `/calendars/primary/events/${googleEventId}`, {
    summary: title || `Cita — ${contact_name}`,
    start:   { dateTime: startDT.toISOString(), timeZone: tz },
    end:     { dateTime: endDT.toISOString(),   timeZone: tz },
  });
}

async function deleteCalendarEvent(company, googleEventId) {
  if (!googleEventId) return;
  const token = await getValidToken(company);
  await gcalDelete(token, `/calendars/primary/events/${googleEventId}`);
}

module.exports = {
  getAuthUrl,
  exchangeCode,
  getValidToken,
  getUserInfo,
  getCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
};
