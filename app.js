'use strict';
const $ = id => document.getElementById(id);
let all = [], matches = [], selected = 0, cache = new Map(), renderVersion = 0;
const node = (tag, className, value) => { const e = document.createElement(tag); if (className) e.className = className; if (value !== undefined) e.textContent = value; return e; };
function showError(message) { $('error').hidden = false; $('error').textContent = message; $('record').hidden = true; }
function taskName(task) { return task.replaceAll('_', ' '); }
function buildCard(container, version, label) {
  container.replaceChildren();
  const content = node('div', 'card-content'); container.append(content);
  if (!version) { content.append(node('p', 'missing', 'No skill-informed rewrite is available for this question.')); return; }
  content.append(node('p', 'section-label', 'QUESTION'), node('p', 'question', version.question));
  const choices = node('div', 'choices');
  for (const [key, value] of Object.entries(version.choices || {})) {
    const row = node('div', 'choice'); row.append(node('span', 'choice-key', key + '.'), node('span', '', value)); choices.append(row);
  }
  content.append(choices);
  if (version.skills && version.skills.length) content.append(node('div', 'skill', 'Skills: ' + version.skills.join(', ')));
  const response = node('div', 'response');
  const header = node('div', 'response-heading'); header.append(node('span', 'response-label', 'MODEL RESPONSE'), node('span', 'model', 'FLASH-NEXT')); response.append(header);
  if (!version.answer) { response.append(node('p', 'missing', 'No saved Flash-Next response is available for this version.')); }
  else {
    response.append(node('div', 'answer-text', version.answer.response || 'The saved final response is empty.'));
    if (version.answer.thinking) { const details = node('details', 'thinking'); details.append(node('summary', '', 'Show full generated reasoning'), node('div', 'thinking-text', version.answer.thinking)); response.append(details); }
  }
  content.append(response);
}
async function render() {
  let version = ++renderVersion;
  $('error').hidden = true;
  $('match-count').textContent = `${matches.length.toLocaleString()} matching question${matches.length === 1 ? '' : 's'}`;
  $('prev').disabled = selected <= 0; $('next').disabled = selected >= matches.length - 1;
  $('position').textContent = matches.length ? `${(selected + 1).toLocaleString()} / ${matches.length.toLocaleString()}` : '0 / 0';
  if (!matches.length) { $('record').hidden = true; return; }
  const row = matches[selected];
  const shard = Math.floor(row.index / 100);
  try {
    if (!cache.has(shard)) {
      const response = await fetch(`data/part-${String(shard).padStart(3, '0')}.json`);
      if (!response.ok) throw Error(`HTTP ${response.status}`);
      cache.set(shard, await response.json());
    }
    if (version !== renderVersion) return;
    const item = cache.get(shard).find(entry => entry.id === row.id);
    if (!item) throw Error('Question missing from its data file');
    $('task-tag').textContent = taskName(item.task).toUpperCase(); $('record-id').textContent = item.id;
    $('seq-length').textContent = `${item.sequence.length.toLocaleString()} amino acids`; $('sequence-text').textContent = item.sequence;
    document.querySelector('.sequence').open = false;
    buildCard($('original'), item.original, 'Original'); buildCard($('rewrite'), item.rewrite, 'Rewrite');
    $('record').hidden = false;
    const url = new URL(location.href); url.searchParams.set('id', item.id); history.replaceState(null, '', url);
  } catch (err) { if (version === renderVersion) showError(`Could not load this question: ${err.message}`); }
}
function filter(wanted) {
  const term = $('search').value.trim().toLowerCase(); const task = $('task').value; const mode = $('availability').value;
  matches = all.filter(row => (!term || `${row.id} ${row.task} ${row.search}`.toLowerCase().includes(term)) && (!task || row.task === task) && (mode === 'all' || (mode === 'paired' && row.original_answer && row.rewrite_answer) || (mode === 'rewrite' && row.rewrite) || (mode === 'missing' && (!row.rewrite || !row.original_answer || !row.rewrite_answer))));
  selected = wanted ? Math.max(0, matches.findIndex(row => row.id === wanted)) : 0; render();
}
$('prev').addEventListener('click', () => { if (selected > 0) { selected--; render(); } });
$('next').addEventListener('click', () => { if (selected < matches.length - 1) { selected++; render(); } });
$('random').addEventListener('click', () => { if (matches.length) { selected = Math.floor(Math.random() * matches.length); render(); } });
$('task').addEventListener('change', () => filter()); $('availability').addEventListener('change', () => filter());
let searchTimer; $('search').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => filter(), 180); });
$('copy').addEventListener('click', async () => { try { await navigator.clipboard.writeText(location.href); $('copy').textContent = 'Copied ✓'; setTimeout(() => $('copy').textContent = 'Copy link ↗', 2000); } catch (_) { window.prompt('Copy this link:', location.href); } });
(async () => { try { const response = await fetch('data/index.json'); if (!response.ok) throw Error(`HTTP ${response.status}`); all = await response.json(); const tasks = [...new Set(all.map(row => row.task))].sort(); for (const task of tasks) { const option = node('option', '', taskName(task)); option.value = task; $('task').append(option); } filter(new URL(location.href).searchParams.get('id')); } catch (err) { showError(`Could not load the dataset: ${err.message}`); } })();
