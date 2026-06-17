// frontend/src/services/notificationService.js
let audioCtx      = null;
let unreadCount   = 0;
let blinkInterval = null;
const originalTitle = document.title;

export const requestPermission = async () => {
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission();
  }
};

const playSound = () => {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    osc.frequency.setValueAtTime(660, audioCtx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.3);
  } catch (_) {}
};

export const setBadge = (count) => {
  unreadCount = count;
  clearInterval(blinkInterval);
  if (count > 0) {
    document.title = `(${count}) ${originalTitle}`;
    blinkInterval = setInterval(() => {
      document.title = document.title.startsWith('(')
        ? originalTitle
        : `(${count}) ${originalTitle}`;
    }, 1500);
  } else {
    document.title = originalTitle;
  }
};

const showPush = (title, body) => {
  if (Notification.permission === 'granted') {
    const n = new Notification(title, { body, icon: '/logo.png', silent: true });
    setTimeout(() => n.close(), 5000);
  }
};

export const notifyNewMessage = ({ sessionId, from, body, pushName }) => {
  const name = pushName || from?.replace('@s.whatsapp.net', '');
  playSound();
  showPush(
    'WhatsApp - ' + sessionId,
    (name ? name + ': ' : '') + (body?.slice(0, 60) || '')
  );
  setBadge(unreadCount + 1);
};

export const clearBadge = () => setBadge(0);