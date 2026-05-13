# UNICEF Sverige — Kommunrapport 2026 Peer Benchmark

Interaktivt peer-benchmark-verktyg för UNICEF Sveriges Kommunrapport 2026. Jämför valfri kommuns resultat på barns välfärd mot statistiskt relevanta peer-kommuner.

**Live:** [unicef-se.github.io/kommunrapport-peer-benchmark](https://unicef-se.github.io/kommunrapport-peer-benchmark)

## Vad verktyget gör

- Rangordnar alla 284 svenska kommuner på 5 sektorer × 20 indikatorer (data från Kolada)
- Visar kommunens position i en beeswarm-distributionsvy mot valda peer-kommuner
- Peer-grupp filtreras på kommuntyp (SKR), befolkningsstorlek och län
- Drill-down till alla 20 indikatorer per sektor
- Delbar URL, CSV-export och PNG-export

## Stack

Vanilla JS + D3 v7 via CDN. Inga byggseg — öppna `index.html` via en lokal HTTP-server.

```bash
python3 -m http.server 3457
# → http://localhost:3457
```

## Filstruktur

```
index.html          Applikationens ingångspunkt
styles.css          All styling
app.js              Entry point — state, routing, rendering
src/
  data.js           Datainläsning och KPI-metadata
  beeswarm.js       D3 force-simulation beeswarm-komponent
  filters.js        Kommuntyp-, storleks- och länsfilter
  table.js          Sorterbar tabellvy + CSV-export
  state.js          Central appstate + URL-hash-synk
data/
  data.json         284 kommuner × 20 indikatorer + index (genererad)
  kommuntyp_lan.json SKR-klassificering per kommun
  kpi_mapping.json  Indikator → Kolada KPI-ID
scripts/            Python-skript för datahämtning (ej del av appen)
```

## Uppdatera data

Data hämtas från [Kolada API](https://api.kolada.se) via Python-skriptet:

```bash
cd scripts
pip install -r requirements.txt
python fetch_kolada.py
```

Ersätt sedan `data/data.json` med den genererade filen.

## Deploy (GitHub Pages)

1. Pusha repot till GitHub
2. Settings → Pages → Deploy from branch `main` / root
3. Valfritt: koppla en anpassad domän (t.ex. `kommunrapport.unicef.se`)
