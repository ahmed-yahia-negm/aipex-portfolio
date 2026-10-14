import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
  setPersistence, browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getDatabase, ref, push, onValue, remove, serverTimestamp, query, orderByChild
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const ADMIN_UID = "REPLACE_WITH_YOUR_ADMIN_UID";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const $ = (s) => document.querySelector(s);

/* the site never shows dashes, so older entries that contain one are displayed with a comma instead */
const DASH_RE = new RegExp(" *[" + String.fromCharCode(0x2014, 0x2013) + "] *", "g");
const tidy = (s, sep = ", ") => String(s == null ? "" : s).replace(DASH_RE, sep);

setPersistence(auth, browserLocalPersistence).catch(() => {});

const authLoading = $("#authLoading");
const gate = $("#gate-screen");
const dashboard = $("#dashboard");
const userbox = $("#userbox");
const appHeader = $("#appHeader");
const favicon = $("#favicon");
const DEFAULT_FAVICON = "assets/brand/favicon-32.png?v=20261013e";

function initialsAvatarUrl(name) {
  const initials = (name || "A").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56"><rect width="56" height="56" rx="28" fill="#0958c9"/><text x="50%" y="53%" text-anchor="middle" dominant-baseline="middle" font-family="Manrope,Arial,sans-serif" font-size="22" font-weight="700" fill="#fff">${initials}</text></svg>`;
  return "data:image/svg+xml," + encodeURIComponent(svg);
}
const notifBell = $("#notifBell");
const notifBadge = $("#notifBadge");
const baseTitle = document.title;
const LAST_SEEN_KEY = "aipex-admin-messages-seen-ts";

if (localStorage.getItem(LAST_SEEN_KEY) === null) {
  localStorage.setItem(LAST_SEEN_KEY, String(Date.now()));
}

function getLastSeen() {
  return Number(localStorage.getItem(LAST_SEEN_KEY) || 0);
}

function updateNotifUI(unreadCount) {
  if (unreadCount > 0) {
    notifBadge.textContent = unreadCount > 99 ? "99+" : String(unreadCount);
    notifBadge.hidden = false;
    document.title = `(${unreadCount}) ${baseTitle}`;
  } else {
    notifBadge.hidden = true;
    notifBell.classList.remove("has-new");
    document.title = baseTitle;
  }
}

function markMessagesSeen() {
  localStorage.setItem(LAST_SEEN_KEY, String(Date.now()));
  updateNotifUI(0);
}

notifBell.onclick = () => {
  $("#messagesList").scrollIntoView({ behavior: "smooth", block: "center" });
  markMessagesSeen();
};

addEventListener("focus", () => {
  if (!dashboard.hidden) markMessagesSeen();
});

if (typeof Notification !== "undefined" && Notification.permission === "default") {
  Notification.requestPermission().catch(() => {});
}

let knownMessageIds = null;

$("#signInBtn").onclick = () => {
  $("#gateStatus").textContent = "";
  signInWithPopup(auth, new GoogleAuthProvider()).catch((e) => {
    $("#gateStatus").textContent = e.message;
    $("#gateStatus").className = "status err";
  });
};

$("#signOutBtn").onclick = () => signOut(auth);

onAuthStateChanged(auth, (user) => {
  authLoading.hidden = true;

  if (!user) {
    gate.hidden = false;
    dashboard.hidden = true;
    userbox.hidden = true;
    appHeader.hidden = true;
    if (favicon) favicon.href = DEFAULT_FAVICON;
    return;
  }

  if (user.uid !== ADMIN_UID) {
    gate.hidden = false;
    dashboard.hidden = true;
    userbox.hidden = true;
    appHeader.hidden = true;
    $("#gateStatus").className = "status err";
    $("#gateStatus").textContent =
      `Signed in as ${user.email}, but this account isn't authorized as admin yet. Your UID is: ${user.uid}`;
    if (favicon) favicon.href = DEFAULT_FAVICON;
    return;
  }

  gate.hidden = true;
  dashboard.hidden = false;
  userbox.hidden = false;
  appHeader.hidden = false;

  const photo = $("#userPhoto");
  photo.onerror = () => {
    photo.onerror = null;
    photo.src = initialsAvatarUrl(user.displayName || user.email);
  };
  photo.src = user.photoURL || initialsAvatarUrl(user.displayName || user.email);
  $("#userName").textContent = user.displayName || user.email;

  if (favicon && user.photoURL) {
    favicon.onerror = () => {
      favicon.onerror = null;
      favicon.href = DEFAULT_FAVICON;
    };
    favicon.href = user.photoURL;
  }

  startDashboard();
});

let started = false;
function startDashboard() {
  if (started) return;
  started = true;
  setupForms();
  setupMessages();
  setupTestimonials();
  setupProjectViews();
  setupTraffic();
}

function looksLocal(path) {
  return /^[a-z]:[\\/]/i.test(path) || path.startsWith("file:") || path.startsWith("\\\\");
}

function checkMedia(url, kind) {
  return new Promise((resolve) => {
    const el = kind === "image" ? new Image() : document.createElement("video");
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      el.onload = el.onloadedmetadata = el.onerror = null;
      if (kind !== "image") {
        el.removeAttribute("src");
        el.load();
      }
      resolve(result);
    };
    const timer = setTimeout(() => finish("slow"), 15000);
    if (kind === "image") {
      el.onload = () => finish("ok");
    } else {
      el.preload = "metadata";
      el.muted = true;
      el.onloadedmetadata = () => finish("ok");
    }
    el.onerror = () => finish("bad");
    el.src = url;
  });
}

async function validateMedia(video, poster) {
  if (looksLocal(video) || (poster && looksLocal(poster))) {
    return "That's a path on your computer, and browsers can't load it. Copy the file into the site's assets/portfolio folder, deploy, then use assets/portfolio/<file-name>. Nothing was saved.";
  }
  if ((await checkMedia(video, "video")) === "bad") {
    return "That video couldn't be loaded. Check the spelling (e.g. assets/portfolio/my-video.mp4) and make sure the file has been deployed to the site. Nothing was saved.";
  }
  if (poster && (await checkMedia(poster, "image")) === "bad") {
    return "That poster image couldn't be loaded. Check the path, or leave it empty. Nothing was saved.";
  }
  return null;
}

function setupForms() {
  $("#websiteForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const f = new FormData(form);
    const entry = {
      name: f.get("name").trim(),
      type: f.get("type").trim(),
      video: f.get("video").trim(),
      poster: (f.get("poster") || "").trim(),
      addedAt: serverTimestamp()
    };
    const status = $("#websiteStatus");
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    status.className = "status";
    status.textContent = "Checking the files…";
    const problem = await validateMedia(entry.video, entry.poster);
    if (problem) {
      status.className = "status err";
      status.textContent = problem;
      btn.disabled = false;
      return;
    }
    push(ref(db, "content/websites"), entry)
      .then(() => {
        status.className = "status ok";
        status.textContent = "Added. It's live on the site now.";
        form.reset();
      })
      .catch((err) => {
        status.className = "status err";
        status.textContent = err.message;
      })
      .finally(() => { btn.disabled = false; });
  });

  $("#ugcForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const f = new FormData(form);
    const entry = {
      name: f.get("name").trim(),
      category: f.get("category"),
      video: f.get("video").trim(),
      addedAt: serverTimestamp()
    };
    const status = $("#ugcStatus");
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    status.className = "status";
    status.textContent = "Checking the video…";
    const problem = await validateMedia(entry.video, "");
    if (problem) {
      status.className = "status err";
      status.textContent = problem;
      btn.disabled = false;
      return;
    }
    push(ref(db, "content/ugc"), entry)
      .then(() => {
        status.className = "status ok";
        status.textContent = "Added. It's live in the UGC section now.";
        form.reset();
      })
      .catch((err) => {
        status.className = "status err";
        status.textContent = err.message;
      })
      .finally(() => { btn.disabled = false; });
  });

  $("#testimonialForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const entry = {
      quote: f.get("quote").trim(),
      cite: f.get("cite").trim(),
      addedAt: serverTimestamp()
    };
    const status = $("#testimonialStatus");
    push(ref(db, "content/testimonials"), entry)
      .then(() => {
        status.className = "status ok";
        status.textContent = "Added. It'll rotate into the testimonials on the live site.";
        e.target.reset();
      })
      .catch((err) => {
        status.className = "status err";
        status.textContent = err.message;
      });
  });
}

function setupMessages() {
  const list = $("#messagesList");
  const messagesRef = query(ref(db, "messages"), orderByChild("timestamp"));

  onValue(messagesRef, (snapshot) => {
    const items = [];
    snapshot.forEach((child) => {
      items.push({ id: child.key, ...child.val() });
    });
    items.reverse();

    const lastSeen = getLastSeen();
    const unread = items.filter((m) => (m.timestamp || 0) > lastSeen);
    updateNotifUI(unread.length);

    if (knownMessageIds === null) {
      knownMessageIds = new Set(items.map((m) => m.id));
    } else {
      const freshlyArrived = items.filter((m) => !knownMessageIds.has(m.id));
      if (freshlyArrived.length) {
        notifBell.classList.add("has-new");
        if (!document.hasFocus() && typeof Notification !== "undefined" && Notification.permission === "granted") {
          freshlyArrived.forEach((m) => {
            try {
              new Notification("New message · AIPEX Admin", {
                body: `${m.name || "Someone"}: ${(m.message || "").slice(0, 120)}`
              });
            } catch {}
          });
        }
      }
      knownMessageIds = new Set(items.map((m) => m.id));
    }

    if (!items.length) {
      list.innerHTML = '<p class="empty">No messages yet.</p>';
      return;
    }

    list.innerHTML = "";
    items.forEach((m) => {
      const el = document.createElement("div");
      el.className = "msg";
      const date = m.timestamp ? new Date(m.timestamp).toLocaleString() : "";
      el.innerHTML = `
        <div class="msg-top">
          <div><b>${escapeHtml(m.name || "Unknown")}</b> · ${escapeHtml(m.email || "")} ${m.type ? `<span class="tag">${escapeHtml(m.type)}</span>` : ""}</div>
          <span>${date}</span>
        </div>
        <div class="msg-body">${escapeHtml(m.message || "")}</div>
      `;
      const delBtn = document.createElement("button");
      delBtn.className = "btn";
      delBtn.textContent = "Delete";
      delBtn.onclick = () => remove(ref(db, `messages/${m.id}`));
      el.appendChild(delBtn);
      list.appendChild(el);
    });
  });
}

function setupTestimonials() {
  const list = $("#testimonialsList");
  const testimonialsRef = query(ref(db, "content/testimonials"), orderByChild("addedAt"));

  onValue(testimonialsRef, (snapshot) => {
    const items = [];
    snapshot.forEach((child) => {
      items.push({ id: child.key, ...child.val() });
    });
    items.reverse();

    if (!items.length) {
      list.innerHTML = '<p class="empty">No reviews yet. Add one above.</p>';
      return;
    }

    list.innerHTML = "";
    items.forEach((t) => {
      const el = document.createElement("div");
      el.className = "msg";
      const quoteEl = document.createElement("div");
      quoteEl.className = "msg-body";
      quoteEl.textContent = `“${t.quote || ""}”`;
      const citeEl = document.createElement("div");
      citeEl.className = "msg-top";
      citeEl.innerHTML = `<span>${escapeHtml(tidy(t.cite))}</span>`;
      const delBtn = document.createElement("button");
      delBtn.className = "btn";
      delBtn.textContent = "Delete";
      delBtn.onclick = () => remove(ref(db, `content/testimonials/${t.id}`));
      el.append(quoteEl, citeEl, delBtn);
      list.appendChild(el);
    });
  });
}

function setupProjectViews() {
  const list = $("#projectViewsList");

  onValue(ref(db, "projectViews"), (snapshot) => {
    const counts = {};
    snapshot.forEach((child) => {
      const v = child.val();
      const key = v.title || "Untitled";
      counts[key] = (counts[key] || 0) + 1;
    });

    const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);

    if (!ranked.length) {
      list.innerHTML = '<p class="empty">No project opens tracked yet.</p>';
      return;
    }

    list.innerHTML = "";
    ranked.forEach(([title, count], i) => {
      const el = document.createElement("div");
      el.className = "msg";
      el.innerHTML = `
        <div class="msg-top">
          <div><b>${i + 1}. ${escapeHtml(tidy(title, ": "))}</b></div>
          <span>${count} open${count === 1 ? "" : "s"}</span>
        </div>
      `;
      list.appendChild(el);
    });
  });
}

function setupTraffic() {
  onValue(ref(db, "analytics"), (snapshot) => {
    let total = 0;
    let today = 0;
    const sessions = new Set();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayMs = startOfToday.getTime();

    snapshot.forEach((child) => {
      const v = child.val();
      total++;
      if (v.sessionId) sessions.add(v.sessionId);
      if (v.timestamp && v.timestamp >= todayMs) today++;
    });

    $("#statTotal").textContent = total;
    $("#statUnique").textContent = sessions.size;
    $("#statToday").textContent = today;
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
