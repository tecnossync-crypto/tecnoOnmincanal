const fetch = require('node-fetch');
const logger = require('../config/logger');

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const TOKEN_URL  = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

const CLIENT_ID     = process.env.OUTLOOK_CLIENT_ID;
const CLIENT_SECRET = process.env.OUTLOOK_CLIENT_SECRET;
const REDIRECT_URI  = process.env.OUTLOOK_REDIRECT_URI || `${process.env.API_BASE_URL || 'http://localhost:3001'}/api/outlook/callback`;

const SCOPES = [
  'Calendars.ReadWrite',
  'offline_access',
  'User.Read',
].join(' ');

// ─── OAuth ────────────────────────────────────────────────────────────────────

function getAuthUrl(state) {
  const params = new URLSearchParams({
    client_id:     CLIENT_ID,
    response_type: 'code',
    redirect_uri:  REDIRECT_URI,
    scope:         SCOPES,
    response_mode: 'query',
    state,
  });
  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`;
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
    expires_at:    Date.now() + data.expires_in * 1000,
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
      scope:         SCOPES,
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error_description || data.error);
  return {
    access_token:  data.access_token,
    refresh_token: data.refresh_token || refresh_token,
    expires_at:    Date.now() + data.expires_in * 1000,
  };
}

// ─── Obtener token válido (refresca si expiró) ────────────────────────────────

async function getValidToken(company) {
  const tokens = company.outlook_tokens;
  if (!tokens?.access_token) throw new Error('Cuenta de Outlook no conectada');

  if (Date.now() < tokens.expires_at - 60000) {
    return tokens.access_token;
  }

  logger.info(`🔄 Refrescando token Outlook para empresa ${company.id}`);
  const newTokens = await refreshTokens(tokens.refresh_token);
  await company.update({ outlook_tokens: { ...tokens, ...newTokens } });
  return newTokens.access_token;
}

// ─── Graph API helper ─────────────────────────────────────────────────────────

async function graphGet(token, path) {
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Graph error ${res.status}`);
  }
  return res.json();
}

async function graphPost(token, path, body) {
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Graph error ${res.status}`);
  }
  return res.json();
}

async function graphPatch(token, path, body) {
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Graph error ${res.status}`);
  }
  return res.json();
}

async function graphDelete(token, path) {
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Graph delete error ${res.status}`);
  }
}

// ─── Calendar Events ──────────────────────────────────────────────────────────

async function getCalendarEvents(company, startDate, endDate) {
  const token = await getValidToken(company);
  const start = `${startDate}T00:00:00`;
  const end   = `${endDate}T23:59:59`;
  const params = new URLSearchParams({
    startDateTime: start,
    endDateTime:   end,
    '$select':     'id,subject,start,end,bodyPreview,organizer,location,isAllDay',
    '$top':        '100',
    '$orderby':    'start/dateTime',
  });
  const data = await graphGet(token, `/me/calendarView?${params}`);
  return data.value || [];
}

async function createCalendarEvent(company, appointment) {
  const token = await getValidToken(company);
  const { date, start_time, duration_minutes, title, contact_name, contact_phone, notes } = appointment;

  const startDT = new Date(`${date}T${start_time}:00`);
  const endDT   = new Date(startDT.getTime() + (duration_minutes || 30) * 60000);

  const event = {
    subject: title || `Cita — ${contact_name}`,
    body: {
      contentType: 'text',
      content: [
        `Cliente: ${contact_name}`,
        contact_phone ? `Teléfono: ${contact_phone}` : '',
        notes ? `Notas: ${notes}` : '',
        '\nCreado desde Tecnossync Omnichannel',
      ].filter(Boolean).join('\n'),
    },
    start: { dateTime: startDT.toISOString(), timeZone: 'America/Santo_Domingo' },
    end:   { dateTime: endDT.toISOString(),   timeZone: 'America/Santo_Domingo' },
  };

  const created = await graphPost(token, '/me/events', event);
  return created.id;
}

async function updateCalendarEvent(company, outlookEventId, appointment) {
  if (!outlookEventId) return;
  const token = await getValidToken(company);
  const { date, start_time, duration_minutes, title, contact_name } = appointment;

  const startDT = new Date(`${date}T${start_time}:00`);
  const endDT   = new Date(startDT.getTime() + (duration_minutes || 30) * 60000);

  await graphPatch(token, `/me/events/${outlookEventId}`, {
    subject: title || `Cita — ${contact_name}`,
    start:   { dateTime: startDT.toISOString(), timeZone: 'America/Santo_Domingo' },
    end:     { dateTime: endDT.toISOString(),   timeZone: 'America/Santo_Domingo' },
  });
}

async function deleteCalendarEvent(company, outlookEventId) {
  if (!outlookEventId) return;
  const token = await getValidToken(company);
  await graphDelete(token, `/me/events/${outlookEventId}`);
}

async function getUserInfo(accessToken) {
  return graphGet(accessToken, '/me?$select=displayName,mail,userPrincipalName');
}

module.exports = {
  getAuthUrl,
  exchangeCode,
  getValidToken,
  getCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  getUserInfo,
};
