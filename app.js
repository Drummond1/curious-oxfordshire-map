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

const clusterGroup = L.markerClusterGroup({
  chunkedLoading: true,
  showCoverageOnHover: false,
  spiderfyOnMaxZoom: true,
  maxClusterRadius: isMobile() ? 80 : 60,
});
clusterGroup.addTo(map);

// Tapping a cluster → collapse the sheet so spiderfied pins are visible
clusterGroup.on('clusterclick', () => {
  if (isMobile() && sheetState !== 'collapsed') setSheetState('collapsed');
});


// -- Custom marker icon --------------------------------------

const CATEGORY_COLOURS = {
  'strange-or-historic': '#a05030',
  'nature':              '#4a7c59',
  'rainy-day':           '#4a70a0',
  'events':              '#8b5ea6',
  'hidden-places':       '#c07030',
  'food-or-treats':      '#c05060',
  'adventures':          '#2a7a6a',
  'lost-places':         '#7a5838',
  'underground':         '#4a4860',
  'screen-and-page':     '#5a3f7a',
  'night-sky':           '#1e3a6a',
  'wartime':             '#6a7a3a',
  'folklore':            '#3d6654',
  'industrial-ruin':     '#8a5030',
  'eccentric':           '#a03068',
  'sonic':               '#2a7a8a',
  'default':             '#7a6050'
};

const CATEGORY_LETTERS = {
  'strange-or-historic': 'S',
  'nature':              'N',
  'rainy-day':           'R',
  'events':              'E',
  'hidden-places':       'H',
  'food-or-treats':      'F',
  'adventures':          'A',
  'lost-places':         'L',
  'underground':         'U',
  'screen-and-page':     'P',
  'night-sky':           'Y',
  'wartime':             'W',
  'folklore':            'M',
  'industrial-ruin':     'I',
  'eccentric':           'X',
  'sonic':               'Z',
  'default':             '·'
};

function makeIcon(category, isFamilyFriendly) {
  const colour = CATEGORY_COLOURS[category] || CATEGORY_COLOURS['default'];
  const letter = CATEGORY_LETTERS[category] || CATEGORY_LETTERS['default'];
  const size   = isMobile() ? 26 : 18;
  const half   = size / 2;
  const fs     = Math.round(size * 0.52);

  const bg     = isFamilyFriendly ? '#fff' : colour;
  const fg     = isFamilyFriendly ? colour : '#fff';
  const border = isFamilyFriendly
    ? `2px solid ${colour}`
    : '2px solid rgba(255,255,255,0.9)';
  const shadow = isFamilyFriendly
    ? `0 0 0 3px ${colour}, 0 2px 6px rgba(0,0,0,0.28)`
    : '0 2px 6px rgba(0,0,0,0.3)';

  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};border:${border};box-shadow:${shadow};color:${fg};display:flex;align-items:center;justify-content:center;font-size:${fs}px;font-weight:700;font-family:system-ui,sans-serif;line-height:1;">${letter}</div>`,
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

// -- Compact "peek" card (mobile marker tap) -----------------

function buildPeekCard(place) {
  const catColour = CATEGORY_COLOURS[place.category] || CATEGORY_COLOURS['default'];
  const catLetter = CATEGORY_LETTERS[place.category] || '·';
  const mapsUrl   = `https://maps.google.com/?q=${place.lat},${place.lng}`;

  const tags = [];
  if (place.weather === 'indoor') tags.push('🏠 Indoor'); else tags.push('🌿 Outdoor');
  if (place.familyFriendly) tags.push('👨‍👩‍👧 Family');
  if ((place.tags || []).includes('free-or-cheap')) tags.push('💚 Free');
  if (place.cost) tags.push(`💰 ${place.cost}`);
  if (place.date) tags.push(`📅 ${formatDate(place.date)}`);
  if (userLocation) tags.push(`📍 ${fmtDistance(haversineKm(userLocation.lat, userLocation.lng, place.lat, place.lng))}`);

  const snippet = place.description
    ? place.description.slice(0, 160) + (place.description.length > 160 ? '…' : '')
    : '';

  return `
    <div class="peek-card">
      <div class="peek-header">
        <div class="peek-icon" style="background:${catColour}">${catLetter}</div>
        <div class="peek-header-text">
          <div class="peek-name">${place.name}</div>
          <div class="peek-type" style="color:${catColour}">${place.type}</div>
        </div>
      </div>
      <div class="peek-tags">${tags.map(t => `<span class="peek-tag">${t}</span>`).join('')}</div>
      ${snippet ? `<div class="peek-desc">${snippet}</div>` : ''}
      <div class="peek-actions">
        <button class="peek-expand-btn">View full details →</button>
        <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" class="peek-directions">Directions</a>
      </div>
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
    'free-or-cheap':      '💚 Free or Cheap',
    'lost-places':        '🏚 Lost Places',
    'underground':        '⛏ Underground',
    'screen-and-page':    '📖 Screen & Page',
    'night-sky':          '★ Night Sky',
    'wartime':            '⚔ Wartime',
    'folklore':           '🌀 Folklore',
    'industrial-ruin':    '🏭 Industrial Ruin',
    'eccentric':          '🎩 Eccentric',
    'sonic':              '🎵 Sonic'
  };
  return labels[tag] || tag;
}


// -- Build markers -------------------------------------------

const markerById = {};

const allMarkers = [];
places.forEach(place => {
  const marker = L.marker([place.lat, place.lng], {
    icon: makeIcon(place.category, place.familyFriendly)
  });

  marker.on('click', () => {
    if (isMobile()) {
      panToForMobile(place.lat, place.lng);
      openFullDetail(place, 'list');  // go directly to full detail, same as list tap
    } else {
      map.setView([place.lat, place.lng], 14, { animate: true });
      showDesktopDetail(place);
    }
  });

  marker.placeData = place;
  markerById[place.id] = marker;
  allMarkers.push(marker);
});
clusterGroup.addLayers(allMarkers);


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
  attachShareBtn(place, detailPanel);
  attachFavBtn(place, detailPanel);
  history.replaceState(null, '', `#place-${place.id}`);
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
  history.replaceState(null, '', location.pathname);
}

// Mobile full-detail view with sticky nav bar + prev/next navigation
// source: 'peek' = came from marker peek card (back restores peek); 'list' = came from list (back goes to list)
function openFullDetail(place, source = 'list') {
  const idx   = currentFiltered.findIndex(p => p.id === place.id);
  const total = currentFiltered.length;

  detailPanel.innerHTML = `
    <div class="detail-nav">
      <button class="detail-nav-back" id="detail-back">← Back</button>
      <span class="detail-nav-pos">${total > 1 ? `${idx + 1} / ${total}` : ''}</span>
      <div class="detail-nav-arrows">
        <button class="detail-nav-arrow" id="detail-prev" ${idx <= 0 ? 'disabled' : ''} aria-label="Previous">‹</button>
        <button class="detail-nav-arrow" id="detail-next" ${idx >= total - 1 ? 'disabled' : ''} aria-label="Next">›</button>
      </div>
    </div>
  ` + buildPopup(place);

  detailPanel.scrollTop = 0;
  attachShareBtn(place, detailPanel);
  attachFavBtn(place, detailPanel);
  history.replaceState(null, '', `#place-${place.id}`);
  setSheetState('detail');

  function backToList() {
    detailPanel.innerHTML = '';
    currentPeekPlace = null;
    history.replaceState(null, '', location.pathname);
    setSheetState('mid');
    // Scroll the list item into view after the sheet animates back
    requestAnimationFrame(() => {
      const li = placeList.querySelector(`[data-id="${place.id}"]`);
      if (li) {
        li.classList.add('highlighted');
        li.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        setTimeout(() => li.classList.remove('highlighted'), 1600);
      }
    });
  }

  detailPanel.querySelector('#detail-back').addEventListener('click', () => {
    if (source === 'peek' && currentPeekPlace) {
      showDetail(currentPeekPlace);
    } else {
      backToList();
    }
  });

  detailPanel.querySelector('#detail-prev')?.addEventListener('click', () => {
    if (idx > 0) openFullDetail(currentFiltered[idx - 1], source);
  });
  detailPanel.querySelector('#detail-next')?.addEventListener('click', () => {
    if (idx < total - 1) openFullDetail(currentFiltered[idx + 1], source);
  });

  // Swipe left/right on the detail panel to navigate prev/next.
  // Store handlers on the element so we can cleanly remove them next time.
  if (detailPanel._swipeTouchEnd)   detailPanel.removeEventListener('touchend',   detailPanel._swipeTouchEnd);
  if (detailPanel._swipeTouchStart) detailPanel.removeEventListener('touchstart', detailPanel._swipeTouchStart);

  let swipeStartX = 0;
  let swipeStartY = 0;

  detailPanel._swipeTouchStart = e => {
    swipeStartX = e.touches[0].clientX;
    swipeStartY = e.touches[0].clientY;
  };
  detailPanel._swipeTouchEnd = e => {
    const dx = e.changedTouches[0].clientX - swipeStartX;
    const dy = e.changedTouches[0].clientY - swipeStartY;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0 && idx < total - 1) openFullDetail(currentFiltered[idx + 1], source);
    else if (dx > 0 && idx > 0)    openFullDetail(currentFiltered[idx - 1], source);
  };

  detailPanel.addEventListener('touchstart', detailPanel._swipeTouchStart, { passive: true });
  detailPanel.addEventListener('touchend',   detailPanel._swipeTouchEnd,   { passive: true });

  // Swipe hint toast — shown once per session
  if (total > 1 && isMobile() && !sessionStorage.getItem('swipeHintSeen')) {
    sessionStorage.setItem('swipeHintSeen', '1');
    const hint = document.createElement('div');
    hint.className = 'swipe-hint';
    hint.textContent = '← swipe to browse →';
    detailPanel.appendChild(hint);
    setTimeout(() => hint.remove(), 2200);
  }
}


// -- Favorites -----------------------------------------------

const FAV_KEY = 'oxf_favorites';
let favorites = new Set(JSON.parse(localStorage.getItem(FAV_KEY) || '[]'));

function saveFavs() {
  localStorage.setItem(FAV_KEY, JSON.stringify([...favorites]));
}

function toggleFav(id, btn) {
  if (favorites.has(id)) {
    favorites.delete(id);
  } else {
    favorites.add(id);
  }
  saveFavs();
  const active = favorites.has(id);
  btn.classList.toggle('fav-active', active);
  btn.title = active ? 'Saved!' : 'Save this place';
  if (activeFilter === 'saved') refresh();
}

function attachFavBtn(place, container) {
  const btn = document.createElement('button');
  const active = favorites.has(place.id);
  btn.className = 'popup-fav-btn' + (active ? ' fav-active' : '');
  btn.title     = active ? 'Saved!' : 'Save this place';
  btn.innerHTML = active ? '♥ Saved' : '♥ Save';
  btn.addEventListener('click', () => {
    toggleFav(place.id, btn);
    btn.innerHTML = favorites.has(place.id) ? '♥ Saved' : '♥ Save';
  });
  const dirs = container.querySelector('.popup-directions, .peek-directions');
  if (dirs) dirs.insertAdjacentElement('afterend', btn);
  else container.appendChild(btn);
}


// -- Sidebar list --------------------------------------------

const placeList  = document.getElementById('place-list');
const placeCount = document.getElementById('place-count');

const BATCH_SIZE = 60;
let renderedCount    = 0;
let currentFiltered  = [];
let sentinelObserver = null;

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

  const distStr = userLocation
    ? ` · <span class="place-distance">${fmtDistance(haversineKm(userLocation.lat, userLocation.lng, place.lat, place.lng))}</span>`
    : '';

  li.setAttribute('role', 'button');
  li.setAttribute('tabindex', '0');
  li.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); li.click(); } });

  li.innerHTML = `
    <div class="place-stripe" style="background:${colour};"></div>
    <div class="place-body">
      <div class="place-name">${adventureBadge}${place.name} ${familyBadge}</div>
      <div class="place-meta">${weatherEmoji} ${place.type}${dateStr}${distStr}</div>
      <div class="place-tags-row">${tagPills}</div>
    </div>
    ${thumbHtml}
  `;

  const favBtn = document.createElement('button');
  favBtn.className = 'place-fav-btn' + (favorites.has(place.id) ? ' fav-active' : '');
  favBtn.title     = favorites.has(place.id) ? 'Saved!' : 'Save this place';
  favBtn.innerHTML = '♥';
  favBtn.addEventListener('click', e => {
    e.stopPropagation();
    toggleFav(place.id, favBtn);
  });
  li.appendChild(favBtn);

  li.addEventListener('mouseenter', () => { if (!isMobile()) setMarkerHover(place.id, true);  });
  li.addEventListener('mouseleave', () => { if (!isMobile()) setMarkerHover(place.id, false); });

  li.addEventListener('click', () => {
    const marker = markerById[place.id];
    if (!marker) return;
    map.setView([place.lat, place.lng], 14, { animate: true });

    if (isMobile()) {
      panToForMobile(place.lat, place.lng);
      openFullDetail(place);
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
  if (sentinelObserver) { sentinelObserver.disconnect(); sentinelObserver = null; }
  placeList.innerHTML = '';
  renderedCount = 0;
  currentFiltered = filtered;

  if (filtered.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'place-list-empty';
    empty.innerHTML = `
      <p>Nothing matched — try broadening your search or changing the filter.</p>
      <button class="empty-clear-btn">Clear all filters</button>
    `;
    empty.querySelector('.empty-clear-btn').addEventListener('click', resetFilters);
    placeList.appendChild(empty);
    placeCount.textContent = '0 places shown';
    const hc = document.getElementById('handle-count');
    if (hc) hc.textContent = '0 places';
    return;
  }

  appendBatch();
  const countLabel = `${filtered.length} place${filtered.length !== 1 ? 's' : ''}`;
  placeCount.textContent = countLabel + ' shown';
  const handleCount = document.getElementById('handle-count');
  if (handleCount) handleCount.textContent = countLabel;
}

function appendBatch() {
  const end = Math.min(renderedCount + BATCH_SIZE, currentFiltered.length);
  for (let i = renderedCount; i < end; i++) {
    placeList.appendChild(buildListItem(currentFiltered[i]));
  }
  renderedCount = end;

  const old = placeList.querySelector('.list-sentinel');
  if (old) old.remove();

  if (renderedCount < currentFiltered.length) {
    const sentinel = document.createElement('li');
    sentinel.className = 'list-sentinel';
    placeList.appendChild(sentinel);
    sentinelObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          sentinelObserver.disconnect();
          appendBatch();
        }
      },
      { root: placeList, rootMargin: '300px' }
    );
    sentinelObserver.observe(sentinel);
  }
}


// -- Filtering -----------------------------------------------

let activeFilter = 'all';
let searchQuery  = '';

function getFiltered() {
  return places.filter(place => {
    // Category filter
    let filterMatch = true;
    if (activeFilter === 'all') {
      filterMatch = true;
    } else if (activeFilter === 'adventures') {
      filterMatch = place.category === 'adventures';
    } else if (activeFilter === 'family-friendly') {
      filterMatch = place.familyFriendly === true;
    } else if (activeFilter === 'saved') {
      filterMatch = favorites.has(place.id);
    } else {
      filterMatch = (place.tags || []).includes(activeFilter) || place.category === activeFilter;
    }

    // Search filter
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

    // Date / period filter
    let dateMatch = true;
    if (dateFrom && dateTo) {
      if (place.date) {
        const d    = new Date(place.date);
        const from = new Date(dateFrom);
        const to   = new Date(dateTo);
        to.setHours(23, 59, 59);          // inclusive end of day
        dateMatch = d >= from && d <= to;
      } else {
        // Undated "events" are hidden when a period is active; other types stay visible
        dateMatch = place.category !== 'events';
      }
    }

    return filterMatch && searchMatch && dateMatch;
  });
}

function applyFilter(filter) {
  activeFilter = filter;
  refresh();
}

function refresh() {
  const filtered = getFiltered();
  const filteredSet = new Set(filtered.map(p => p.id));

  places.forEach(place => {
    const marker = markerById[place.id];
    if (!marker) return;
    const visible = filteredSet.has(place.id);
    if (visible) {
      if (!clusterGroup.hasLayer(marker)) clusterGroup.addLayer(marker);
    } else {
      if (clusterGroup.hasLayer(marker)) clusterGroup.removeLayer(marker);
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
  const mob = document.getElementById('mobile-search-input');
  if (mob) {
    mob.value = searchInput.value;
    const mobClear = document.getElementById('mobile-search-clear');
    if (mobClear) mobClear.style.display = searchQuery ? 'block' : 'none';
  }
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
  if (mobileSearchInput) { mobileSearchInput.value = ''; mobileSearchClear.style.display = 'none'; }
  refresh();
});


// -- Mobile floating search bar ------------------------------

const mobileSearchInput = document.getElementById('mobile-search-input');
const mobileSearchClear = document.getElementById('mobile-search-clear');

if (mobileSearchInput) {
  mobileSearchInput.addEventListener('input', () => {
    const q = mobileSearchInput.value.trim();
    searchInput.value = q;
    searchQuery = q;
    searchClear.style.display = q ? 'flex' : 'none';
    mobileSearchClear.style.display = q ? 'block' : 'none';
    if (isMobile() && (sheetState === 'collapsed' || sheetState === 'peek')) setSheetState('mid');
    refresh();
  });

  mobileSearchClear.addEventListener('click', () => {
    mobileSearchInput.value = '';
    searchInput.value = '';
    searchQuery = '';
    mobileSearchClear.style.display = 'none';
    searchClear.style.display = 'none';
    mobileSearchInput.focus();
    refresh();
  });

  mobileSearchInput.addEventListener('focus', () => {
    if (isMobile()) setSheetState('expanded');
  });
}


// -- Random adventure button ---------------------------------

document.getElementById('random-btn').addEventListener('click', () => {
  const visible = getFiltered();
  if (visible.length === 0) return;

  const pick   = visible[Math.floor(Math.random() * visible.length)];
  const marker = markerById[pick.id];
  if (!marker) return;

  if (isMobile()) {
    panToForMobile(pick.lat, pick.lng);
    openFullDetail(pick);
  } else {
    map.setView([pick.lat, pick.lng], 14, { animate: true });
    showDesktopDetail(pick);
  }
});


// -- Mobile bottom sheet -------------------------------------

const sidebar     = document.getElementById('sidebar');
const detailPanel = document.getElementById('detail-panel');
const sheetHandle = document.getElementById('sheet-handle');

let sheetState = 'collapsed';
let currentPeekPlace = null;  // place shown in peek card, so back-from-detail can restore it

function computeSnaps() {
  const vh     = window.innerHeight;
  const sheetH = sidebar.offsetHeight || vh * 0.92;
  return {
    collapsed: Math.max(0, sheetH - 72),
    mid:       Math.max(0, sheetH - vh * 0.52),
    peek:      Math.max(0, sheetH - vh * 0.56),   // ~44% map visible — used for marker tap
    expanded:  Math.max(0, sheetH - vh * 0.88),
    detail:    Math.max(0, sheetH - vh * 0.95)
  };
}

function setSheetState(state) {
  if (!isMobile()) return;
  sheetState = state;

  const snaps  = computeSnaps();
  const offset = snaps[state] ?? snaps.collapsed;
  sidebar.style.setProperty('--sheet-offset', offset + 'px');

  // sheet-peek: marker-tap peek card (back button visible, no detail-nav)
  // sheet-full-detail: full expanded detail (detail-nav visible, no sheet-back)
  document.body.classList.toggle('sheet-peek',        state === 'peek');
  document.body.classList.toggle('sheet-full-detail', state === 'detail');
  document.body.classList.toggle('sheet-up',          state !== 'collapsed');

  setTimeout(() => map.invalidateSize({ animate: false }), 340);
}

// Pan so the target pin lands in the visible map area (above the peek sheet)
function panToForMobile(lat, lng) {
  const zoom = 14;
  map.setView([lat, lng], zoom, { animate: false });
  // Peek sheet covers ~40% from bottom → visible map is top ~60%
  // Centre of visible area ≈ 30% from top of screen
  const pt      = map.latLngToContainerPoint([lat, lng]);
  const targetY = window.innerHeight * 0.28;
  const dy      = pt.y - targetY;
  if (Math.abs(dy) > 30) map.panBy([0, dy], { animate: true, duration: 0.3 });
}

function showDetail(place) {
  currentPeekPlace = place;
  detailPanel.innerHTML = buildPeekCard(place);
  detailPanel.scrollTop = 0;
  detailPanel.querySelector('.peek-expand-btn').addEventListener('click', () => {
    openFullDetail(place, 'peek');
  });
  history.replaceState(null, '', `#place-${place.id}`);
  setSheetState('peek');
}

// Back button — injected into DOM after sheet-handle
const backBtn = document.createElement('button');
backBtn.id = 'sheet-back';
backBtn.innerHTML = '← Back to list';
backBtn.addEventListener('click', () => {
  if (isMobile()) {
    detailPanel.innerHTML = '';
    currentPeekPlace = null;
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

  const hasDetail = detailPanel.innerHTML.trim().length > 0;

  if (dragMoveDelta < 8) {
    if (sheetState === 'collapsed') {
      setSheetState(hasDetail ? 'detail' : 'mid');
    } else {
      setSheetState('collapsed');
    }
    return;
  }

  const snaps   = computeSnaps();
  const current = parseFloat(sidebar.style.getPropertyValue('--sheet-offset')) || snaps.collapsed;
  // Peek state: only snap between peek/collapsed (not detail — drag up → use button to expand)
  // Full detail state: snap between detail/collapsed
  // No detail: snap between expanded/mid/collapsed
  const snapKeys = sheetState === 'peek'
    ? ['peek', 'collapsed']
    : (hasDetail ? ['detail', 'collapsed'] : ['expanded', 'mid', 'collapsed']);
  const options = snapKeys.map(k => ({ k, v: snaps[k] }));
  const nearest = options.reduce((b, o) => Math.abs(o.v - current) < Math.abs(b.v - current) ? o : b);
  setSheetState(nearest.k);
});

// Resize handler
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (isMobile()) setSheetState(['detail', 'peek'].includes(sheetState) ? sheetState : 'collapsed');
    map.invalidateSize();
  }, 150);
});


// -- Date filter toggle (mobile) -----------------------------

const dateToggle = document.getElementById('date-toggle');
const dateFilterInner = document.getElementById('date-filter-inner');

if (dateToggle && dateFilterInner) {
  dateToggle.addEventListener('click', () => {
    const expanded = dateToggle.getAttribute('aria-expanded') === 'true';
    dateToggle.setAttribute('aria-expanded', String(!expanded));
    dateFilterInner.hidden = expanded;
  });
}

// -- Date / period filter ------------------------------------

const dateFromInput  = document.getElementById('date-from');
const dateToInput    = document.getElementById('date-to');
const dateClearBtn   = document.getElementById('date-clear-btn');
const dateActiveBar  = document.getElementById('date-active-bar');
const dateActiveLabel = document.getElementById('date-active-label');

let dateFrom = '';  // ISO string or ''
let dateTo   = '';

function toISO(d) {
  return d.toISOString().slice(0, 10);
}

function fmtRange(from, to) {
  const opts = { day: 'numeric', month: 'short' };
  const a = new Date(from).toLocaleDateString('en-GB', opts);
  const b = new Date(to).toLocaleDateString('en-GB', opts);
  return a === b ? a : `${a} – ${b}`;
}

function applyDateRange(from, to, presetKey) {
  dateFrom = from;
  dateTo   = to;

  // Update inputs
  dateFromInput.value = from;
  dateToInput.value   = to;
  dateFromInput.classList.toggle('active', !!from);
  dateToInput.classList.toggle('active',   !!to);

  // Highlight active preset chip
  document.querySelectorAll('.date-preset').forEach(b =>
    b.classList.toggle('active', !!presetKey && b.dataset.preset === presetKey)
  );

  // Show / hide active bar
  if (from && to) {
    dateActiveBar.hidden = false;
    dateActiveLabel.textContent = `📅 ${fmtRange(from, to)}`;
    // Auto-expand on mobile when a filter becomes active
    if (dateToggle && dateFilterInner && isMobile()) {
      dateToggle.setAttribute('aria-expanded', 'true');
      dateFilterInner.hidden = false;
    }
  } else {
    dateActiveBar.hidden = true;
  }

  refresh();
}

function clearDateFilter() {
  applyDateRange('', '', null);
}

function getPresetRange(preset) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dow = today.getDay(); // 0=Sun…6=Sat

  switch (preset) {
    case 'weekend': {
      // Next Sat–Sun (or current weekend if today is Sat/Sun)
      const toSat = dow === 6 ? 0 : (6 - dow);
      const sat   = new Date(today); sat.setDate(today.getDate() + toSat);
      const sun   = new Date(sat);   sun.setDate(sat.getDate() + 1);
      return [toISO(sat), toISO(sun), 'weekend'];
    }
    case 'next-week': {
      const toMon = dow === 0 ? 1 : (8 - dow);
      const mon   = new Date(today); mon.setDate(today.getDate() + toMon);
      const sun   = new Date(mon);   sun.setDate(mon.getDate() + 6);
      return [toISO(mon), toISO(sun), 'next-week'];
    }
    case 'this-month': {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      const last  = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return [toISO(first), toISO(last), 'this-month'];
    }
    case 'next-month': {
      const first = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      const last  = new Date(today.getFullYear(), today.getMonth() + 2, 0);
      return [toISO(first), toISO(last), 'next-month'];
    }
  }
  return ['', '', null];
}

// Preset chips
document.querySelectorAll('.date-preset').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.classList.contains('active')) {
      clearDateFilter();
      return;
    }
    const [from, to, key] = getPresetRange(btn.dataset.preset);
    applyDateRange(from, to, key);
  });
});

// Custom from/to inputs
dateFromInput.addEventListener('change', () => {
  let to = dateToInput.value;
  if (dateFromInput.value && !to) {
    // Auto-set end date 7 days after start
    const d = new Date(dateFromInput.value);
    d.setDate(d.getDate() + 7);
    to = toISO(d);
  }
  applyDateRange(dateFromInput.value, to, null);
});

dateToInput.addEventListener('change', () => {
  applyDateRange(dateFromInput.value, dateToInput.value, null);
});

dateClearBtn.addEventListener('click', clearDateFilter);


// -- Filter count badges -------------------------------------

function updateFilterCounts() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    const filter = btn.dataset.filter;
    let count;
    if (filter === 'all') {
      count = places.length;
    } else if (filter === 'adventures') {
      count = places.filter(p => p.category === 'adventures').length;
    } else if (filter === 'family-friendly') {
      count = places.filter(p => p.familyFriendly === true).length;
    } else {
      count = places.filter(p =>
        (p.tags || []).includes(filter) || p.category === filter
      ).length;
    }
    let span = btn.querySelector('.filter-count');
    if (!span) {
      span = document.createElement('span');
      span.className = 'filter-count';
      btn.appendChild(span);
    }
    span.textContent = count;
  });
}


// -- Fit map bounds to visible filtered markers --------------

function fitBoundsToVisible() {
  if (clusterGroup.getLayers().length === 0) return;
  const bounds = clusterGroup.getBounds();
  if (bounds.isValid()) {
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14, animate: true });
  }
}


// -- User location -------------------------------------------

let userLocMarker = null;
let userLocation  = null;  // { lat, lng } when geolocation available

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
          + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
          * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtDistance(km) {
  return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`;
}

const locateBtn = document.getElementById('locate-btn');

locateBtn.addEventListener('click', () => {
  locateBtn.classList.add('locating');
  map.locate({ setView: true, maxZoom: 14 });
});

map.on('locationfound', e => {
  locateBtn.classList.remove('locating');
  userLocation = { lat: e.latlng.lat, lng: e.latlng.lng };
  if (userLocMarker) userLocMarker.remove();
  userLocMarker = L.marker(e.latlng, {
    icon: L.divIcon({
      className: '',
      html: '<div class="user-location-dot"></div>',
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    }),
    zIndexOffset: 2000,
  }).addTo(map);
  userLocMarker.bindPopup('You are here').openPopup();
  refresh();  // re-render list with distances
});

map.on('locationerror', () => {
  locateBtn.classList.remove('locating');
});


// -- Share / deep-link ---------------------------------------

function sharePlace(place) {
  const url = `${location.href.split('#')[0]}#place-${place.id}`;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => {
      const btn = document.querySelector('.popup-share');
      if (btn) { btn.classList.add('copied'); btn.textContent = '✓ Link copied'; }
    });
  } else {
    prompt('Copy this link:', url);
  }
}

function openPlaceById(id) {
  const place = places.find(p => p.id === id);
  if (!place) return;
  map.setView([place.lat, place.lng], 14, { animate: true });
  if (isMobile()) openFullDetail(place); else showDesktopDetail(place);
}

// Inject share button into popup HTML (called after buildPopup is inserted)
function attachShareBtn(place, container) {
  const btn = document.createElement('button');
  btn.className = 'popup-share';
  btn.innerHTML = '🔗 Share';
  btn.addEventListener('click', () => sharePlace(place));
  const dirs = container.querySelector('.popup-directions');
  if (dirs) dirs.insertAdjacentElement('afterend', btn);
  else container.appendChild(btn);
}


// -- Wire fit-bounds into filter buttons ---------------------

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    setTimeout(fitBoundsToVisible, 120);
  });
});


// -- Initial render ------------------------------------------

updateFilterCounts();
applyFilter('all');

// Handle deep-link hash on load
const hashMatch = location.hash.match(/^#place-(\d+)$/);
if (hashMatch) {
  const id = parseInt(hashMatch[1], 10);
  setTimeout(() => openPlaceById(id), 400);
}

if (isMobile()) setSheetState('mid');
