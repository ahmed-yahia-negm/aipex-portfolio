import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, push, onValue, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";

try {
  if (/^YOUR_/.test(firebaseConfig.apiKey)) throw new Error('placeholder config');
  const app = initializeApp(firebaseConfig);

  try { getAnalytics(app); } catch {}

  const db = getDatabase(app);

  let sessionId = localStorage.getItem('aipex-visitor-id');
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem('aipex-visitor-id', sessionId);
  }

  push(ref(db, 'analytics'), {
    sessionId,
    path: location.pathname,
    referrer: document.referrer || '',
    timestamp: serverTimestamp()
  }).catch(() => {});

  window.logProjectView = function (title, category) {
    if (!title) return;
    push(ref(db, 'projectViews'), {
      title,
      category: category || '',
      timestamp: serverTimestamp()
    }).catch(() => {});
  };

  function whenReady(name, arg) {
    let attempts = 0;
    (function tryCall() {
      if (typeof window[name] === 'function') {
        window[name](arg);
      } else if (attempts++ < 40) {
        setTimeout(tryCall, 100);
      }
    })();
  }

  const extra = { websites: [], ugc: [] };
  const pushExtra = () => whenReady('mergeExtraProjects', { websites: extra.websites, ugc: extra.ugc });

  onValue(ref(db, 'content/websites'), (snap) => {
    extra.websites = Object.values(snap.val() || {});
    pushExtra();
  }, () => {});

  onValue(ref(db, 'content/ugc'), (snap) => {
    extra.ugc = Object.values(snap.val() || {});
    pushExtra();
  }, () => {});

  onValue(ref(db, 'content/testimonials'), (snap) => {
    whenReady('mergeTestimonials', Object.values(snap.val() || {}));
  }, () => {});

  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.dataset.connected = 'true';
    const formRenderedAt = Date.now();
    const COOLDOWN_MS = 30000;
    const LAST_SENT_KEY = 'aipex-cf-last-sent';

    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const status = document.getElementById('cfStatus');
      const submitBtn = contactForm.querySelector('[data-send]') || { disabled: false };
      const sent = () => contactForm.dispatchEvent(new CustomEvent('aipex:sent'));
      const data = new FormData(contactForm);
      const name = data.get('name').trim();
      const email = data.get('email').trim();
      const message = data.get('message').trim();
      const type = data.get('type');
      const honeypot = (data.get('website') || '').trim();

      if (!name || !email || !message) return;

      if (honeypot) {
        status.className = 'cf-status ok';
        status.textContent = "Thanks, I'll get back to you soon.";
        contactForm.reset();
        sent();
        return;
      }

      if (Date.now() - formRenderedAt < 1500) {
        status.className = 'cf-status err';
        status.textContent = 'Please try sending again.';
        return;
      }

      const lastSent = Number(localStorage.getItem(LAST_SENT_KEY) || 0);
      if (Date.now() - lastSent < COOLDOWN_MS) {
        status.className = 'cf-status err';
        status.textContent = "You're sending messages too quickly. Please wait a moment and try again.";
        return;
      }

      submitBtn.disabled = true;
      status.className = 'cf-status';
      status.textContent = 'Sending...';

      push(ref(db, 'messages'), {
        name, email, message, type,
        timestamp: serverTimestamp()
      }).then(() => {
        localStorage.setItem(LAST_SENT_KEY, String(Date.now()));
        status.className = 'cf-status ok';
        status.textContent = "Thanks, I'll get back to you soon.";
        contactForm.reset();
        sent();
      }).catch(() => {
        status.className = 'cf-status err';
        status.textContent = 'Something went wrong. Please try again or email me directly.';
      }).finally(() => {
        submitBtn.disabled = false;
      });
    });
  }
} catch (error) {
  if (/^YOUR_/.test(firebaseConfig.apiKey)) console.info('Firebase is not configured yet: add your project settings to firebase-config.js to enable the analytics, the admin content and the contact form.');
}
