// Central application state. All components read from and write to this module.
export const state = {
  selected: null,       // municipality id string
  peers: [],            // array of municipality ids in current peer group
  filters: {
    kommuntyp: [],      // [] = all
    lan: [],
    popMin: 0,
    popMax: Infinity,
  },
  expandedSector: null, // sector key or null
  view: "beeswarm",     // "beeswarm" | "table"
};

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setState(patch) {
  Object.assign(state, patch);
  listeners.forEach(fn => fn(state));
}

export function computePeers(municipalities, selectedId = state.selected) {
  if (!selectedId) return [];
  const sel = municipalities.find(m => m.id === selectedId);
  if (!sel) return [];

  let pool = [...municipalities];

  // Apply kommuntyp filter ([] = no filter = all types; smart default is set explicitly on selectMunicipality)
  if (state.filters.kommuntyp.length > 0) {
    pool = pool.filter(m => state.filters.kommuntyp.includes(m.kommuntyp));
  }

  // Apply population band only when explicitly set by user
  if (state.filters.popMin > 0) {
    pool = pool.filter(m => m.population >= state.filters.popMin);
  }
  if (state.filters.popMax < Infinity) {
    pool = pool.filter(m => m.population <= state.filters.popMax);
  }

  // Apply länsfilter
  if (state.filters.lan.length > 0) {
    pool = pool.filter(m => state.filters.lan.includes(m.lan));
  }

  return pool.map(m => m.id);
}
