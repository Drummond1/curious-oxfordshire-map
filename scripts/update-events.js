#!/usr/bin/env node
// update-events.js — Weekly event maintenance script
// Removes past-dated events, then adds up to 20 new upcoming Oxfordshire events via Claude.
// Usage: ANTHROPIC_API_KEY=sk-... node scripts/update-events.js

const fs   = require('fs');
const path = require('path');
const https = require('https');

const DATA_FILE   = path.join(__dirname, '../data.js');
const MAX_NEW     = 20;
const API_KEY     = process.env.ANTHROPIC_API_KEY;

if (!API_KEY) {
  console.error('ANTHROPIC_API_KEY not set');
  process.exit(1);
}

// ── Load data ────────────────────────────────────────────────
const src    = fs.readFileSync(DATA_FILE, 'utf8');
const match  = src.match(/const places = (\[[\s\S]*?\n\];)/);
if (!match) { console.error('Could not find places array'); process.exit(1); }
const places = eval(match[1]);

const today     = new Date(); today.setHours(0,0,0,0);
const todayStr  = today.toISOString().slice(0, 10);

// ── 1. Remove past-dated events ──────────────────────────────
const pastIds = places
  .filter(p => p.category === 'events' && p.date && new Date(p.date) < today)
  .map(p => p.id);

let content = src;
let removedCount = 0;

for (const id of pastIds) {
  const needle = 'id: ' + id + ',';
  let idx = content.indexOf(needle);
  if (idx === -1) continue;

  let start = idx;
  while (start > 0 && content[start] !== '{') start--;
  let depth = 0, end = start;
  while (end < content.length) {
    if (content[end] === '{') depth++;
    else if (content[end] === '}') { depth--; if (depth === 0) break; }
    end++;
  }
  const before = content.lastIndexOf('\n', start - 1);
  const after  = content.indexOf('\n', end + 1);
  content = content.slice(0, before) + content.slice(after);
  removedCount++;
}

console.log(`Removed ${removedCount} past events.`);

// ── 2. Work out current state for the prompt ─────────────────
const fresh    = eval(content.match(/const places = (\[[\s\S]*?\n\];)/)[1]);
const maxId    = Math.max(...fresh.map(p => p.id));
const existing = fresh
  .filter(p => p.category === 'events' && p.date)
  .map(p => `${p.name} (${p.date})`)
  .join('\n');

// ── 3. Ask Claude for new events ─────────────────────────────
const prompt = `You are helping maintain a website called Secret Oxfordshire — a curated map of unusual, interesting and curious places and events across Oxfordshire, England.

Today's date: ${todayStr}
Next ID to use: ${maxId + 1}
Max new entries: ${MAX_NEW}

EXISTING UPCOMING EVENTS (do not duplicate these):
${existing}

YOUR TASK:
Research and generate up to ${MAX_NEW} REAL, VERIFIED upcoming events happening in Oxfordshire between now and 18 months from now. Focus on:
- Unusual, curious, community, folk, nature, arts, heritage or eccentric events
- Real named events with a specific date — not generic or made-up
- Spread across the county (not just Oxford city)
- A mix of dates across the coming year

For each event, output a valid JavaScript object literal (no const, no semicolons around it) exactly like this format:

  {
    id: ${maxId + 1},
    name: "Event Name",
    category: "events",
    lat: 51.7520,
    lng: -1.2577,
    type: "Event",
    description: "1-2 sentence description of what the event is.",
    whyCurious: "1-2 sentences on why this is interesting or unusual.",
    familySuitability: "Brief note on suitability for families.",
    bestFor: "Short comma-separated list of what it's best for",
    cost: "Free / £X / from £X",
    weather: "outdoor",
    date: "YYYY-MM-DD",
    verified: false,
    photo: null,
    tags: ["events", "nature"]
  }

Output ONLY valid JS object literals separated by commas, inside a JavaScript comment block:
/* EVENTS_START */
{ ... },
{ ... }
/* EVENTS_END */

If you cannot find ${MAX_NEW} verified real events, output fewer — accuracy matters more than quantity. Do not invent events.`;

function callClaude(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'claude-opus-4-7',
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }]
    });

    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`Claude API ${res.statusCode}: ${data}`));
          return;
        }
        const parsed = JSON.parse(data);
        resolve(parsed.content[0].text);
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('Asking Claude for new events…');
  let reply;
  try {
    reply = await callClaude(prompt);
  } catch (err) {
    console.error('Claude API error:', err.message);
    // Still write the cleaned file (removed past events)
    fs.writeFileSync(DATA_FILE, content);
    console.log('Wrote cleaned data.js (past events removed, no new events added).');
    process.exit(0);
  }

  // Extract between markers
  const startMarker = '/* EVENTS_START */';
  const endMarker   = '/* EVENTS_END */';
  const s = reply.indexOf(startMarker);
  const e = reply.indexOf(endMarker);

  if (s === -1 || e === -1) {
    console.error('Could not find EVENTS_START/END markers in Claude response.');
    console.log('Raw reply:', reply.slice(0, 500));
    fs.writeFileSync(DATA_FILE, content);
    process.exit(0);
  }

  const rawObjects = reply.slice(s + startMarker.length, e).trim();
  if (!rawObjects) {
    console.log('Claude returned no new events.');
    fs.writeFileSync(DATA_FILE, content);
    process.exit(0);
  }

  // Validate by eval-ing inside an array
  let newEvents;
  try {
    newEvents = eval('[' + rawObjects + ']');
  } catch (err) {
    console.error('Failed to parse Claude response as JS:', err.message);
    console.log('Raw objects:', rawObjects.slice(0, 500));
    fs.writeFileSync(DATA_FILE, content);
    process.exit(0);
  }

  // Filter out any that are past-dated or duplicate names
  const existingNames = new Set(fresh.map(p => p.name.toLowerCase().trim()));
  const validNew = newEvents
    .filter(e => {
      if (!e.date) return false;
      if (new Date(e.date) < today) { console.log('  Skipping past-dated:', e.name, e.date); return false; }
      if (existingNames.has(e.name.toLowerCase().trim())) { console.log('  Skipping duplicate:', e.name); return false; }
      return true;
    })
    .slice(0, MAX_NEW);

  console.log(`Adding ${validNew.length} new events.`);
  validNew.forEach(e => console.log('  +', e.name, e.date));

  if (validNew.length === 0) {
    fs.writeFileSync(DATA_FILE, content);
    console.log('No new events to add.');
    process.exit(0);
  }

  // Serialise new events into JS
  function serialiseEvent(ev) {
    const tagsStr = JSON.stringify(ev.tags || ['events']);
    return `
  {
    id: ${ev.id},
    name: ${JSON.stringify(ev.name)},
    category: "events",
    lat: ${ev.lat},
    lng: ${ev.lng},
    type: "Event",
    description: ${JSON.stringify(ev.description)},
    whyCurious: ${JSON.stringify(ev.whyCurious || '')},
    familySuitability: ${JSON.stringify(ev.familySuitability || '')},
    bestFor: ${JSON.stringify(ev.bestFor || '')},
    cost: ${JSON.stringify(ev.cost || 'Free')},
    weather: ${JSON.stringify(ev.weather || 'outdoor')},
    date: ${JSON.stringify(ev.date)},
    verified: false,
    photo: null,
    tags: ${tagsStr}
  }`;
  }

  const newJs = validNew.map(serialiseEvent).join(',\n');

  // Insert before the closing ]; of the places array
  const insertPoint = content.lastIndexOf('\n];');
  content = content.slice(0, insertPoint) + ',\n' + newJs + '\n' + content.slice(insertPoint);

  fs.writeFileSync(DATA_FILE, content);
  console.log(`\nDone. Removed: ${removedCount}, Added: ${validNew.length}`);
}

main().catch(err => { console.error(err); process.exit(1); });
