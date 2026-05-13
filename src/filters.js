import { state, setState } from "./state.js";
import { KOMMUNTYP_GROUPS } from "./data.js";

let _currentPop = 0;
let _currentKommuntyp = "";
let _currentSelectedId = null; // track municipality changes to avoid spurious slider resets

export function renderFilterPanel(container, municipalities, onFilterChange) {
  const allLan = [...new Set(municipalities.map(m => m.lan))].sort();

  container.innerHTML = `
    <div class="muni-card" id="muni-card">
      <div class="muni-card-rank-top" id="muni-card-rank"></div>
      <div class="muni-card-name" id="muni-card-name">–</div>
      <div class="muni-card-index-row">
        <span class="muni-card-index" id="muni-card-index">–</span>
        <span class="muni-card-index-label">Samlingsindex</span>
      </div>
      <div class="muni-card-divider"></div>
      <div class="muni-card-badges" id="muni-card-badges"></div>
    </div>

    <div class="filter-panel">
      <div class="fp-header">
        <span class="fp-header-label">Anpassa peer-grupp</span>
      </div>

      <div id="fp-settings-body" class="fp-settings-body">

        <div class="filter-section">
          <h3>Kommuntyp</h3>
          <div id="fp-kommuntyp">
            ${KOMMUNTYP_GROUPS.map(g => `
              <div class="kt-group">
                <label class="fp-checkbox kt-group-header">
                  <input type="checkbox" class="kt-group-cb" data-group="${g.id}">
                  <span class="kt-color-dot" style="background:${g.color}"></span>
                  <strong>${g.label}</strong>
                </label>
                <div class="kt-subtypes">
                  ${g.types.map(t => `
                    <label class="fp-checkbox kt-subtype">
                      <input type="checkbox" class="kt-type-cb" value="${t}"
                             ${state.filters.kommuntyp.includes(t) ? "checked" : ""}>
                      ${t}
                    </label>
                  `).join("")}
                </div>
              </div>
            `).join("")}
          </div>
          <div class="fp-filter-note" id="fp-kt-note"></div>
          <button class="fp-reset-btn" id="fp-kt-reset">Återställ till din kommuntyp</button>
        </div>

        <div class="filter-section">
          <h3>Befolkning</h3>
          <div class="fp-pop-slider-wrap">
            <div class="fp-pop-axis-labels">
              <span>Alla storlekar</span>
              <span>±150%</span>
            </div>
            <div class="fp-pop-track-row">
              <input type="range" id="fp-pop-slider" min="0" max="150" step="10" value="0"
                     aria-label="Tillåten avvikelse i befolkningsstorlek (0 = alla, 150 = ±150% av din kommuns storlek)">
            </div>
            <div class="fp-pop-info">
              <span class="fp-pop-diamond">◆ Din kommuns storlek</span>
              <span class="fp-pop-label" id="fp-pop-label">Ingen begränsning</span>
            </div>
          </div>
          <button class="fp-reset-btn" id="fp-pop-reset">Återställ (alla storlekar)</button>
        </div>

        <div class="filter-section">
          <h3>Län <span id="fp-lan-badge" class="fp-badge" style="display:none"></span></h3>
          <div class="fp-lan-note" id="fp-lan-note"></div>
          <div id="fp-lan" class="fp-checkbox-list fp-lan-list">
            ${allLan.map(lan => `
              <label class="fp-checkbox">
                <input type="checkbox" value="${lan}" ${state.filters.lan.includes(lan) ? "checked" : ""}>
                ${lan}
              </label>
            `).join("")}
          </div>
        </div>

      </div>
    </div>
  `;

  // ── Kommuntyp checkboxes ──────────────────────────────────────────────────
  container.querySelector("#fp-kommuntyp").addEventListener("change", e => {
    if (e.target.classList.contains("kt-type-cb")) {
      const checked = [...container.querySelectorAll(".kt-type-cb:checked")].map(i => i.value);
      setState({ filters: { ...state.filters, kommuntyp: checked } });
      _updateKtGroupState(container);
      onFilterChange();
    } else if (e.target.classList.contains("kt-group-cb")) {
      const groupId = e.target.dataset.group;
      const group   = KOMMUNTYP_GROUPS.find(g => g.id === groupId);
      container.querySelectorAll(".kt-type-cb").forEach(cb => {
        if (group.types.includes(cb.value)) cb.checked = e.target.checked;
      });
      const allChecked = [...container.querySelectorAll(".kt-type-cb:checked")].map(i => i.value);
      setState({ filters: { ...state.filters, kommuntyp: allChecked } });
      _updateKtGroupState(container);
      onFilterChange();
    }
  });

  container.querySelector("#fp-kt-reset").addEventListener("click", () => {
    const types = _currentKommuntyp ? [_currentKommuntyp] : [];
    setState({ filters: { ...state.filters, kommuntyp: types } });
    _syncKtCheckboxes(container, types);
    _updateKtGroupState(container);
    onFilterChange();
  });

  // ── Population slider ─────────────────────────────────────────────────────
  const slider = container.querySelector("#fp-pop-slider");
  slider.addEventListener("input", () => _applyPopSlider(container, onFilterChange));

  container.querySelector("#fp-pop-reset").addEventListener("click", () => {
    slider.value = "0";
    setState({ filters: { ...state.filters, popMin: 0, popMax: Infinity } });
    container.querySelector("#fp-pop-label").textContent = "Ingen begränsning";
    onFilterChange();
  });

  // ── Länsfilter ────────────────────────────────────────────────────────────
  container.querySelector("#fp-lan").addEventListener("change", () => {
    const checked = [...container.querySelectorAll("#fp-lan input:checked")].map(i => i.value);
    setState({ filters: { ...state.filters, lan: checked } });
    _updateLanBadge(container);
    onFilterChange();
  });
}

function _applyPopSlider(container, onFilterChange) {
  const slider = container.querySelector("#fp-pop-slider");
  const label  = container.querySelector("#fp-pop-label");
  const pct    = Number(slider.value);
  if (pct === 0 || _currentPop === 0) {
    setState({ filters: { ...state.filters, popMin: 0, popMax: Infinity } });
    label.textContent = "Ingen begränsning";
  } else {
    const lo = Math.round(_currentPop * (1 - pct / 100));
    const hi = Math.round(_currentPop * (1 + pct / 100));
    setState({ filters: { ...state.filters, popMin: lo, popMax: hi } });
    label.textContent = `±${pct}%  →  ${lo.toLocaleString("sv")}–${hi.toLocaleString("sv")} inv.`;
  }
  if (onFilterChange) onFilterChange();
}

function _updateKtGroupState(container) {
  KOMMUNTYP_GROUPS.forEach(g => {
    const subtypeCbs = [...container.querySelectorAll(".kt-type-cb")].filter(cb => g.types.includes(cb.value));
    const groupCb    = container.querySelector(`.kt-group-cb[data-group="${g.id}"]`);
    if (!groupCb) return;
    const allChecked  = subtypeCbs.every(cb => cb.checked);
    const noneChecked = subtypeCbs.every(cb => !cb.checked);
    groupCb.checked       = allChecked;
    groupCb.indeterminate = !allChecked && !noneChecked;
  });
  _updateKtNote(container);
}

function _syncKtCheckboxes(container, types) {
  container.querySelectorAll(".kt-type-cb").forEach(cb => {
    cb.checked = types.includes(cb.value);
  });
}

function _updateKtNote(container) {
  const note   = container.querySelector("#fp-kt-note");
  if (!note) return;
  const active = [...container.querySelectorAll(".kt-type-cb:checked")].map(i => i.value);
  if (active.length === 0) {
    note.textContent = "Alla kommuntyper inkluderade";
  } else if (_currentKommuntyp && active.length === 1 && active[0] === _currentKommuntyp) {
    note.textContent = "Standard: din kommuntyp";
  } else {
    note.textContent = `${active.length} typ${active.length > 1 ? "er" : ""} valda`;
  }
}

function _updateLanBadge(container) {
  const badge   = container.querySelector("#fp-lan-badge");
  const note    = container.querySelector("#fp-lan-note");
  const checked = [...container.querySelectorAll("#fp-lan input:checked")].map(i => i.value);
  if (badge) {
    badge.textContent   = checked.length;
    badge.style.display = checked.length > 0 ? "" : "none";
  }
  if (note) {
    note.textContent = checked.length > 0
      ? "Obs: kommuner av annan typ i valt/valda län ingår inte — t.ex. kan Stockholm stad (Storstäder) uteslutas om du filtrerar på Pendlingskommun."
      : "";
  }
}

export function updateMuniCard(container, municipalities) {
  if (!state.selected) return;
  const m = municipalities.find(mu => mu.id === state.selected);
  if (!m) return;

  const isMunicipalityChange = state.selected !== _currentSelectedId;
  _currentSelectedId = state.selected;
  _currentPop        = m.population;
  _currentKommuntyp  = m.kommuntyp;

  const nameEl   = container.querySelector("#muni-card-name");
  const badgesEl = container.querySelector("#muni-card-badges");
  const indexEl  = container.querySelector("#muni-card-index");
  const rankEl   = container.querySelector("#muni-card-rank");

  if (rankEl)   rankEl.textContent  = `Rank #${m.rank} av 284`;
  if (nameEl)   nameEl.textContent  = m.name;
  if (indexEl)  indexEl.textContent = m.samlingsindex.toFixed(1);
  if (badgesEl) badgesEl.innerHTML  = `
    <span class="muni-badge">${m.kommuntyp}</span>
    <span class="muni-badge">${m.lan}</span>
    <span class="muni-badge">${m.population.toLocaleString("sv")} inv.</span>
  `;

  // Sync kt checkboxes
  const ktList = container.querySelector("#fp-kommuntyp");
  if (ktList) {
    _syncKtCheckboxes(container, state.filters.kommuntyp);
    _updateKtGroupState(container);
  }

  // Reset population slider ONLY when switching to a different municipality
  if (isMunicipalityChange) {
    const slider = container.querySelector("#fp-pop-slider");
    if (slider) {
      slider.value = "0";
      setState({ filters: { ...state.filters, popMin: 0, popMax: Infinity } });
      const label = container.querySelector("#fp-pop-label");
      if (label) label.textContent = "Ingen begränsning";
    }
  }

  _updateLanBadge(container);
}

export function updatePeerList() {}
