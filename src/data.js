export let municipalities = [];
export let byId = new Map();

export async function loadData() {
  const res = await fetch("data/data.json");
  if (!res.ok) throw new Error(`Failed to load data.json: ${res.status}`);
  const json = await res.json();
  // Flatten indicators to top-level properties for beeswarm compatibility
  municipalities = json.municipalities.map(m => ({ ...m, ...(m.indicators || {}) }));
  byId = new Map(municipalities.map(m => [m.id, m]));
  return { municipalities, byId, meta: json };
}

export const SECTORS = [
  { key: "samlingsindex",       label: "Samlingsindex",  domain: [25, 100] },
  { key: "index_forskola",      label: "Förskola",       domain: [1, 4]   },
  { key: "index_fritid",        label: "Fritid",         domain: [1, 4]   },
  { key: "index_grundskola",    label: "Grundskola",     domain: [1, 4]   },
  { key: "index_kultur",        label: "Kultur",         domain: [1, 5]   },
  { key: "index_socialtjanst",  label: "Socialtjänst",   domain: [1, 4]   },
];

export const INDICATORS = {
  index_forskola: [
    { key: "kostnad_forskola",     label: "Kostnad per inskrivet barn",        unit: "kr",            invert: true,  desc: "Nettokostnad förskola per inskrivet barn" },
    { key: "barn_grupp_1_3",       label: "Barn per grupp (1–3 år)",           unit: "barn",          invert: true,  desc: "Genomsnittligt antal barn per avdelning för åldrarna 1–3 år" },
    { key: "barn_grupp_4_5",       label: "Barn per grupp (4–5 år)",           unit: "barn",          invert: true,  desc: "Genomsnittligt antal barn per avdelning för åldrarna 4–5 år" },
    { key: "forskollarartathet",   label: "Förskollärartäthet",                unit: "/ 100 barn",    invert: false, desc: "Antal förskollärare per 100 inskrivna barn" },
    { key: "inskrivna_forskola",   label: "Inskrivna i förskola",              unit: "%",             invert: false, desc: "Andel barn 1–5 år inskrivna i kommunal förskola" },
  ],
  index_grundskola: [
    { key: "kostnad_grundskola",   label: "Kostnad per elev",                  unit: "kr",            invert: true,  desc: "Nettokostnad grundskola per elev" },
    { key: "elev_larare",          label: "Elever per lärare",                 unit: "elever",        invert: true,  desc: "Antal elever per lärare i grundskolan" },
    { key: "behoriga_larare",      label: "Behöriga lärare",                   unit: "%",             invert: false, desc: "Andel legitimerade och behöriga lärare i grundskolan" },
    { key: "fritidshem_examen",    label: "Personal m. lärarexamen (fritids)", unit: "%",             invert: false, desc: "Andel personal i fritidshem med lärarexamen" },
    { key: "kostnad_elevhalsa",    label: "Kostnad elevhälsa per elev",        unit: "kr",            invert: true,  desc: "Nettokostnad elevhälsa per elev" },
  ],
  index_fritid: [
    { key: "kostnad_fritidshem",   label: "Kostnad fritidshem per inskriven",  unit: "kr",            invert: true,  desc: "Nettokostnad fritidshem per inskrivet barn" },
    { key: "kostnad_fritid",       label: "Kostnad fritidsverksamhet",         unit: "kr/inv",        invert: false, desc: "Nettokostnad öppen fritidsverksamhet per invånare" },
    { key: "idrottshallar",        label: "Idrottshallar",                     unit: "/ 10 000 inv",  invert: false, desc: "Antal idrottshallar per 10 000 invånare" },
    { key: "deltagartillfallen",   label: "Deltagartillfällen LOK",            unit: "/ 10–25-åring", invert: false, desc: "Deltagartillfällen via LOK-stöd per invånare 10–25 år" },
  ],
  index_kultur: [
    { key: "kostnad_kultur",       label: "Kostnad kultur",                    unit: "kr/inv",        invert: false, desc: "Nettokostnad kultur per invånare" },
    { key: "bibliotek_aktiviteter",label: "Biblioteksaktiviteter",             unit: "/ 1 000 inv",   invert: false, desc: "Aktiviteter och arrangemang på folkbibliotek per 1 000 invånare" },
    { key: "oppethallande_bibliotek",label: "Bibliotekens öppettider",         unit: "h/år",          invert: false, desc: "Total öppethållandetid för folkbiblioteken, timmar per år" },
  ],
  index_socialtjanst: [
    { key: "kostnad_oppna_insatser",label: "Öppna insatser (0–20 år)",         unit: "kr/inv",        invert: false, desc: "Kostnad för öppna insatser per invånare 0–20 år" },
    { key: "utredningstid",         label: "Utredningstid",                    unit: "dagar",         invert: true,  desc: "Genomsnittlig utredningstid för barnärenden i socialtjänsten" },
    { key: "handlaggare_socionom",  label: "Handläggare m. socionomexamen",   unit: "%",             invert: false, desc: "Andel handläggare med socionomexamen" },
  ],
};

// Flat lookup: indicatorKey → metadata
export const INDICATOR_BY_KEY = Object.fromEntries(
  Object.values(INDICATORS).flat().map(ind => [ind.key, ind])
);

// Three visual groups: Städer · Pendlingskommuner · Landsbygdskommuner
export const KOMMUNTYP_GROUPS = [
  {
    id: "stader",
    label: "Städer",
    color: "#4899C8",
    types: ["Storstäder", "Större stad", "Mindre stad/tätort"],
  },
  {
    id: "pendling",
    label: "Pendlingskommuner",
    color: "#D48B00",
    types: [
      "Pendlingskommun nära storstad",
      "Pendlingskommun nära större stad",
      "Lågpendlingskommun nära större stad",
      "Pendlingskommun nära mindre tätort",
    ],
  },
  {
    id: "landsbygd",
    label: "Landsbygdskommuner",
    color: "#6A9E6A",
    types: ["Landsbygdskommun", "Landsbygdskommun med besöksnäring"],
  },
];

export const KOMMUNTYP_COLOR = Object.fromEntries(
  KOMMUNTYP_GROUPS.flatMap(g => g.types.map(t => [t, g.color]))
);

export const KOMMUNTYP_ORDER = KOMMUNTYP_GROUPS.flatMap(g => g.types);

// Quick lookup: type string → group object
export const KOMMUNTYP_GROUP_FOR = Object.fromEntries(
  KOMMUNTYP_GROUPS.flatMap(g => g.types.map(t => [t, g]))
);
