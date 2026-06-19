const nodemailer = require('nodemailer');
const logger = require('../config/logger');

let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;

  const host = process.env.SMTP_HOST;
  if (!host) return null;

  _transporter = nodemailer.createTransport({
    host,
    port:   Number(process.env.SMTP_PORT) || 465,
    secure: process.env.SMTP_SECURE !== 'false', // true por defecto (465 SSL)
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: { rejectUnauthorized: false },
  });

  return _transporter;
}

async function sendPasswordReset(toEmail, resetLink, userName, type = 'password_reset') {
  const isEmailChange = type === 'email_change';
  const transporter = getTransporter();
  if (!transporter) return false;

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px;text-align:center">
            <h1 style="color:#fff;margin:0;font-size:24px;font-weight:800;letter-spacing:-0.5px">Tecnossync</h1>
            <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:13px">Plataforma Omnicanal</p>
          </td>
        </tr>

        <!-- Cuerpo -->
        <tr>
          <td style="padding:40px 32px">
            <h2 style="color:#f1f5f9;font-size:20px;margin:0 0 8px;font-weight:700">
              ${isEmailChange ? 'Confirma tu nuevo correo' : 'Recuperación de contraseña'}
            </h2>
            ${userName ? `<p style="color:#94a3b8;font-size:14px;margin:0 0 20px">Hola <strong style="color:#e2e8f0">${userName}</strong>,</p>` : ''}
            <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 24px">
              ${isEmailChange
                ? 'Recibimos una solicitud para cambiar el correo de tu cuenta. Haz clic en el botón para confirmar que este es tu nuevo correo. El enlace expira en <strong style="color:#e2e8f0">24 horas</strong>.'
                : 'Recibimos una solicitud para restablecer la contraseña de tu cuenta. Haz clic en el botón para crear una nueva. El enlace expira en <strong style="color:#e2e8f0">1 hora</strong>.'}
            </p>

            <!-- Botón -->
            <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px">
              <tr>
                <td style="background:${isEmailChange ? '#0ea5e9' : '#6366f1'};border-radius:10px">
                  <a href="${resetLink}"
                    style="display:inline-block;padding:14px 32px;color:#fff;text-decoration:none;font-weight:700;font-size:15px">
                    ${isEmailChange ? 'Confirmar nuevo correo' : 'Restablecer contraseña'}
                  </a>
                </td>
              </tr>
            </table>

            <!-- Link alternativo -->
            <p style="color:#64748b;font-size:12px;text-align:center;margin:0 0 8px">
              Si el botón no funciona, copia este enlace en tu navegador:
            </p>
            <p style="background:#0f172a;border-radius:8px;padding:10px 14px;font-size:11px;color:#6366f1;word-break:break-all;margin:0">
              ${resetLink}
            </p>

            <hr style="border:none;border-top:1px solid #334155;margin:28px 0">
            <p style="color:#475569;font-size:12px;margin:0">
              ${isEmailChange
                ? 'Si no solicitaste este cambio, ignora este correo. Tu correo actual seguirá siendo el mismo.'
                : 'Si no solicitaste este cambio, puedes ignorar este correo. Tu contraseña actual seguirá siendo la misma.'}
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#0f172a;padding:20px 32px;text-align:center">
            <p style="color:#475569;font-size:11px;margin:0">
              © ${new Date().getFullYear()} Tecnossync. Todos los derechos reservados.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    await transporter.sendMail({
      from:    `"Tecnossync" <${from}>`,
      to:      toEmail,
      subject: isEmailChange ? 'Confirma tu nuevo correo — Tecnossync' : 'Recuperación de contraseña — Tecnossync',
      html,
    });
    logger.info(`📧 Email de recuperación enviado a: ${toEmail}`);
    return true;
  } catch (err) {
    logger.error(`❌ Error enviando email a ${toEmail}:`, err.message);
    _transporter = null; // reset para reintentar en próxima llamada
    return false;
  }
}

// ── OTP de inicio de sesión ───────────────────────────────────────────────────
async function sendLoginOTP({ toEmail, userName, otp }) {
  const transporter = getTransporter();
  if (!transporter) return false;

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  const codeBlocks = otp.split('').map(d =>
    `<span style="display:inline-block;width:44px;height:56px;line-height:56px;text-align:center;font-size:26px;font-weight:900;color:#fff;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:12px;margin:0 4px">${d}</span>`
  ).join('');

  const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 16px">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:20px;overflow:hidden;border:1px solid #334155">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px;text-align:center">
            <div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:14px;padding:10px 18px;margin-bottom:12px">
              <span style="color:#fff;font-size:26px;font-weight:900;letter-spacing:-0.5px">Tecnossync</span>
            </div>
            <p style="color:rgba(255,255,255,0.8);margin:0;font-size:12px;letter-spacing:1px;text-transform:uppercase">
              Código de acceso seguro
            </p>
          </td>
        </tr>

        <!-- Cuerpo -->
        <tr>
          <td style="padding:44px 36px">

            <h2 style="color:#f1f5f9;font-size:20px;margin:0 0 6px;font-weight:800">
              Tu código de verificación
            </h2>
            ${userName ? `<p style="color:#94a3b8;font-size:14px;margin:0 0 28px">Hola <strong style="color:#e2e8f0">${userName}</strong>, alguien está intentando iniciar sesión en tu cuenta.</p>` : ''}

            <!-- Código grande -->
            <div style="text-align:center;padding:28px 0;background:#0f172a;border-radius:16px;margin:0 0 28px;border:1px solid #1e3a5f">
              <p style="color:#64748b;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 18px">
                CÓDIGO OTP
              </p>
              <div>${codeBlocks}</div>
              <p style="color:#475569;font-size:12px;margin:18px 0 0">
                ⏱ Expira en <strong style="color:#a5b4fc">10 minutos</strong>
              </p>
            </div>

            <!-- Advertencia de seguridad -->
            <div style="background:#1e293b;border:1px solid #334155;border-left:4px solid #f59e0b;border-radius:10px;padding:16px 18px;margin-bottom:20px">
              <p style="color:#fbbf24;font-size:12px;font-weight:700;margin:0 0 6px">⚠️ Aviso de seguridad</p>
              <p style="color:#94a3b8;font-size:12px;line-height:1.6;margin:0">
                Si no fuiste tú quien intentó iniciar sesión, <strong style="color:#e2e8f0">ignora este correo</strong> y considera cambiar tu contraseña inmediatamente.
              </p>
            </div>

            <p style="color:#475569;font-size:12px;margin:0;line-height:1.6;text-align:center">
              Nunca compartas este código con nadie. Tecnossync jamás te lo pedirá.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#0f172a;padding:18px 36px;text-align:center;border-top:1px solid #1e293b">
            <p style="color:#334155;font-size:11px;margin:0">
              © ${new Date().getFullYear()} Tecnossync · Sistema Omnicanal con IA
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    await transporter.sendMail({
      from:    `"Tecnossync · Seguridad" <${from}>`,
      to:      toEmail,
      subject: `${otp} es tu código de acceso — Tecnossync`,
      html,
    });
    logger.info(`🔐 OTP de login enviado a: ${toEmail}`);
    return true;
  } catch (err) {
    logger.error(`❌ Error enviando OTP a ${toEmail}:`, err.message);
    _transporter = null;
    return false;
  }
}

// ── Email de bienvenida al crear cuenta ───────────────────────────────────────
async function sendWelcomeEmail({ toEmail, userName, companyName, password, verificationCode }) {
  const transporter = getTransporter();
  if (!transporter) return false;

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  // Bloques del código de verificación (6 dígitos separados visualmente)
  const codeBlocks = verificationCode.split('').map(d =>
    `<span style="display:inline-block;width:40px;height:50px;line-height:50px;text-align:center;font-size:24px;font-weight:900;color:#fff;background:#6366f1;border-radius:10px;margin:0 4px">${d}</span>`
  ).join('');

  const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155">

        <!-- Header con gradiente -->
        <tr>
          <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:36px 32px;text-align:center">
            <div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:16px;padding:12px 16px;margin-bottom:16px">
              <span style="color:#fff;font-size:28px;font-weight:900;letter-spacing:-1px">Tecnossync</span>
            </div>
            <p style="color:rgba(255,255,255,0.85);margin:0;font-size:13px;letter-spacing:0.5px">PLATAFORMA OMNICANAL CON IA</p>
          </td>
        </tr>

        <!-- Cuerpo principal -->
        <tr>
          <td style="padding:40px 32px">

            <!-- Saludo -->
            <h2 style="color:#f1f5f9;font-size:22px;margin:0 0 6px;font-weight:800">
              ¡Bienvenido/a a Tecnossync, ${userName}! 🎉
            </h2>
            <p style="color:#94a3b8;font-size:14px;margin:0 0 28px;line-height:1.6">
              Tu cuenta ha sido creada correctamente${companyName ? ` en la empresa <strong style="color:#e2e8f0">${companyName}</strong>` : ''}.
              Para comenzar a usar la plataforma, debes verificar tu correo electrónico con el código de abajo.
            </p>

            <!-- Datos de acceso -->
            <div style="background:#0f172a;border-radius:12px;padding:20px 24px;margin-bottom:28px;border:1px solid #334155">
              <p style="color:#64748b;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin:0 0 12px">
                TUS DATOS DE ACCESO
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:6px 0;color:#64748b;font-size:13px;width:110px">Correo:</td>
                  <td style="padding:6px 0;color:#a5b4fc;font-size:13px;font-weight:600">${toEmail}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#64748b;font-size:13px">Contraseña:</td>
                  <td style="padding:6px 0;color:#e2e8f0;font-size:13px;font-weight:600;font-family:monospace">${password}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#64748b;font-size:13px">Plataforma:</td>
                  <td style="padding:6px 0;color:#6ee7b7;font-size:13px">${process.env.APP_URL || 'Consulta con tu administrador'}</td>
                </tr>
              </table>
            </div>

            <!-- Código de verificación -->
            <div style="text-align:center;margin-bottom:28px">
              <p style="color:#94a3b8;font-size:13px;margin:0 0 16px">
                Ingresa este código en la plataforma para activar tu cuenta:
              </p>
              <div style="margin:0 auto">${codeBlocks}</div>
              <p style="color:#475569;font-size:11px;margin:16px 0 0">
                ⏱ Este código expira en <strong style="color:#e2e8f0">24 horas</strong>.
              </p>
            </div>

            <hr style="border:none;border-top:1px solid #334155;margin:28px 0">

            <!-- Características de la plataforma -->
            <p style="color:#64748b;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin:0 0 14px">
              LO QUE PUEDES HACER EN TECNOSSYNC
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">
              ${[
                ['💬', 'Gestionar conversaciones en WhatsApp, Messenger e Instagram'],
                ['🤖', 'Configurar chatbots con inteligencia artificial'],
                ['📊', 'Ver estadísticas y métricas de tu equipo en tiempo real'],
                ['📄', 'Generar documentos y plantillas automáticamente'],
                ['📅', 'Administrar citas y calendario de seguimiento'],
              ].map(([icon, text]) => `
                <tr>
                  <td style="padding:5px 0;width:28px;vertical-align:top">
                    <span style="font-size:16px">${icon}</span>
                  </td>
                  <td style="padding:5px 0;color:#94a3b8;font-size:13px;line-height:1.5">${text}</td>
                </tr>
              `).join('')}
            </table>

            <hr style="border:none;border-top:1px solid #334155;margin:28px 0">
            <p style="color:#475569;font-size:12px;margin:0;line-height:1.6">
              Si no esperabas esta cuenta o crees que fue un error, ignora este correo o contacta al administrador de tu empresa.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#0f172a;padding:20px 32px;text-align:center;border-top:1px solid #1e293b">
            <p style="color:#334155;font-size:11px;margin:0">
              © ${new Date().getFullYear()} Tecnossync · Plataforma Omnicanal con IA
            </p>
            <p style="color:#334155;font-size:10px;margin:6px 0 0">
              Este correo fue generado automáticamente. Por favor no respondas a este mensaje.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    await transporter.sendMail({
      from:    `"Tecnossync" <${from}>`,
      to:      toEmail,
      subject: `¡Bienvenido/a a Tecnossync, ${userName}! — Verifica tu cuenta`,
      html,
    });
    logger.info(`📧 Email de bienvenida enviado a: ${toEmail}`);
    return true;
  } catch (err) {
    logger.error(`❌ Error enviando email de bienvenida a ${toEmail}:`, err.message);
    _transporter = null;
    return false;
  }
}

module.exports = { sendPasswordReset, sendWelcomeEmail, sendLoginOTP };
