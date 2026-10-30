/* =========================================================
   SmartPark - Firebase Realtime Database
   ESP32  ->  Firebase  ->  Web  (এক সিস্টেমে যুক্ত)

   ESP32 লেখে : slots/A01, slots/B01, history/*, status/vehiclesInside
   Web লেখে   : gate/open  (true = Gate Open, false = Gate Close)
   Web পড়ে   : সব ডাটা (Date, Entry, Exit, Parking Time, Vehicles Inside, IR Sensors)
   ========================================================= */

const P = {
  uplus: '<path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>',
  dollar: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18M9 15l2 2 4-4"/>',
  car: '<path d="M5 17h14M3 13l2-6h14l2 6v4H3z"/><circle cx="7.5" cy="17" r="1.5"/><circle cx="16.5" cy="17" r="1.5"/>',
  bus: '<rect x="3" y="4" width="18" height="13" rx="3"/><path d="M3 11h18M7 4v7M12 4v7M17 4v7"/><circle cx="7.5" cy="19" r="1.5"/><circle cx="16.5" cy="19" r="1.5"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  pulse: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
  chip: '<rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v4M15 1v4M9 19v4M15 19v4M1 9h4M1 15h4M19 9h4M19 15h4"/>',
  hist: '<path d="M3 12a9 9 0 109-9 9.7 9.7 0 00-6.7 2.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  gear: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  sun: '<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>',
  bell: '<path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  taka: '<path d="M9 3v13a3 3 0 006 0v-1M6 9h8"/>',
  card: '<rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20M6 15h4"/>',
  barrier: '<path d="M3 19V7M3 12h18"/><path d="M8 12v7M13 12v7"/>',
  disp: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  radar: '<circle cx="12" cy="12" r="2"/><path d="M7.8 7.8a6 6 0 000 8.4M16.2 7.8a6 6 0 010 8.4M4.9 4.9a10 10 0 000 14.2M19.1 4.9a10 10 0 010 14.2"/>',
  park: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 17V7h4a3 3 0 010 6H9"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>'
};

const ic = name =>
  `<svg class="i" viewBox="0 0 24 24">${P[name] || ''}</svg>`;

const $ = id => document.getElementById(id);

document.querySelectorAll('[data-i]').forEach(element => {
  element.insertAdjacentHTML('afterbegin', ic(element.dataset.i));
});

/* Firebase configuration
   databaseURL আপনার Firebase Console > Realtime Database পেজের উপরে যে URL আছে সেটি দিন।
   (Singapore/Europe region হলে URL আলাদা হয়, তাই এটি অবশ্যই মিলিয়ে নিন) */

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCL6toMcdmzi6ddsz_pcaUXPR05BuDuobA",
    authDomain: "smart-vehicle-access-system.firebaseapp.com",
    databaseURL: "https://smart-vehicle-access-system-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "smart-vehicle-access-system",
    storageBucket: "smart-vehicle-access-system.firebasestorage.app",
    messagingSenderId: "182293461341",
    appId: "1:182293461341:web:854d4fd04e47fb823ad0b4",
    measurementId: "G-Z9HQF8Z637"
};

/* Only these two slots have physical IR sensors */

const SENSOR_SLOTS = ['A01', 'A02', 'A03', 'A04', 'B01', 'B02', 'B03', 'B04'];

const ZONES = [
  { key: 'A', name: 'Car Parking', icon: 'car', color: '#3b82f6', type: 'car' },
  { key: 'B', name: 'Bus Parking', icon: 'bus', color: '#f97316', type: 'bus' }
];

const slotState = {};
SENSOR_SLOTS.forEach(id => {
  slotState[id] = { occupied: false, monitored: true };
});

let db = null;
let gateOpen = false;          // Firebase: gate/open  (true / false)
let currentView = 'dash';
let historyRows = {};
let fbVehiclesInside = null;   // Firebase: status/vehiclesInside (ESP32 লেখে)
const previousOccupied = {};
SENSOR_SLOTS.forEach(id => { previousOccupied[id] = null; });
let toastTimer = null;

/* Utility functions */

const esc = value =>
  String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);

function durationText(seconds) {
  seconds = Math.max(0, Number(seconds) || 0);

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours) return `${hours}h ${minutes}m ${remainingSeconds}s`;
  if (minutes) return `${minutes}m ${remainingSeconds}s`;

  return `${remainingSeconds}s`;
}

function slotName(id) {
  return id.startsWith('A') ? 'Car' : 'Bus';
}

/* ESP32 epoch সেকেন্ডে লেখে (entryEpoch / exitEpoch) */
const entrySec = row =>
  Number(row.entryEpoch) || Math.floor((Number(row.entryTimestamp) || 0) / 1000);

function parkSeconds(row) {
  if (row.durationSeconds != null && row.durationSeconds !== '') {
    return Number(row.durationSeconds);
  }

  const start = entrySec(row);

  if (start && !row.exitTime) {
    return Math.floor(Date.now() / 1000) - start;
  }

  return null;
}

function toast(message) {
  const element = $('toast');

  if (!element) return;

  element.textContent = message;
  element.classList.add('show');

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    element.classList.remove('show');
  }, 3200);
}

function setFirebaseStatus(online, message) {
  const card = $('fbCard');

  if (!card) return;

  card.dataset.s = online ? 'on' : 'off';

  if ($('ldot')) {
    $('ldot').className = 'dot' + (online ? ' p' : '');
  }

  if ($('ltxt')) {
    $('ltxt').textContent =
      message || (online ? 'Firebase Live' : 'Disconnected');
  }

  card.title = online ? 'Firebase connected' : 'Firebase disconnected';
}

/* Vehicle illustrations */

function vehicleSvg(id, color) {
  if (id.startsWith('B')) {
    return `
      <svg class="cv bus" viewBox="0 0 46 80" aria-hidden="true">
        <rect x="5" y="2" width="36" height="76" rx="8" fill="${color}"/>
        <rect x="10" y="8" width="26" height="13" rx="3"
              fill="#fff" fill-opacity=".8"/>
        <g fill="#fff" fill-opacity=".4">
          <rect x="10" y="27" width="26" height="13" rx="2"/>
          <rect x="10" y="45" width="26" height="13" rx="2"/>
        </g>
        <rect x="14" y="64" width="18" height="8" rx="2"
              fill="#000" fill-opacity=".2"/>
      </svg>`;
  }

  return `
    <svg class="cv" viewBox="0 0 40 66" aria-hidden="true">
      <rect x="6" y="2" width="28" height="62" rx="11" fill="${color}"/>
      <path d="M11 18q9-5 18 0l-2 12H13z"
            fill="#fff" fill-opacity=".8"/>
      <rect x="12" y="48" width="16" height="8" rx="2"
            fill="#000" fill-opacity=".2"/>
    </svg>`;
}

/* Render parking zones and all eight slots */

function renderZones() {
  const zonesElement = $('zones');

  if (!zonesElement) return;

  zonesElement.innerHTML = ZONES.map(zone => {
    const ids = [1, 2, 3, 4].map(number =>
      zone.key + String(number).padStart(2, '0')
    );

    const activeOccupied = ids.filter(id => slotState[id].occupied).length;

    const slots = ids.map(id => {
      const state = slotState[id];
      const active = state.monitored;
      const occupied = active && state.occupied;

      const className = occupied ? 'o' : active ? 'a' : 'u';

      const label = !active
        ? 'No sensor'
        : occupied
          ? 'Occupied'
          : 'Available';

      let elapsed = '';

      if (occupied && state.entryTimestamp) {
        elapsed = `
          <span class="cap"
                data-timer="${id}"
                data-entry="${state.entryTimestamp}">
            Parked ${durationText(
              Math.floor((Date.now() - state.entryTimestamp) / 1000)
            )}
          </span>`;
      }

      return `
        <div class="bay s-${className}"
             data-slot="${id}"
             title="${id}: ${label}">
          <small>${id}</small>
          ${elapsed}
          ${vehicleSvg(
            id,
            !active ? '#94a3b8' : occupied ? '#ef4444' : '#22c55e'
          )}
          <span class="slot-state">${label}</span>
        </div>`;
    }).join('');

    return `
      <div class="zone">
        <div class="zh">
          <div class="ic" style="background:${zone.color}">
            ${ic(zone.icon)}
          </div>

          <div>
            <b>Zone ${zone.key}</b>
            <span>${zone.name} · 4 sensors active</span>
          </div>

          <div class="cnt">
            ${activeOccupied}/4
            <small>SENSOR OCCUPIED</small>
          </div>
        </div>

        <div class="bar">
          <i style="width:${activeOccupied * 25}%;background:${zone.color}"></i>
        </div>

        <div class="lot">
          <div class="bays all-slots">${slots}</div>
        </div>
      </div>`;
  }).join('');
}

/* Dashboard statistics */

function renderStats() {
  const statsElement = $('stats');

  if (!statsElement) return;

  const sensorOccupied = SENSOR_SLOTS.filter(
    id => slotState[id].occupied
  ).length;

  // Vehicles Inside: Firebase (status/vehiclesInside) থেকে, না থাকলে sensor থেকে গণনা
  const inside =
    typeof fbVehiclesInside === 'number'
      ? fbVehiclesInside
      : sensorOccupied;

  const free = Math.max(0, SENSOR_SLOTS.length - inside);

  const activeSessions = Object.values(historyRows).filter(
    row => row && row.slotId && !row.exitTime
  ).length;

  const cards = [
    ['Vehicles Inside', inside, 'From all 8 ESP32 IR sensors', '#3b82f6', 'car'],
    ['Sensor Slots Available', free, 'Only installed sensors counted', '#22c55e', 'park'],
    ['Active Parking Sessions', activeSessions, 'Current history records', '#8b5cf6', 'clock']
  ];

  statsElement.innerHTML = cards.map(
    ([label, value, description, color, icon]) => `
      <div class="card stat">
        <div class="ic" style="background:${color}">
          ${ic(icon)}
        </div>

        <div>
          <small>${label}</small>
          <h2>${value}</h2>
          <p>${description}</p>
        </div>
      </div>`
  ).join('');
}

/* Gate UI  (Firebase: gate/open = true / false) */

function renderGate() {
  if ($('gateCard')) {
    $('gateCard').dataset.s = gateOpen ? 'open' : 'closed';
  }

  if ($('gate')) {
    $('gate').textContent = gateOpen ? 'Open' : 'Closed';
  }

  if ($('gateSub')) {
    $('gateSub').textContent = gateOpen
      ? 'Firebase gate/open = true'
      : 'Firebase gate/open = false';
  }

  if ($('openGate')) {
    $('openGate').disabled = gateOpen;
    $('openGate').textContent = gateOpen ? 'Gate is Open' : 'Open Gate';
  }

  if ($('closeGate')) {
    $('closeGate').disabled = !gateOpen;
    $('closeGate').textContent = gateOpen ? 'Close Gate' : 'Gate is Closed';
  }
}

/* Vehicle history table */

function renderHistory() {
  const historyTable = $('tb');
  const activityTable = $('va');

  if (!historyTable || !activityTable) return;

  const all = Object.entries(historyRows)
    .map(([key, row]) => ({ key, ...row }))
    .filter(row => row && row.slotId);

  all.sort((a, b) => entrySec(b) - entrySec(a));

  const from = $('hf')?.value || '';
  const to = $('ht')?.value || '';

  const filtered = all.filter(row =>
    (!from || (row.entryDate || '') >= from) &&
    (!to || (row.entryDate || '') <= to)
  );

  historyTable.innerHTML = filtered.length
    ? filtered.map(row => {
        const seconds = parkSeconds(row);

        return `
        <tr>
          <td>${esc(row.entryDate || '—')}</td>
          <td>${esc(row.vehicleNo || 'Unknown')}</td>
          <td>${esc(row.slotId)} · ${esc(slotName(row.slotId))}</td>
          <td>${esc(row.entryTime || '—')}</td>
          <td>${esc(row.exitTime || 'Inside')}</td>
          <td>${seconds == null ? '—' : durationText(seconds)}</td>
        </tr>`;
      }).join('')
    : `
      <tr>
        <td colspan="6"
            style="text-align:center;padding:22px;color:var(--mut)">
          No history records for this date range.
        </td>
      </tr>`;

  activityTable.innerHTML = all.slice(0, 8).map(row => {
    const seconds = parkSeconds(row);

    return `
      <tr>
        <td>${esc(row.entryDate || '—')}</td>
        <td>${esc(row.entryTime || '—')}</td>
        <td>${esc(row.exitTime || 'Inside')}</td>
        <td>${seconds == null ? '—' : durationText(seconds)}</td>
      </tr>`;
  }).join('') || `
    <tr>
      <td colspan="4"
          style="text-align:center;padding:18px;color:var(--mut)">
        No vehicle activity yet.
      </td>
    </tr>`;

  if ($('hsum')) {
    $('hsum').textContent =
      `${filtered.length} record(s) · ` +
      `${filtered.filter(row => !row.exitTime).length} vehicle(s) currently inside`;
  }
}

function refresh() {
  renderZones();
  renderStats();
  renderGate();
  renderHistory();
}

/* Gate command -> Firebase  (Open = true, Close = false) */

async function setGate(open) {
  if (!db) {
    toast('Firebase is not connected. Check configuration and rules.');
    return;
  }

  try {
    await db.ref('gate/open').set(open === true);

    gateOpen = open === true;
    renderGate();

    toast(open ? 'Gate Open: true sent to Firebase.' : 'Gate Close: false sent to Firebase.');
  } catch (error) {
    console.error('Gate command failed:', error);
    toast('Could not send command. Check Firebase Rules and connection.');
  }
}

if ($('openGate')) {
  $('openGate').addEventListener('click', () => setGate(true));
}

if ($('closeGate')) {
  $('closeGate').addEventListener('click', () => setGate(false));
}

/* Sensor data (ESP32 -> Firebase -> Web). Web শুধু পড়ে, কিছু লেখে না। */

function onSensorUpdate(id, data) {
  data = data || {};

  const occupied = data.occupied === true;
  const previous = previousOccupied[id];

  slotState[id].occupied = occupied;
  slotState[id].entryTimestamp =
    occupied && Number(data.entryEpoch)
      ? Number(data.entryEpoch) * 1000
      : null;

  if (previous !== null && previous !== occupied) {
    toast(`${id}: vehicle ${occupied ? 'entered' : 'exited'}.`);
  }

  previousOccupied[id] = occupied;

  refresh();
}

/* Firebase listeners */

function bindFirebase() {
  if (!firebase.apps.length) {
    firebase.initializeApp(FIREBASE_CONFIG);
  }

  db = firebase.database();

  db.ref('.info/connected').on('value', snapshot => {
    setFirebaseStatus(snapshot.val() === true);
  });

  // IR sensor slots (A01, B01)
  SENSOR_SLOTS.forEach(id => {
    db.ref(`slots/${id}`).on(
      'value',
      snapshot => onSensorUpdate(id, snapshot.val()),
      error => {
        console.error(`Could not read ${id}`, error);
        toast(`Cannot read ${id}. Check Firebase Rules.`);
      }
    );
  });

  // Vehicles Inside
  db.ref('status/vehiclesInside').on('value', snapshot => {
    const value = snapshot.val();

    fbVehiclesInside = typeof value === 'number' ? value : null;
    renderStats();
  });

  // Gate: true / false
  db.ref('gate/open').on('value', snapshot => {
    gateOpen = snapshot.val() === true;
    renderGate();
  });

  // Vehicle history (Date, Entry, Exit, Parking Time)
  db.ref('history').limitToLast(300).on(
    'value',
    snapshot => {
      historyRows = snapshot.val() || {};
      refresh();
    },
    error => {
      console.error('History listener error:', error);
    }
  );
}

/* Navigation (৯ ডটের মেনু) */

function show(view) {
  currentView = view;

  document.querySelectorAll('[data-v]').forEach(element => {
    element.classList.toggle('on', element.dataset.v === view);
  });

  document.querySelectorAll('[data-view]').forEach(element => {
    const allowed = (element.dataset.view || '').split(/\s+/);

    element.hidden = !allowed.includes(view);
  });

  if ($('pgT')) {
    $('pgT').textContent =
      view === 'hist'
        ? 'Vehicle History'
        : view === 'live'
          ? 'Live Monitoring'
          : 'Dashboard';
  }

  $('drawer')?.classList.remove('open');
  $('ov')?.classList.remove('show');
  $('menu')?.classList.remove('on');
}

document.querySelectorAll('[data-v]').forEach(element => {
  element.addEventListener('click', event => {
    event.preventDefault();
    show(element.dataset.v);
  });
});

if ($('slotsAll')) {
  $('slotsAll').addEventListener('click', () => show('live'));
}

if ($('hf')) {
  $('hf').addEventListener('change', renderHistory);
}

if ($('ht')) {
  $('ht').addEventListener('change', renderHistory);
}

if ($('menu')) {
  $('menu').addEventListener('click', () => {
    $('drawer')?.classList.toggle('open');
    $('ov')?.classList.toggle('show');
    $('menu').classList.toggle('on');
  });
}

if ($('ov')) {
  $('ov').addEventListener('click', () => {
    $('drawer')?.classList.remove('open');
    $('ov')?.classList.remove('show');
    $('menu')?.classList.remove('on');
  });
}

if ($('theme')) {
  $('theme').addEventListener('click', () => {
    const root = document.documentElement;

    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
  });
}

if ($('me')) {
  $('me').addEventListener('click', event => {
    if (event.target.closest('button')) return;

    if ($('dd')) {
      $('dd').hidden = !$('dd').hidden;
    }
  });
}

document.querySelectorAll('[data-a="theme"]').forEach(button => {
  button.addEventListener('click', () => {
    $('theme')?.click();
  });
});

document.querySelectorAll('[data-a="out"]').forEach(button => {
  button.addEventListener('click', () => {
    toast('Sign-out is not configured for this dashboard.');
  });
});

/* Parking timers (শুধু ব্রাউজারে আপডেট হয়, Firebase এ কিছু লেখে না) */

setInterval(() => {
  document.querySelectorAll('[data-timer]').forEach(element => {
    const start = Number(element.dataset.entry);

    if (start) {
      element.textContent =
        `Parked ${durationText(Math.floor((Date.now() - start) / 1000))}`;
    }
  });

  renderHistory();
}, 1000);

/* Initial UI state */

renderZones();
renderStats();
renderGate();
renderHistory();

/* গুরুত্বপূর্ণ: শুরুতে শুধু Dashboard দেখাবে।
   Vehicle History শুধু মেনু (৯ ডট) থেকে ক্লিক করলে দেখা যাবে। */
show('dash');

/* Load Firebase SDK and connect */

const loadScript = src => new Promise((resolve, reject) => {
  const script = document.createElement('script');

  script.src = src;
  script.onload = resolve;
  script.onerror = reject;

  document.head.appendChild(script);
});

loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js')
  .then(() =>
    loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js')
  )
  .then(() => {
    if (!firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }

    bindFirebase();
  })
  .catch(error => {
    console.error('Firebase connection failed:', error);

    setFirebaseStatus(false, 'SDK error');

    toast('Firebase could not connect. Check SDK, databaseURL and Rules.');
  });
