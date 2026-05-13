// D3 beeswarm strip component. Creates/updates a single horizontal beeswarm.
// Caches force-simulation layout keyed by (sectorKey, filterHash).

import { KOMMUNTYP_COLOR } from "./data.js";

const layoutCache = new Map();

function cacheKey(sectorKey, ids, innerW) {
  return `${sectorKey}:${Math.round(innerW)}:${ids.slice().sort().join(",")}`;
}

export function createBeeswarm(container, {
  data,          // full municipalities array
  sectorKey,     // e.g. "samlingsindex"
  label,         // human-readable label for aria-label
  domain,        // [min, max]
  width,
  height = 110,
  radius = 4.5,
  selectedId,
  peerIds,       // Set of peer ids
  onSelect,      // callback(id)
}) {
  const margin = { left: 10, right: 10, top: 20, bottom: 24 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  // Auto-compute domain from data when not provided (e.g. indicator drill-down)
  let effectiveDomain = domain;
  if (!effectiveDomain) {
    const vals = data.map(m => m[sectorKey]).filter(v => v != null).sort(d3.ascending);
    const lo = d3.quantile(vals, 0.02) ?? vals[0];
    const hi = d3.quantile(vals, 0.98) ?? vals[vals.length - 1];
    const pad = (hi - lo) * 0.08 || 1;
    effectiveDomain = [lo - pad, hi + pad];
  }

  const x = d3.scaleLinear().domain(effectiveDomain).range([0, innerW]).clamp(true);

  // Only simulate nodes that have data for this sector
  const nodes = data
    .filter(m => m[sectorKey] != null)
    .map(m => ({
      id: m.id,
      xTarget: x(m[sectorKey]),
      y: innerH / 2,
      kommuntyp: m.kommuntyp,
      name: m.name,
      value: m[sectorKey],
    }));

  // Cache simulation result (keyed by width so resize invalidates old positions)
  const key = cacheKey(sectorKey, nodes.map(n => n.id), innerW);
  if (!layoutCache.has(key)) {
    const sim = d3.forceSimulation(nodes)
      .force("x", d3.forceX(d => d.xTarget).strength(0.9))
      .force("y", d3.forceY(innerH / 2).strength(0.1))
      .force("collide", d3.forceCollide(radius + 0.5))
      .stop();
    for (let i = 0; i < 200; i++) sim.tick();
    // Clamp to inner bounds
    nodes.forEach(n => {
      n.x = Math.max(radius, Math.min(innerW - radius, n.x));
      n.y = Math.max(radius, Math.min(innerH - radius, n.y));
    });
    layoutCache.set(key, nodes.map(n => ({ id: n.id, x: n.x, y: n.y })));
  }

  // Apply cached positions
  const positions = new Map(layoutCache.get(key).map(p => [p.id, p]));
  nodes.forEach(n => {
    const pos = positions.get(n.id);
    if (pos) { n.x = pos.x; n.y = pos.y; }
  });

  // Build SVG if not present, otherwise reuse
  let svg = d3.select(container).select("svg.beeswarm-svg");
  if (svg.empty()) {
    svg = d3.select(container)
      .append("svg")
      .attr("class", "beeswarm-svg")
      .attr("role", "figure")
      .attr("aria-label", `Fördelning: ${label || sectorKey}`);
  }
  svg.attr("width", width).attr("height", height);

  let g = svg.select("g.beeswarm-inner");
  if (g.empty()) {
    g = svg.append("g").attr("class", "beeswarm-inner");
  }
  g.attr("transform", `translate(${margin.left},${margin.top})`);

  // X-axis
  let axisG = g.select("g.x-axis");
  if (axisG.empty()) axisG = g.append("g").attr("class", "x-axis");
  axisG.attr("transform", `translate(0,${innerH + 4})`);
  const tickCount = width < 400 ? 4 : 6;
  axisG.call(d3.axisBottom(x).ticks(tickCount).tickSize(3));
  axisG.select(".domain").remove();
  axisG.selectAll("line").attr("stroke", "#ccc");
  axisG.selectAll("text").attr("font-size", "10px").attr("fill", "#666");

  // Dots
  const peerSet = peerIds instanceof Set ? peerIds : new Set(peerIds || []);

  const dots = g.selectAll("circle.dot").data(nodes, d => d.id);

  dots.exit().remove();

  const dotsEnter = dots.enter()
    .append("circle")
    .attr("class", "dot")
    .attr("r", radius)
    .attr("tabindex", -1)
    .on("click", (event, d) => onSelect && onSelect(d.id))
    .on("keydown", (event, d) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onSelect && onSelect(d.id);
      }
    });

  const dotsAll = dotsEnter.merge(dots);

  dotsAll
    .attr("cx", d => d.x)
    .attr("cy", d => d.y)
    .attr("fill", d => {
      if (d.id === selectedId) return "#111";
      return KOMMUNTYP_COLOR[d.kommuntyp] || "#aaa";
    })
    .attr("stroke", d => {
      if (d.id === selectedId) return "#111";
      if (peerSet.has(d.id)) return "#333";
      return "rgba(0,0,0,0.18)"; // thin outline for all dots — critical for yellow (#F0E442) on white
    })
    .attr("stroke-width", d => {
      if (d.id === selectedId) return 0;
      if (peerSet.has(d.id)) return 1.5;
      return 0.5;
    })
    .attr("opacity", d => {
      if (d.id === selectedId) return 1;
      if (peerSet.size > 0 && !peerSet.has(d.id)) return 0.25;
      return 0.8;
    })
    .attr("r", d => d.id === selectedId ? radius + 2 : radius)
    .attr("aria-label", d => `${d.name}: ${d.value}`);

  // Selected municipality star marker (diamond)
  g.selectAll("path.selected-marker").remove();
  if (selectedId) {
    const sel = nodes.find(n => n.id === selectedId);
    if (sel) {
      const sz = radius + 3;
      g.append("path")
        .attr("class", "selected-marker")
        .attr("d", d3.symbol().type(d3.symbolDiamond).size(sz * sz * 2)())
        .attr("transform", `translate(${sel.x},${sel.y})`)
        .attr("fill", "#111")
        .attr("stroke", "white")
        .attr("stroke-width", 1.5)
        .attr("pointer-events", "none");
    }
  }

  return { svg, nodes };
}
