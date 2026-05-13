import { loadData, SECTORS, INDICATORS, INDICATOR_BY_KEY, KOMMUNTYP_COLOR, KOMMUNTYP_GROUPS } from "./src/data.js";
import { state, setState, computePeers } from "./src/state.js";
import { createBeeswarm } from "./src/beeswarm.js";
import { renderFilterPanel, updateMuniCard, updatePeerList } from "./src/filters.js";
import { renderTable, exportCSV } from "./src/table.js";

let municipalities = [];
let byId = new Map();

// ── Tooltip ──────────────────────────────────────────────────────────────────
const tooltip = document.getElementById("tooltip");
let tooltipTarget = null;

function showTooltip(event, m, valueKey) {
  if (!m) return;
  tooltipTarget = m.id;
  const val = m[valueKey];
  const sectorMeta   = SECTORS.find(s => s.key === valueKey);
  const indicatorMeta = INDICATOR_BY_KEY[valueKey];
  const label = sectorMeta?.label ?? indicatorMeta?.label ?? valueKey;
  const unit  = indicatorMeta?.unit ? ` ${indicatorMeta.unit}` : "";
  const isPeer = state.peers.includes(m.id);
  tooltip.innerHTML = `
    <strong>${m.name}</strong>
    <span class="tt-rank">Rank #${m.rank} av 284</span>
    <span class="tt-type">${m.kommuntyp}</span>
    <span class="tt-lan">${m.lan}</span>
    <hr>
    <span class="tt-kpi">${label}: <strong>${val != null ? val.toFixed(2) + unit : "–"}</strong></span>
    ${isPeer ? '<span class="tt-peer">★ I din peer-grupp</span>' : ''}
  `;
  tooltip.style.display = "block";
  positionTooltip(event);
}

function positionTooltip(event) {
  const pad = 12;
  let tx = event.clientX + pad;
  let ty = event.clientY + pad;
  if (tx + 240 > window.innerWidth) tx = event.clientX - 240 - pad;
  if (ty + 175 > window.innerHeight) ty = event.clientY - 175 - pad;
  tooltip.style.left = tx + "px";
  tooltip.style.top  = ty + "px";
}

document.addEventListener("pointermove", e => { if (tooltipTarget) positionTooltip(e); });
document.addEventListener("pointerdown", e => {
  if (!e.target.closest(".dot, path.selected-marker")) {
    tooltip.style.display = "none";
    tooltipTarget = null;
  }
});

// ── Autocomplete search ───────────────────────────────────────────────────────
const searchInput = document.getElementById("search-input");
const searchList  = document.getElementById("search-list");

function setupSearch() {
  searchInput.addEventListener("input", () => {
    const q = searchInput.value.trim().toLowerCase();
    if (!q) { searchList.innerHTML = ""; searchList.hidden = true; return; }
    const matches = municipalities.filter(m => m.name.toLowerCase().startsWith(q)).slice(0, 8);
    searchList.innerHTML = matches.map(m =>
      `<li role="option" data-id="${m.id}">${m.name} <small>${m.kommuntyp}</small></li>`
    ).join("");
    searchList.hidden = matches.length === 0;
  });

  function _pick(li) {
    selectMunicipality(li.dataset.id);
    searchList.hidden = true;
    searchInput.value = byId.get(li.dataset.id)?.name ?? "";
  }

  searchList.addEventListener("pointerdown", e => { const li = e.target.closest("li[data-id]"); if (li) { e.preventDefault(); _pick(li); } });
  searchList.addEventListener("click",       e => { const li = e.target.closest("li[data-id]"); if (li) _pick(li); });

  searchInput.addEventListener("keydown", e => {
    const items   = [...searchList.querySelectorAll("li")];
    const focused = searchList.querySelector("li.focused");
    if (e.key === "ArrowDown") { e.preventDefault(); const next = focused ? focused.nextElementSibling ?? items[0] : items[0]; focused?.classList.remove("focused"); next?.classList.add("focused"); }
    else if (e.key === "ArrowUp") { e.preventDefault(); const prev = focused ? focused.previousElementSibling ?? items[items.length-1] : items[items.length-1]; focused?.classList.remove("focused"); prev?.classList.add("focused"); }
    else if (e.key === "Enter") { e.preventDefault(); const pick = focused ?? items[0]; if (pick) { _pick(pick); } }
    else if (e.key === "Escape") { searchList.hidden = true; }
  });
  document.addEventListener("pointerdown", e => { if (!e.target.closest(".search-wrapper")) searchList.hidden = true; });
}

// ── Select municipality ───────────────────────────────────────────────────────
const filterSidebar = document.getElementById("filter-sidebar");
let filterPanelBuilt = false;

function selectMunicipality(id) {
  const muni = municipalities.find(m => m.id === id);
  // Set kommuntyp default to selected municipality's own type (makes UI checkbox reflect reality)
  setState({
    selected: id,
    filters: { ...state.filters, kommuntyp: muni ? [muni.kommuntyp] : [] },
  });
  setState({ peers: computePeers(municipalities, id) });
  updateURL();

  if (!filterPanelBuilt) {
    renderFilterPanel(filterSidebar, municipalities, () => {
      setState({ peers: computePeers(municipalities) });
      updateURL();
      render();
      updateMuniCard(filterSidebar, municipalities);
      renderPeerStrip();
    });
    filterPanelBuilt = true;
  }

  filterSidebar.hidden = false;
  updateMuniCard(filterSidebar, municipalities);
  renderPeerStrip();
  renderLegend();
  render();
}

// ── URL hash state ────────────────────────────────────────────────────────────
function updateURL() {
  const params = new URLSearchParams();
  if (state.selected) params.set("k", state.selected);
  if (state.filters.kommuntyp.length) params.set("t", state.filters.kommuntyp.join("+"));
  if (state.filters.lan.length) params.set("l", state.filters.lan.join("+"));
  history.replaceState(null, "", "#" + params.toString());
}

function readURL() {
  const hash = location.hash.slice(1);
  if (!hash) return;
  const params = new URLSearchParams(hash);
  const patch = {};
  if (params.has("k")) patch.selected = params.get("k");
  if (params.has("t")) patch.filters = { ...state.filters, kommuntyp: params.get("t").split("+") };
  if (params.has("l")) patch.filters = { ...state.filters, lan: params.get("l").split("+") };
  if (Object.keys(patch).length) setState(patch);
}

// ── Viz controls ──────────────────────────────────────────────────────────────
function setupVizControls() {
  document.getElementById("btn-beeswarm").addEventListener("click", () => {
    if (state.view !== "beeswarm") { setState({ view: "beeswarm" }); render(); }
  });
  document.getElementById("btn-table").addEventListener("click", () => {
    if (state.view !== "table") { setState({ view: "table" }); render(); }
  });

  document.getElementById("btn-copy-url").addEventListener("click", () => {
    navigator.clipboard.writeText(location.href).then(() => {
      const btn = document.getElementById("btn-copy-url");
      btn.textContent = "Kopierat!";
      btn.classList.add("copied");
      setTimeout(() => { btn.textContent = "Dela länk"; btn.classList.remove("copied"); }, 2000);
    });
  });

  document.getElementById("btn-csv").addEventListener("click", () => {
    exportCSV(municipalities, state.peers);
  });

  document.getElementById("btn-png").addEventListener("click", async () => {
    const btn = document.getElementById("btn-png");
    btn.textContent = "Laddar…";
    btn.disabled = true;
    try {
      const target = document.getElementById("main-viz");
      const canvas = await html2canvas(target, {
        backgroundColor: getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || "#F4F6F8",
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const a = document.createElement("a");
      a.download = `kommunrapport-${state.selected || "alla"}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    } catch (e) {
      console.error("PNG export failed:", e);
    } finally {
      btn.textContent = "↓ PNG";
      btn.disabled = false;
    }
  });
}

// ── Legend ────────────────────────────────────────────────────────────────────
function renderLegend() {
  const container = document.getElementById("legend");
  const hasSelected = !!state.selected;
  container.innerHTML =
    KOMMUNTYP_GROUPS.map(g => `
      <span class="legend-item legend-group-item" title="${g.types.join(" · ")}">
        <span class="legend-dot" style="background:${g.color}"></span>
        <span class="legend-group-name">${g.label}</span>
        <span class="legend-group-sub">${g.types.join(" · ")}</span>
      </span>
    `).join("") +
    (hasSelected ? `
      <span class="legend-item legend-own-item">
        <svg class="legend-diamond-icon" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
          <polygon points="6,1 11,6 6,11 1,6" fill="#111" stroke="white" stroke-width="1.5"/>
        </svg>
        Din kommun
      </span>
    ` : "");
}

// ── Peer panel (right sidebar — vertical list) ────────────────────────────────
function renderPeerStrip() {
  const sidebar = document.getElementById("peer-sidebar");
  if (!sidebar) return;

  if (!state.selected || state.peers.length === 0) {
    sidebar.hidden = true;
    return;
  }

  const peers = state.peers
    .map(id => byId.get(id))
    .filter(Boolean)
    .sort((a, b) => a.rank - b.rank);

  sidebar.hidden = false;
  sidebar.innerHTML = `
    <div class="peer-panel">
      <div class="peer-panel-header">
        Peer-kommuner
        <span class="peer-panel-count">${peers.length}</span>
      </div>
      <ol class="peer-panel-list">
        ${peers.map(m => {
          const isSelf = m.id === state.selected;
          return `<li class="peer-panel-item${isSelf ? " peer-panel-self" : ""}" data-id="${m.id}">
            <span class="peer-panel-rank">#${m.rank}</span>
            <span class="peer-panel-name">
              ${isSelf
                ? `<svg viewBox="0 0 9 9" width="8" height="8" aria-hidden="true" style="flex-shrink:0;margin-right:2px"><polygon points="4.5,0.5 8.5,4.5 4.5,8.5 0.5,4.5" fill="#111"/></svg>`
                : ""}
              ${m.name}
            </span>
            <span class="peer-panel-score">${m.samlingsindex.toFixed(1)}</span>
          </li>`;
        }).join("")}
      </ol>
    </div>
  `;

  sidebar.querySelectorAll(".peer-panel-item[data-id]").forEach(li => {
    li.style.cursor = "pointer";
    li.addEventListener("click", () => {
      selectMunicipality(li.dataset.id);
      searchInput.value = byId.get(li.dataset.id)?.name ?? "";
    });
  });
}

// ── Indicator drill-down accordion ────────────────────────────────────────────
function renderIndicatorAccordion(accordion, sectorKey, peerSet, width) {
  const indicators = INDICATORS[sectorKey];
  if (!indicators) return;

  // Re-use existing strips or build fresh
  indicators.forEach(ind => {
    let strip = accordion.querySelector(`[data-indicator="${ind.key}"]`);
    if (!strip) {
      strip = document.createElement("div");
      strip.className = "indicator-strip";
      strip.setAttribute("data-indicator", ind.key);
      accordion.appendChild(strip);
    }

    const sel = state.selected ? byId.get(state.selected) : null;
    const selVal = sel?.[ind.key];
    const valueBadge = selVal != null
      ? `<span class="indicator-value-badge">${selVal.toFixed(1)} ${ind.unit}</span>`
      : "";

    const hasData = municipalities.some(m => m[ind.key] != null);
    strip.innerHTML = `
      <div class="indicator-header">
        <span class="indicator-label">${ind.label}${valueBadge}</span>
        <span class="indicator-unit">${ind.unit}</span>
      </div>
      <div class="indicator-desc">${ind.desc}</div>
      ${hasData
        ? `<div class="beeswarm-wrap indicator-beeswarm"></div>`
        : `<div class="indicator-no-data">Ingen data tillgänglig</div>`}
    `;

    if (!hasData) return;

    const wrap = strip.querySelector(".beeswarm-wrap");
    const beeswarmWidth = width - 24; // account for accordion padding (2 × 0.75rem)

    createBeeswarm(wrap, {
      data: municipalities,
      sectorKey: ind.key,
      label: ind.label,
      domain: null,   // auto-computed
      width: beeswarmWidth,
      height: 75,
      radius: 3.5,
      selectedId: state.selected,
      peerIds: peerSet,
      onSelect: id => {
        selectMunicipality(id);
        searchInput.value = byId.get(id)?.name ?? "";
      },
    });

    const svg = wrap.querySelector("svg");
    if (svg && !svg._tooltipBound) {
      svg._tooltipBound = true;
      svg.addEventListener("pointerover", e => {
        const circle = e.target.closest("circle.dot");
        if (!circle) return;
        const datum = d3.select(circle).datum();
        if (datum) showTooltip(e, byId.get(datum.id), ind.key);
      });
      svg.addEventListener("pointerout", e => {
        if (!e.target.closest("circle.dot")) { tooltip.style.display = "none"; tooltipTarget = null; }
      });
    }
  });
}

// ── Main render ───────────────────────────────────────────────────────────────
function render() {
  const container = document.getElementById("main-viz");
  const width = container.clientWidth || 800;
  const peerSet = new Set(state.peers);

  // Sync view toggle button state
  const isTable = state.view === "table";
  document.getElementById("btn-beeswarm")?.classList.toggle("active", !isTable);
  document.getElementById("btn-beeswarm")?.setAttribute("aria-pressed", String(!isTable));
  document.getElementById("btn-table")?.classList.toggle("active", isTable);
  document.getElementById("btn-table")?.setAttribute("aria-pressed", String(isTable));

  // Table view
  let tableContainer = container.querySelector(".table-container");
  if (!tableContainer) {
    tableContainer = document.createElement("div");
    tableContainer.className = "table-container";
    container.appendChild(tableContainer);
  }
  if (isTable) {
    document.getElementById("legend").style.display = "none";
    container.querySelectorAll(".sector-strip").forEach(s => s.style.display = "none");
    tableContainer.classList.add("visible");
    renderTable(tableContainer, municipalities, { peerIds: peerSet });
    return;
  } else {
    document.getElementById("legend").style.display = "";
    container.querySelectorAll(".sector-strip").forEach(s => s.style.display = "");
    tableContainer.classList.remove("visible");
  }

  SECTORS.forEach(sector => {
    const isDrillable = sector.key !== "samlingsindex";

    let strip = container.querySelector(`[data-sector="${sector.key}"]`);
    if (!strip) {
      strip = document.createElement("div");
      strip.className = "sector-strip";
      strip.setAttribute("data-sector", sector.key);

      if (isDrillable) {
        strip.innerHTML = `
          <button class="sector-header" aria-expanded="false" aria-controls="accordion-${sector.key}">
            <span class="sector-label">${sector.label}</span>
            <svg class="sector-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="4 6 8 10 12 6"/></svg>
          </button>
          <div class="beeswarm-wrap"></div>
          <div class="indicator-accordion" id="accordion-${sector.key}" hidden></div>
        `;

        strip.querySelector(".sector-header").addEventListener("click", () => {
          const isExpanded = state.expandedSector === sector.key;
          setState({ expandedSector: isExpanded ? null : sector.key });
          render();
        });
      } else {
        strip.innerHTML = `
          <span class="sector-label">${sector.label}</span>
          <div class="beeswarm-wrap"></div>
        `;
      }

      container.appendChild(strip);
    }

    // Update expanded state on header button; dim other strips when one is open
    if (isDrillable) {
      const headerBtn = strip.querySelector(".sector-header");
      const accordion = strip.querySelector(".indicator-accordion");
      const isExpanded = state.expandedSector === sector.key;
      headerBtn.setAttribute("aria-expanded", String(isExpanded));
      accordion.hidden = !isExpanded;
      if (isExpanded) renderIndicatorAccordion(accordion, sector.key, peerSet, width);
    }
    // Dim non-expanded strips when any accordion is open
    const isDimmed = state.expandedSector !== null && state.expandedSector !== sector.key;
    strip.classList.toggle("sector-dim", isDimmed);

    // Main sector beeswarm
    const wrap = strip.querySelector(".beeswarm-wrap");
    createBeeswarm(wrap, {
      data: municipalities,
      sectorKey: sector.key,
      label: sector.label,
      domain: sector.domain,
      width,
      height: sector.key === "samlingsindex" ? 120 : 90,
      selectedId: state.selected,
      peerIds: peerSet,
      onSelect: id => {
        selectMunicipality(id);
        searchInput.value = byId.get(id)?.name ?? "";
      },
    });

    const svg = wrap.querySelector("svg");
    if (svg && !svg._tooltipBound) {
      svg._tooltipBound = true;
      svg.addEventListener("pointerover", e => {
        const circle = e.target.closest("circle.dot");
        if (!circle) return;
        const datum = d3.select(circle).datum();
        if (datum) showTooltip(e, byId.get(datum.id), sector.key);
      });
      svg.addEventListener("pointerout", e => {
        if (!e.target.closest("circle.dot")) { tooltip.style.display = "none"; tooltipTarget = null; }
      });
    }
  });
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
async function init() {
  const data = await loadData();
  municipalities = data.municipalities;
  byId = data.byId;

  setupSearch();
  setupVizControls();
  renderLegend();
  readURL();

  // Apply smart default kommuntyp if municipality is in URL but type filter isn't
  if (state.selected && state.filters.kommuntyp.length === 0) {
    const muni = byId.get(state.selected);
    if (muni) setState({ filters: { ...state.filters, kommuntyp: [muni.kommuntyp] } });
  }

  if (state.selected) {
    setState({ peers: computePeers(municipalities) });
    renderFilterPanel(filterSidebar, municipalities, () => {
      setState({ peers: computePeers(municipalities) });
      updateURL();
      render();
      updateMuniCard(filterSidebar, municipalities);
      renderPeerStrip();
    });
    filterPanelBuilt = true;
    filterSidebar.hidden = false;
    updateMuniCard(filterSidebar, municipalities);
    renderPeerStrip();
    renderLegend();
  }

  render();

  window.addEventListener("resize", () => {
    document.querySelectorAll(".beeswarm-wrap svg").forEach(s => s.remove());
    render();
  });
}

init().catch(err => {
  document.getElementById("error-msg").textContent = `Fel vid laddning: ${err.message}`;
  document.getElementById("error-msg").hidden = false;
});
