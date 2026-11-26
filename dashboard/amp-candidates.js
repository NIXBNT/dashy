const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
const pageSize = 50;
const status = document.querySelector('#status');
const query = document.querySelector('#query');
const activity = document.querySelector('#activity');
const dbaasp = document.querySelector('#dbaasp');
const previous = document.querySelector('#previous');
const next = document.querySelector('#next');
const headers = document.querySelector('thead');
const body = document.querySelector('tbody');
const columns = [
  { title:'Peptide ID', key:'sequence_id' },
  { title:'Sequence', key:'sequence', code:true },
  { title:'AMP mean', key:'ampMean', accent:true },
  { title:'All numeric mean', key:'allMean', accent:true },
  { title:'AMP Scanner v2', key:'amp_scanner_v2.prediction_probability', label:'amp_scanner_v2.predicted_class' },
  { title:'AMPidentifier', key:'ampidentifier.probability_AMP', label:'ampidentifier.predicted_class' },
  { title:'CAMPR3 SVM', key:'campr3.svm_probability', label:'campr3.svm_class' },
  { title:'CAMPR3 RF', key:'campr3.rf_probability', label:'campr3.rf_class' },
  { title:'CAMPR3 ANN', key:'campr3.ann_class' },
  { title:'CAMPR3 DA', key:'campr3.da_probability', label:'campr3.da_class' },
  { title:'CAMPR4 RF', key:'campr4.rf_probability', label:'campr4.rf_class' },
  { title:'CAMPR4 SVM', key:'campr4.svm_probability', label:'campr4.svm_class' },
  { title:'CAMPR4 ANN', key:'campr4.ann_probability', label:'campr4.ann_class' },
  { title:'ClassAMP', key:'classamp.probability', label:'classamp.predicted_activity_class' },
  { title:'DBAASP', key:'dbaasp_general.predicted_class' },
];

let records = [];
let matches = [];
let sortKey = 'ampMean';
let descending = true;
let page = 0;

function compare(a, b) {
  return typeof a === 'number' ? a - b : a.localeCompare(b);
}

function updateMatches() {
  const term = query.value.trim().toUpperCase();
  matches = records.filter(record => (
    (!term || record.sequence_id.toUpperCase().includes(term) || record.sequence.includes(term)) &&
    (!activity.value || record['classamp.predicted_activity_class'] === activity.value) &&
    (!dbaasp.value || record['dbaasp_general.predicted_class'] === dbaasp.value)
  ));
  matches.sort((a, b) => (
    compare(a[sortKey], b[sortKey]) * (descending ? -1 : 1) ||
    compare(a.sequence_id, b.sequence_id)
  ));
  page = 0;
  render();
}

function render() {
  for (const column of columns) {
    const active = column.key === sortKey;
    column.button.textContent = column.title + (active ? (descending ? ' ↓' : ' ↑') : '');
    if (active) column.header.setAttribute('aria-sort', descending ? 'descending' : 'ascending');
    else column.header.removeAttribute('aria-sort');
  }

  const start = page * pageSize;
  const end = Math.min(start + pageSize, matches.length);
  const rows = document.createDocumentFragment();
  for (const record of matches.slice(start, end)) {
    const row = document.createElement('tr');
    for (const column of columns) {
      const cell = row.insertCell();
      const value = record[column.key];
      const formatted = typeof value === 'number' ? value.toFixed(4) : value;
      if (column.code) {
        const code = document.createElement('code');
        code.textContent = formatted;
        cell.append(code);
      } else {
        cell.textContent = formatted;
      }
      if (column.accent) cell.classList.add('mean');
      if (typeof value === 'number') cell.title = String(value);
      if (column.label) {
        const label = document.createElement('small');
        label.textContent = record[column.label];
        cell.append(label);
      }
    }
    rows.append(row);
  }
  body.replaceChildren(rows);
  status.textContent = matches.length
    ? `${(start + 1).toLocaleString()}–${end.toLocaleString()} of ${matches.length.toLocaleString()} matching peptides`
    : 'No peptides match the current filters.';
  previous.disabled = page === 0;
  next.disabled = end >= matches.length;
}

function addHeaders() {
  const row = headers.insertRow();
  for (const column of columns) {
    const header = document.createElement('th');
    header.scope = 'col';
    const button = document.createElement('button');
    button.type = 'button';
    button.addEventListener('click', () => {
      descending = sortKey === column.key ? !descending : typeof records[0][column.key] === 'number';
      sortKey = column.key;
      updateMatches();
    });
    header.append(button);
    row.append(header);
    column.header = header;
    column.button = button;
  }
}

async function load() {
  const response = await fetch('./amp-candidates.json');
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  records = data.rows.map(row => {
    const record = Object.fromEntries(data.columns.map((name, index) => [name, row[index]]));
    const serverScores = [
      record['amp_scanner_v2.prediction_probability'],
      record['ampidentifier.probability_AMP'],
      mean(['svm', 'rf', 'da'].map(model => record[`campr3.${model}_probability`])),
      mean(['rf', 'svm', 'ann'].map(model => record[`campr4.${model}_probability`])),
    ];
    record.ampMean = mean(serverScores);
    record.allMean = mean([...serverScores, record['classamp.probability']]);
    return record;
  });
  if (!records.length) throw new Error('Empty candidate dataset');

  addHeaders();
  query.addEventListener('input', updateMatches);
  for (const filter of [activity, dbaasp]) filter.addEventListener('change', updateMatches);
  previous.addEventListener('click', () => { page--; render(); });
  next.addEventListener('click', () => { page++; render(); });
  updateMatches();
}

load().catch(error => {
  status.textContent = 'Could not load predictions. Open the dashboard through a static web server and reload.';
  console.error(error);
});
