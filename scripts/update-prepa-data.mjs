import fs from 'node:fs/promises';

const OUT = new URL('../data/prepa.json', import.meta.url);
const SOURCES = {
  generation: 'https://operationdata.prepa.pr.gov/dataSource.js',
  levels: 'https://operationdata.prepa.pr.gov/dataLevels.js',
  history: 'https://operationdata.prepa.pr.gov/dataGraph.js'
};

function extractArray(text, name) {
  const startMatch = new RegExp(`(?:const|let|var)\\s+${name}\\s*=\\s*\\[`, 'm').exec(text);
  if (!startMatch) throw new Error(`Array ${name} not found`);
  const start = startMatch.index + startMatch[0].lastIndexOf('[');
  let depth = 0, quote = null, escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (escape) escape = false;
      else if (ch === '\\') escape = true;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === '[') depth++;
    if (ch === ']') {
      depth--;
      if (depth === 0) return text.slice(start + 1, i);
    }
  }
  throw new Error(`Array ${name} is unterminated`);
}

function extractArrayAfterKey(text, key) {
  const m = new RegExp(`${key}\\s*:\\s*\\[`, 'm').exec(text);
  if (!m) return '';
  const start = m.index + m[0].lastIndexOf('[');
  let depth = 0, quote = null, escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (escape) escape = false;
      else if (ch === '\\') escape = true;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === '[') depth++;
    if (ch === ']') {
      depth--;
      if (depth === 0) return text.slice(start + 1, i);
    }
  }
  return '';
}

function splitObjects(text) {
  const out = [];
  let depth = 0, start = -1, quote = null, escape = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (escape) escape = false;
      else if (ch === '\\') escape = true;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === '{') { if (depth === 0) start = i; depth++; }
    else if (ch === '}') {
      depth--;
      if (depth === 0 && start >= 0) { out.push(text.slice(start, i + 1)); start = -1; }
    }
  }
  return out;
}

function fieldString(obj, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return obj.match(new RegExp(`["']?${escaped}["']?\\s*:\\s*["']([^"']*)["']`, 'i'))?.[1] ?? null;
}

function fieldNumber(obj, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const raw = obj.match(new RegExp(`["']?${escaped}["']?\\s*:\\s*([-+]?\\d+(?:\\.\\d+)?)`, 'i'))?.[1];
  return raw == null ? null : Number(raw);
}

function assignmentStrings(text, name) {
  const line = text.match(new RegExp(`(?:const|let|var)\\s+${name}\\s*=([^;]+);`, 'm'))?.[1];
  if (!line) return null;
  const parts = [...line.matchAll(/["']([^"']*)["']/g)].map(m => m[1]);
  return parts.length ? parts.join('') : null;
}

function parseGeneration(text) {
  const metrics = splitObjects(extractArray(text, 'dataMetrics')).map(obj => ({
    index: fieldString(obj, 'Index'),
    description: fieldString(obj, 'Desc'),
    value: fieldNumber(obj, 'value')
  })).filter(x => x.index != null && x.description && Number.isFinite(x.value));

  const byFuel = splitObjects(extractArray(text, 'dataByFuel')).map(obj => ({
    fuel: fieldString(obj, 'fuel'),
    value: fieldNumber(obj, 'value')
  })).filter(x => x.fuel && Number.isFinite(x.value));

  const sites = splitObjects(extractArray(text, 'dataLoadPerSite')).map(site => {
    const units = splitObjects(extractArrayAfterKey(site, 'units')).map(unit => ({
      index: fieldString(unit, 'Index'),
      name: fieldString(unit, 'Unit'),
      mw: fieldNumber(unit, 'MW'),
      mvar: fieldString(unit, 'MVar'),
      cost: fieldNumber(unit, 'Cost')
    })).filter(u => u.name && Number.isFinite(u.mw));
    return {
      index: fieldString(site, 'Index'),
      type: fieldString(site, 'Type'),
      name: fieldString(site, 'Desc'),
      siteTotalMw: fieldNumber(site, 'SiteTotal'),
      units
    };
  }).filter(s => s.name && s.type && Number.isFinite(s.siteTotalMw));

  if (!metrics.length && !sites.length) throw new Error('PREPA generation payload parsed with no metrics or sites');
  return { observedAtRaw: assignmentStrings(text, 'dataFechaAcualizado'), metrics, byFuel, sites };
}

function parseLevels(text) {
  const levels = splitObjects(extractArray(text, 'niveles')).map(obj => {
    const readingText = fieldString(obj, 'lectura');
    const differenceText = fieldString(obj, 'diferencia');
    return {
      id: fieldString(obj, 'embalse'),
      reading: readingText == null ? null : Number(readingText),
      readingRaw: readingText,
      difference: differenceText == null ? null : Number(String(differenceText).replace('=', '0')),
      differenceRaw: differenceText
    };
  }).filter(x => x.id && Number.isFinite(x.reading));
  if (!levels.length) throw new Error('PREPA levels payload parsed with no reservoir readings');
  return { observedAtRaw: assignmentStrings(text, 'fechaembalse'), reservoirs: levels };
}

function parseHistory(text) {
  const points = splitObjects(extractArray(text, 'dataGraph')).map(obj => ({
    hour: fieldString(obj, 'Hour'),
    frequencyHz: fieldNumber(obj, 'Frequency'),
    generationMw: fieldNumber(obj, 'Generation')
  })).filter(x => x.hour && Number.isFinite(x.generationMw));
  if (!points.length) throw new Error('PREPA graph payload parsed with no historical points');
  return { observedAtRaw: assignmentStrings(text, 'temperatura'), points };
}

async function fetchText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'user-agent': 'H2O-PR/2.0 (+https://h20pr.com)', 'cache-control': 'no-cache' }
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.text();
  } finally { clearTimeout(timeout); }
}

async function previousFile() {
  try { return JSON.parse(await fs.readFile(OUT, 'utf8')); }
  catch { return {}; }
}

async function pull(previous, key, url, parser) {
  const attemptedAt = new Date().toISOString();
  try {
    const text = await fetchText(url);
    const parsed = parser(text);
    return { status: 'live', sourceUrl: url, fetchedAt: attemptedAt, lastSuccessAt: attemptedAt, ...parsed };
  } catch (error) {
    const old = previous?.[key];
    if (old?.lastSuccessAt) {
      return { ...old, status: 'stale', sourceUrl: url, lastAttemptAt: attemptedAt, error: error instanceof Error ? error.message : String(error) };
    }
    return { status: 'unavailable', sourceUrl: url, lastAttemptAt: attemptedAt, error: error instanceof Error ? error.message : String(error) };
  }
}

const previous = await previousFile();
const [generation, levels, history] = await Promise.all([
  pull(previous, 'generation', SOURCES.generation, parseGeneration),
  pull(previous, 'levels', SOURCES.levels, parseLevels),
  pull(previous, 'history', SOURCES.history, parseHistory)
]);

const output = {
  schemaVersion: 1,
  updatedAt: new Date().toISOString(),
  note: 'H2O PR preserves only values reported by PREPA. No mock values, guessed capacities, synthetic trends or invented percentages are added.',
  generation,
  levels,
  history
};

await fs.writeFile(OUT, JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({
  generation: generation.status,
  generationSites: generation.sites?.length ?? 0,
  levels: levels.status,
  reservoirs: levels.reservoirs?.length ?? 0,
  history: history.status,
  historyPoints: history.points?.length ?? 0
}, null, 2));

if (generation.status === 'unavailable' && levels.status === 'unavailable' && history.status === 'unavailable') {
  process.exitCode = 2;
}
