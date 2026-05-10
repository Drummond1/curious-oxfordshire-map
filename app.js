// ============================================================
// app.js — Curious Oxfordshire Map
// ============================================================

// -- Mobile detection ----------------------------------------

function isMobile() {
  return window.matchMedia('(max-width: 767px)').matches;
}


// -- Map setup -----------------------------------------------

const MAP_CENTRE = [51.72, -1.45];
const MAP_ZOOM   = 11;

const map = L.map('map').setView(MAP_CENTRE, MAP_ZOOM);

L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
  attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
  subdomains: 'abcd',
  maxZoom: 20
}).addTo(map);


// -- Custom marker icon --------------------------------------

const CATEGORY_COLOURS = {
  'strange-or-historic': '#a05030',
  'nature':              '#4a7c59',
  'rainy-day':           '#4a70a0',
  'events':              '#8b5ea6',
  'hidden-places':       '#c07030',
  'food-or-treats':      '#c05060',
  'adventures':          '#2a7a6a',
  'default':             '#7a6050'
};

function makeIcon(category, isFamilyFriendly) {
  const colour = CATEGORY_COLOURS[category] || CATEGORY_COLOURS['default'];
  const size   = isMobile() ? 26 : 18;
  const half   = size / 2;

  const innerStyle = isFamilyFriendly
    ? `background:#fff; border:2px solid ${colour}; box-shadow: 0 0 0 3px ${colour}, 0 2px 6px rgba(0,0,0,0.28);`
    : `background:${colour}; border:2px solid rgba(255,255,255,0.9); box-shadow: 0 2px 6px rgba(0,0,0,0.3);`;

  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;${innerStyle}"></div>`,
    iconSize:    [size, size],
    iconAnchor:  [half, half],
    popupAnchor: [0, -(half + 5)]
  });
}


// -- Popup HTML ----------------------------------------------

function formatDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function buildPopup(place) {
  const dateLine = place.date
    ? `<div class="popup-date">📅 ${formatDate(place.date)}</div>`
    : '';

  const weatherClass = place.weather === 'indoor' ? 'weather-indoor' : 'weather-outdoor';
  const weatherLabel = place.weather === 'indoor' ? '🏠 Indoor' : '🌿 Outdoor';

  const tagPills = (place.tags || [])
    .filter(t => t !== 'adventures')
    .map(t => `<span class="popup-tag">${tagLabel(t)}</span>`)
    .join('');

  const familyLine = place.familyFriendly
    ? `<div class="popup-family">👨‍👩‍👧 Great with children</div>`
    : '';

  const verifiedNote = place.verified
    ? '✅ Verified listing'
    : '📝 Sample / editable entry — please check details before visiting';

  const mapsUrl = `https://maps.google.com/?q=${place.lat},${place.lng}`;
  const directionsHtml = `<a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" class="popup-directions">📍 Get directions</a>`;

  const isAdventure = place.category === 'adventures';
  const catColour   = CATEGORY_COLOURS[place.category] || CATEGORY_COLOURS['default'];

  const photoHtml = place.photo
    ? `<img src="${place.photo}" alt="${place.name}" class="popup-photo" onerror="this.style.display='none'">`
    : '';

  return `
    ${photoHtml}
    <div class="popup-content${isAdventure ? ' popup-adventure' : ''}">
      ${isAdventure ? '<div class="popup-adventure-badge">✦ Day Adventure</div>' : ''}
      <h3>${place.name}</h3>
      <div class="popup-type" style="background:${catColour}18; color:${catColour};">${place.type}</div>
      ${dateLine}
      ${familyLine}
      <div class="popup-description">${place.description}</div>
      <div class="popup-curious">✨ Why curious: ${place.whyCurious}</div>
      <div class="popup-grid">
        <div class="popup-grid-cell">
          <div class="popup-grid-label">💰 Cost</div>
          <div class="popup-grid-value">${place.cost}</div>
        </div>
        <div class="popup-grid-cell">
          <div class="popup-grid-label">⭐ Best for</div>
          <div class="popup-grid-value">${place.bestFor}</div>
        </div>
      </div>
      <div class="popup-tags">
        <span class="popup-tag ${weatherClass}">${weatherLabel}</span>
        ${tagPills}
      </div>
      <div class="popup-verified">${verifiedNote}</div>
      ${directionsHtml}
    </div>
  `;
}

function tagLabel(tag) {
  const labels = {
    'hidden-places':      '🔍 Hidden Place',
    'events':             '🎉 Event',
    'nature':             '🌿 Nature',
    'rainy-day':          '☔ Rainy Day',
    'food-or-treats':     '🍎 Food or Treats',
    'strange-or-historic':'🏛 Strange or Historic',
    'free-or-cheap':      '💚 Free or Cheap'
  };
  return labels[tag] || tag;
}


// -- Build markers -------------------------------------------

const markerById = {};

places.forEach(place => {
  const marker = L.marker([place.lat, place.lng], {
    icon: makeIcon(place.category, place.familyFriendly)
  }).addTo(map);

  marker.on('click', () => {
    map.setView([place.lat, place.lng], 14, { animate: true });
    if (isMobile()) {
      showDetail(place);
    } else {
      showDesktopDetail(place);
    }
  });

  marker.placeData = place;
  markerById[place.id] = marker;
});


// Scale a marker's inner dot up/down (desktop hover from list)
function setMarkerHover(id, on) {
  const marker = markerById[id];
  if (!marker) return;
  const inner = marker.getElement()?.querySelector('div');
  if (inner) inner.style.transform = on ? 'scale(1.6)' : '';
}

// Desktop: show place detail inside the sidebar (keeps map fully visible)
function showDesktopDetail(place) {
  detailPanel.innerHTML = buildPopup(place);
  document.body.classList.add('desktop-detail');
  document.querySelectorAll('.place-item').forEach(el => el.classList.remove('highlighted'));
  const li = placeList.querySelector(`[data-id="${place.id}"]`);
  if (li) {
    li.classList.add('highlighted');
    li.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

function closeDesktopDetail() {
  document.body.classList.remove('desktop-detail');
  detailPanel.innerHTML = '';
  document.querySelectorAll('.place-item').forEach(el => el.classList.remove('highlighted'));
}


// -- Sidebar list --------------------------------------------

const placeList  = document.getElementById('place-list');
const placeCount = document.getElementById('place-count');

function buildListItem(place) {
  const li = document.createElement('li');
  li.className = 'place-item';
  li.dataset.id = place.id;

  const colour       = CATEGORY_COLOURS[place.category] || CATEGORY_COLOURS['default'];
  const weatherEmoji = place.weather === 'indoor' ? '🏠' : '🌿';
  const dateStr      = place.date ? ` · ${formatDate(place.date)}` : '';
  const familyBadge  = place.familyFriendly
    ? `<span class="list-family-badge" title="Great with children">👨‍👩‍👧</span>`
    : '';
  const adventureBadge = place.category === 'adventures'
    ? `<span class="list-adventure-badge">✦</span>`
    : '';

  const thumbHtml = place.photo
    ? `<div class="place-thumb-wrap">
         <img class="place-thumb" src="${place.photo}" alt="" loading="lazy" onerror="this.parentElement.style.display='none'">
       </div>`
    : '';

  const tagPills = (place.tags || []).filter(t => t !== 'adventures').slice(0, 3)
    .map(t => `<span class="place-tag">${tagLabel(t)}</span>`)
    .join('');

  li.setAttribute('role', 'button');
  li.setAttribute('tabindex', '0');
  li.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); li.click(); } });

  li.innerHTML = `
    <div class="place-stripe" style="background:${colour};"></div>
    <div class="place-body">
      <div class="place-name">${adventureBadge}${place.name} ${familyBadge}</div>
      <div class="place-meta">${weatherEmoji} ${place.type}${dateStr}</div>
      <div class="place-tags-row">${tagPills}</div>
    </div>
    ${thumbHtml}
  `;

  li.addEventListener('mouseenter', () => { if (!isMobile()) setMarkerHover(place.id, true);  });
  li.addEventListener('mouseleave', () => { if (!isMobile()) setMarkerHover(place.id, false); });

  li.addEventListener('click', () => {
    const marker = markerById[place.id];
    if (!marker) return;
    map.setView([place.lat, place.lng], 14, { animate: true });

    if (isMobile()) {
      showDetail(place);
    } else {
      showDesktopDetail(place);
    }
  });

  return li;
}

function resetFilters() {
  searchInput.value = '';
  searchQuery = '';
  searchClear.style.display = 'none';
  activeFilter = 'all';
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.filter-btn[data-filter="all"]').classList.add('active');
  refresh();
}

function renderList(filtered) {
  placeList.innerHTML = '';

  if (filtered.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'place-list-empty';
    empty.innerHTML = `
      <p>Nothing matched — try broadening your search or changing the filter.</p>
      <button class="empty-clear-btn">Clear all filters</button>
    `;
    empty.querySelector('.empty-clear-btn').addEventListener('click', resetFilters);
    placeList.appendChild(empty);
  } else {
    filtered.forEach(place => placeList.appendChild(buildListItem(place)));
  }

  placeCount.textContent = `${filtered.length} place${filtered.length !== 1 ? 's' : ''} shown`;
}


// -- Filtering -----------------------------------------------

let activeFilter = 'all';
let searchQuery  = '';

function getFiltered() {
  return places.filter(place => {
    let filterMatch = true;
    if (activeFilter === 'all') {
      filterMatch = true;
    } else if (activeFilter === 'adventures') {
      filterMatch = place.category === 'adventures';
    } else if (activeFilter === 'family-friendly') {
      filterMatch = place.familyFriendly === true;
    } else {
      filterMatch = (place.tags || []).includes(activeFilter) || place.category === activeFilter;
    }

    let searchMatch = true;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      searchMatch = (
        place.name.toLowerCase().includes(q) ||
        place.description.toLowerCase().includes(q) ||
        place.type.toLowerCase().includes(q) ||
        (place.bestFor    || '').toLowerCase().includes(q) ||
        (place.whyCurious || '').toLowerCase().includes(q) ||
        (place.cost       || '').toLowerCase().includes(q) ||
        (place.category   || '').toLowerCase().includes(q) ||
        (place.tags || []).some(t => t.toLowerCase().includes(q))
      );
    }

    return filterMatch && searchMatch;
  });
}

function applyFilter(filter) {
  activeFilter = filter;
  refresh();
}

function refresh() {
  const filtered = getFiltered();

  places.forEach(place => {
    const marker = markerById[place.id];
    if (!marker) return;
    const visible = filtered.some(p => p.id === place.id);
    if (visible) {
      if (!map.hasLayer(marker)) map.addLayer(marker);
    } else {
      if (map.hasLayer(marker)) map.removeLayer(marker);
    }
  });

  renderList(filtered);
}

// Wire up filter buttons
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    applyFilter(btn.dataset.filter);
    // On mobile, ensure list is visible after filtering
    if (isMobile() && sheetState === 'collapsed') setSheetState('mid');
  });
});


// -- Search --------------------------------------------------

const searchInput = document.getElementById('search-input');
const searchClear = document.getElementById('search-clear');

searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value.trim();
  searchClear.style.display = searchQuery ? 'flex' : 'none';
  refresh();
});

searchInput.addEventListener('focus', () => {
  if (isMobile()) setSheetState('expanded');
});

searchClear.addEventListener('click', () => {
  searchInput.value = '';
  searchQuery = '';
  searchClear.style.display = 'none';
  searchInput.focus();
  refresh();
});


// -- Random adventure button ---------------------------------

document.getElementById('random-btn').addEventListener('click', () => {
  const visible = getFiltered();
  if (visible.length === 0) return;

  const pick   = visible[Math.floor(Math.random() * visible.length)];
  const marker = markerById[pick.id];
  if (!marker) return;

  map.setView([pick.lat, pick.lng], 14, { animate: true });

  if (isMobile()) {
    showDetail(pick);
  } else {
    showDesktopDetail(pick);
  }
});


// -- Mobile bottom sheet -------------------------------------

const sidebar     = document.getElementById('sidebar');
const detailPanel = document.getElementById('detail-panel');
const sheetHandle = document.getElementById('sheet-handle');

let sheetState = 'collapsed';

function computeSnaps() {
  const vh     = window.innerHeight;
  const sheetH = sidebar.offsetHeight || vh * 0.92;
  return {
    collapsed: Math.max(0, sheetH - 72),
    mid:       Math.max(0, sheetH - vh * 0.52),
    expanded:  Math.max(0, sheetH - vh * 0.88),
    detail:    Math.max(0, sheetH - vh * 0.88)
  };
}

function setSheetState(state) {
  if (!isMobile()) return;
  sheetState = state;

  const snaps  = computeSnaps();
  const offset = snaps[state] ?? snaps.collapsed;
  sidebar.style.setProperty('--sheet-offset', offset + 'px');

  document.body.classList.toggle('sheet-detail', state === 'detail');

  setTimeout(() => map.invalidateSize({ animate: false }), 340);
}

function showDetail(place) {
  detailPanel.innerHTML = buildPopup(place);
  setSheetState('detail');
}

// Back button — injected into DOM after sheet-handle
const backBtn = document.createElement('button');
backBtn.id = 'sheet-back';
backBtn.innerHTML = '← Back to list';
backBtn.addEventListener('click', () => {
  if (isMobile()) {
    detailPanel.innerHTML = '';
    setSheetState('mid');
  } else {
    closeDesktopDetail();
  }
});
sheetHandle.insertAdjacentElement('afterend', backBtn);

// Clicking the map: collapse sheet on mobile, close detail on desktop
map.on('click', () => {
  if (isMobile() && sheetState !== 'collapsed') setSheetState('collapsed');
  if (!isMobile() && document.body.classList.contains('desktop-detail')) closeDesktopDetail();
});

// Sheet drag gesture
let dragStartY    = 0;
let dragMoveDelta = 0;
let dragActive    = false;

sheetHandle.addEventListener('pointerdown', e => {
  if (!isMobile()) return;
  dragStartY    = e.clientY;
  dragMoveDelta = 0;
  dragActive    = true;
  sidebar.style.transition = 'none';
  sheetHandle.setPointerCapture(e.pointerId);
});

sheetHandle.addEventListener('pointermove', e => {
  if (!dragActive || !isMobile()) return;
  const delta  = e.clientY - dragStartY;
  dragMoveDelta += Math.abs(delta);
  const snaps  = computeSnaps();
  const cur    = parseFloat(sidebar.style.getPropertyValue('--sheet-offset')) || snaps.collapsed;
  const next   = Math.max(0, Math.min(snaps.collapsed, cur + delta));
  sidebar.style.setProperty('--sheet-offset', next + 'px');
  dragStartY = e.clientY;
});

sheetHandle.addEventListener('pointerup', () => {
  if (!dragActive || !isMobile()) return;
  dragActive = false;
  sidebar.style.transition = '';

  if (dragMoveDelta < 8) {
    setSheetState(sheetState === 'collapsed' ? 'mid' : 'collapsed');
    return;
  }

  const snaps   = computeSnaps();
  const current = parseFloat(sidebar.style.getPropertyValue('--sheet-offset')) || snaps.collapsed;
  const options = ['expanded', 'mid', 'collapsed'].map(k => ({ k, v: snaps[k] }));
  const nearest = options.reduce((b, o) => Math.abs(o.v - current) < Math.abs(b.v - current) ? o : b);
  setSheetState(nearest.k);
});

// Resize handler
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (isMobile()) setSheetState(sheetState === 'detail' ? 'detail' : 'collapsed');
    map.invalidateSize();
  }, 150);
});


// -- Initial render ------------------------------------------

applyFilter('all');

if (isMobile()) setSheetState('mid');
