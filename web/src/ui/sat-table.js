/**
 * sat-table.js — Satellite table renderer.
 * Renders rows sorted used-first then SNR descending.
 * Uses safe DOM construction (no innerHTML with untrusted data).
 */

/**
 * Render satellite rows into a <tbody> element.
 * @param {HTMLElement} tbody
 * @param {Array<{prn:number, used:boolean, elevation:number, azimuth:number, snr:number}>} sats
 */
export function renderSatTable(tbody, sats) {
  if (!tbody) return;

  // Clear existing rows safely.
  while (tbody.firstChild) tbody.removeChild(tbody.firstChild);

  if (!Array.isArray(sats) || sats.length === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 5;
    td.textContent = 'No satellite frames yet.';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  const sorted = sats.slice().sort((a, b) => {
    if (b.used !== a.used) return (b.used ? 1 : 0) - (a.used ? 1 : 0);
    return (b.snr || 0) - (a.snr || 0);
  });

  for (const s of sorted) {
    const tr = document.createElement('tr');
    if (s.used) tr.className = 'sat-used';

    const cells = [
      String(s.prn),
      s.used ? 'yes' : 'no',
      s.elevation != null ? s.elevation + '°' : '-',
      s.azimuth  != null ? s.azimuth  + '°' : '-',
      s.snr ? String(s.snr) : '-',
    ];

    for (const text of cells) {
      const td = document.createElement('td');
      td.textContent = text;
      tr.appendChild(td);
    }

    tbody.appendChild(tr);
  }
}
