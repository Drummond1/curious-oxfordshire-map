// ============================================================
// app.js — Curious Oxfordshire Map
// ============================================================

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

  // Family-friendly: white solid centre + coloured outer ring via box-shadow
  const innerStyle = isFamilyFriendly
    ? `background:#fff; border:2px solid ${colour}; box-shadow: 0 0 0 3px ${colour}, 0 2px 6px rgba(0,0,0,0.28);`
    : `background:${colour}; border:2px solid rgba(255,255,255,0.9); box-shadow: 0 2px 6px rgba(0,0,0,0.3);`;

  return L.divIcon({
    className: '',
    html: `<div style="
      width:18px; height:18px;
      border-radius:50%;
      ${innerStyle}
    "></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -14]
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

  const isAdventure = place.category === 'adventures';

  const catColour = CATEGORY_COLOURS[place.category] || CATEGORY_COLOURS['default'];

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
        <span>💰 Cost</span><strong>${place.cost}</strong>
        <span>⭐ Best for</span><strong>${place.bestFor}</strong>
      </div>
      <div class="popup-tags">
        <span class="popup-tag ${weatherClass}">${weatherLabel}</span>
        ${tagPills}
      </div>
      <div class="popup-verified">${verifiedNote}</div>
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

  marker.bindPopup(buildPopup(place), { maxWidth: 340 });
  marker.placeData = place;
  markerById[place.id] = marker;
});


// -- Sidebar list --------------------------------------------

const placeList  = document.getElementById('place-list');
const placeCount = document.getElementById('place-count');

function buildListItem(place) {
  const li = document.createElement('li');
  li.className = 'place-item';
  li.dataset.id = place.id;

  const colour = CATEGORY_COLOURS[place.category] || CATEGORY_COLOURS['default'];
  const weatherEmoji = place.weather === 'indoor' ? '🏠' : '🌿';
  const dateStr = place.date ? ` · ${formatDate(place.date)}` : '';
  const familyBadge = place.familyFriendly
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

  li.innerHTML = `
    <div class="place-stripe" style="background:${colour};"></div>
    <div class="place-body">
      <div class="place-name">${adventureBadge}${place.name} ${familyBadge}</div>
      <div class="place-meta">${weatherEmoji} ${place.type}${dateStr}</div>
      <div class="place-tags-row">${tagPills}</div>
    </div>
    ${thumbHtml}
  `;

  li.addEventListener('click', () => {
    const marker = markerById[place.id];
    if (!marker) return;
    map.setView([place.lat, place.lng], 14, { animate: true });
    marker.openPopup();
    document.querySelectorAll('.place-item').forEach(el => el.classList.remove('highlighted'));
    li.classList.add('highlighted');
  });

  return li;
}

function renderList(filtered) {
  placeList.innerHTML = '';
  filtered.forEach(place => placeList.appendChild(buildListItem(place)));
  placeCount.textContent = `${filtered.length} place${filtered.length !== 1 ? 's' : ''} shown`;
}


// -- Filtering -----------------------------------------------

let activeFilter  = 'all';
let searchQuery   = '';

function getFiltered() {
  return places.filter(place => {
    // Filter match
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

    // Search match
    let searchMatch = true;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      searchMatch = (
        place.name.toLowerCase().includes(q) ||
        place.description.toLowerCase().includes(q) ||
        place.type.toLowerCase().includes(q) ||
        (place.bestFor || '').toLowerCase().includes(q)
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

  const pick = visible[Math.floor(Math.random() * visible.length)];
  const marker = markerById[pick.id];
  if (!marker) return;

  map.setView([pick.lat, pick.lng], 14, { animate: true });
  marker.openPopup();

  document.querySelectorAll('.place-item').forEach(el => {
    el.classList.toggle('highlighted', el.dataset.id == pick.id);
  });

  // Scroll to the highlighted list item
  const highlighted = placeList.querySelector('.highlighted');
  if (highlighted) highlighted.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
});


// -- Initial render ------------------------------------------

applyFilter('all');
