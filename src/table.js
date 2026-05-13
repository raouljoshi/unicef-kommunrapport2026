import { state } from "./state.js";

const COLS = [
  { key: "rank",               label: "#",             numeric: true,  fmt: v => v },
  { key: "name",               label: "Namn",          numeric: false, fmt: v => v },
  { key: "kommuntyp",          label: "Typ",           numeric: false, fmt: v => v },
  { key: "samlingsindex",      label: "Samlingsindex", numeric: true,  fmt: v => v?.toFixed(1) ?? "–" },
  { key: "index_forskola",     label: "Förskola",      numeric: true,  fmt: v => v?.toFixed(2) ?? "–" },
  { key: "index_fritid",       label: "Fritid",        numeric: true,  fmt: v => v?.toFixed(2) ?? "–" },
  { key: "index_grundskola",   label: "Grundskola",    numeric: true,  fmt: v => v?.toFixed(2) ?? "–" },
  { key: "index_kultur",       label: "Kultur",        numeric: true,  fmt: v => v?.toFixed(2) ?? "–" },
  { key: "index_socialtjanst", label: "Socialtjänst",  numeric: true,  fmt: v => v?.toFixed(2) ?? "–" },
];

export function renderTable(container, municipalities, { peerIds }) {
  const peerSet = peerIds instanceof Set ? peerIds : new Set(peerIds || []);

  // Persist sort + filter state on the container element
  if (!container._tblState) {
    container._tblState = { col: "rank", dir: "asc", peersOnly: false };
  }
  const ts = container._tblState;

  // Apply peers-only filter
  let data = peersOnly(municipalities, peerSet, ts.peersOnly);

  // Sort: selected municipality always pins to top
  const sel = state.selected ? data.find(m => m.id === state.selected) : null;
  const rest = data.filter(m => m.id !== state.selected).sort((a, b) => {
    const va = a[ts.col], vb = b[ts.col];
    const cmp = typeof va === "string"
      ? (va ?? "").localeCompare(vb ?? "")
      : (va ?? -Infinity) - (vb ?? -Infinity);
    return ts.dir === "asc" ? cmp : -cmp;
  });
  const sorted = sel ? [sel, ...rest] : rest;

  const hasPeers = peerSet.size > 0;

  container.innerHTML = `
    <div class="tbl-toolbar">
      ${hasPeers ? `
        <label class="tbl-peers-toggle">
          <input type="checkbox" id="tbl-peers-only" ${ts.peersOnly ? "checked" : ""}>
          Visa bara peer-kommuner
        </label>` : ""}
      <span class="tbl-count">${sorted.length} kommuner visas</span>
    </div>
    <div class="tbl-scroll">
      <table class="muni-table" role="grid">
        <thead>
          <tr>
            ${COLS.map(c => {
              const active = c.key === ts.col;
              const icon = active ? (ts.dir === "asc" ? "↑" : "↓") : "";
              return `<th scope="col" class="th-sortable ${active ? "th-active" : ""} ${c.numeric ? "th-num" : ""}" data-col="${c.key}" tabindex="0" aria-sort="${active ? (ts.dir === "asc" ? "ascending" : "descending") : "none"}">
                ${c.label} <span class="sort-arrow" aria-hidden="true">${icon}</span>
              </th>`;
            }).join("")}
          </tr>
        </thead>
        <tbody>
          ${sorted.map(m => {
            const isSel  = m.id === state.selected;
            const isPeer = peerSet.has(m.id);
            const rowClass = isSel ? "row-sel" : isPeer ? "row-peer" : "";
            return `<tr class="${rowClass}">
              ${COLS.map(c => `<td class="${c.numeric ? "td-num" : ""}">${c.fmt(m[c.key])}</td>`).join("")}
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;

  // Sort on header click / Enter/Space keydown
  container.querySelectorAll(".th-sortable").forEach(th => {
    function doSort() {
      const col = th.dataset.col;
      if (ts.col === col) {
        ts.dir = ts.dir === "asc" ? "desc" : "asc";
      } else {
        ts.col  = col;
        ts.dir  = COLS.find(c => c.key === col)?.numeric ? "desc" : "asc";
      }
      renderTable(container, municipalities, { peerIds });
    }
    th.addEventListener("click", doSort);
    th.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); doSort(); } });
  });

  const peersOnlyChk = container.querySelector("#tbl-peers-only");
  if (peersOnlyChk) {
    peersOnlyChk.addEventListener("change", () => {
      ts.peersOnly = peersOnlyChk.checked;
      renderTable(container, municipalities, { peerIds });
    });
  }
}

function peersOnly(municipalities, peerSet, filter) {
  if (!filter || peerSet.size === 0) return municipalities;
  return municipalities.filter(m => peerSet.has(m.id) || m.id === state.selected);
}

export function exportCSV(municipalities, peerIds) {
  const peerSet = peerIds instanceof Set ? peerIds : new Set(peerIds || []);
  const allCols = ["rank","name","kommuntyp","lan","population","samlingsindex","index_forskola","index_fritid","index_grundskola","index_kultur","index_socialtjanst"];
  const headers = ["Rank","Namn","Kommuntyp","Län","Befolkning","Samlingsindex","Förskola","Fritid","Grundskola","Kultur","Socialtjänst"];

  // Export: if peers selected, export them first (sorted by rank), then rest; else export all
  const sorted = [...municipalities].sort((a, b) => a.rank - b.rank);
  const rows = [
    headers.join(";"),
    ...sorted.map(m => allCols.map(k => {
      const v = m[k];
      return v != null ? String(v) : "";
    }).join(";"))
  ];

  const bom = "﻿"; // UTF-8 BOM for Excel
  const blob = new Blob([bom + rows.join("\n")], { type: "text/csv;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.download = "kommunrapport-2026.csv";
  a.href     = url;
  a.click();
  URL.revokeObjectURL(url);
}
