// Dependency-light, offline geocoding tables for the directory's "near me"
// radius filter. We deliberately do NOT call a paid geocoding API at request
// time — families only store a free-text city + state, so we approximate a
// coordinate from these static tables. Accuracy tiers, best → worst:
//   1. exact "city,ST" match in CITY_COORDS (~major US metros)
//   2. state-centroid fallback (STATE_CENTROIDS) — same state, wrong town
//   3. ZIP first-digit region centroid (ZIP1_CENTROIDS) — very coarse, only
//      used for a typed ZIP origin we can't otherwise place
// All coordinates are decimal degrees [latitude, longitude]. This is an
// approximation by design; see PRD/feat-directory-filters.md.

export type LatLng = [number, number];

// State + DC centroids (approximate geographic centers). Keyed by USPS abbr.
export const STATE_CENTROIDS: Record<string, LatLng> = {
  AL: [32.806, -86.791], AK: [61.370, -152.404], AZ: [33.729, -111.431],
  AR: [34.970, -92.373], CA: [36.117, -119.682], CO: [39.059, -105.311],
  CT: [41.598, -72.755], DE: [39.319, -75.507], DC: [38.897, -77.026],
  FL: [27.766, -81.687], GA: [33.040, -83.643], HI: [21.094, -157.498],
  ID: [44.240, -114.478], IL: [40.349, -88.986], IN: [39.849, -86.258],
  IA: [42.011, -93.210], KS: [38.526, -96.726], KY: [37.668, -84.670],
  LA: [31.169, -91.867], ME: [44.693, -69.381], MD: [39.064, -76.802],
  MA: [42.230, -71.530], MI: [43.327, -84.536], MN: [45.694, -93.900],
  MS: [32.741, -89.678], MO: [38.456, -92.288], MT: [46.921, -110.454],
  NE: [41.125, -98.268], NV: [38.313, -117.055], NH: [43.452, -71.564],
  NJ: [40.298, -74.521], NM: [34.841, -106.248], NY: [42.166, -74.948],
  NC: [35.630, -79.806], ND: [47.528, -99.784], OH: [40.388, -82.764],
  OK: [35.565, -96.928], OR: [44.572, -122.071], PA: [40.590, -77.209],
  RI: [41.680, -71.512], SC: [33.856, -80.945], SD: [44.299, -99.438],
  TN: [35.747, -86.692], TX: [31.054, -97.563], UT: [40.150, -111.862],
  VT: [44.045, -72.710], VA: [37.769, -78.170], WA: [47.401, -121.490],
  WV: [38.491, -80.954], WI: [44.268, -89.616], WY: [42.756, -107.302],
};

// Major US cities (city name lowercased + USPS state abbr). Covers the metros
// most likely to appear; everything else falls back to a state centroid.
export const CITY_COORDS: Record<string, LatLng> = {
  "new york,NY": [40.7128, -74.006], "los angeles,CA": [34.0522, -118.2437],
  "chicago,IL": [41.8781, -87.6298], "houston,TX": [29.7604, -95.3698],
  "phoenix,AZ": [33.4484, -112.074], "philadelphia,PA": [39.9526, -75.1652],
  "san antonio,TX": [29.4241, -98.4936], "san diego,CA": [32.7157, -117.1611],
  "dallas,TX": [32.7767, -96.797], "san jose,CA": [37.3382, -121.8863],
  "austin,TX": [30.2672, -97.7431], "jacksonville,FL": [30.3322, -81.6557],
  "fort worth,TX": [32.7555, -97.3308], "columbus,OH": [39.9612, -82.9988],
  "charlotte,NC": [35.2271, -80.8431], "san francisco,CA": [37.7749, -122.4194],
  "indianapolis,IN": [39.7684, -86.1581], "seattle,WA": [47.6062, -122.3321],
  "denver,CO": [39.7392, -104.9903], "washington,DC": [38.9072, -77.0369],
  "boston,MA": [42.3601, -71.0589], "el paso,TX": [31.7619, -106.485],
  "nashville,TN": [36.1627, -86.7816], "detroit,MI": [42.3314, -83.0458],
  "oklahoma city,OK": [35.4676, -97.5164], "portland,OR": [45.5152, -122.6784],
  "las vegas,NV": [36.1699, -115.1398], "memphis,TN": [35.1495, -90.049],
  "louisville,KY": [38.2527, -85.7585], "baltimore,MD": [39.2904, -76.6122],
  "milwaukee,WI": [43.0389, -87.9065], "albuquerque,NM": [35.0844, -106.6504],
  "tucson,AZ": [32.2226, -110.9747], "fresno,CA": [36.7378, -119.7871],
  "sacramento,CA": [38.5816, -121.4944], "kansas city,MO": [39.0997, -94.5786],
  "mesa,AZ": [33.4152, -111.8315], "atlanta,GA": [33.749, -84.388],
  "omaha,NE": [41.2565, -95.9345], "colorado springs,CO": [38.8339, -104.8214],
  "raleigh,NC": [35.7796, -78.6382], "long beach,CA": [33.7701, -118.1937],
  "virginia beach,VA": [36.8529, -75.978], "miami,FL": [25.7617, -80.1918],
  "oakland,CA": [37.8044, -122.2712], "minneapolis,MN": [44.9778, -93.265],
  "tulsa,OK": [36.154, -95.9928], "tampa,FL": [27.9506, -82.4572],
  "new orleans,LA": [29.9511, -90.0715], "wichita,KS": [37.6872, -97.3301],
  "cleveland,OH": [41.4993, -81.6944], "bakersfield,CA": [35.3733, -119.0187],
  "aurora,CO": [39.7294, -104.8319], "anaheim,CA": [33.8366, -117.9143],
  "honolulu,HI": [21.3069, -157.8583], "santa ana,CA": [33.7455, -117.8677],
  "riverside,CA": [33.9806, -117.3755], "corpus christi,TX": [27.8006, -97.3964],
  "lexington,KY": [38.0406, -84.5037], "henderson,NV": [36.0395, -114.9817],
  "stockton,CA": [37.9577, -121.2908], "saint paul,MN": [44.9537, -93.09],
  "cincinnati,OH": [39.1031, -84.512], "st. louis,MO": [38.627, -90.1994],
  "pittsburgh,PA": [40.4406, -79.9959], "greensboro,NC": [36.0726, -79.792],
  "anchorage,AK": [61.2181, -149.9003], "plano,TX": [33.0198, -96.6989],
  "newark,NJ": [40.7357, -74.1724], "durham,NC": [35.994, -78.8986],
  "chula vista,CA": [32.6401, -117.0842], "irvine,CA": [33.6846, -117.8265],
  "fort wayne,IN": [41.0793, -85.1394], "jersey city,NJ": [40.7178, -74.0431],
  "chandler,AZ": [33.3062, -111.8413], "madison,WI": [43.0731, -89.4012],
  "buffalo,NY": [42.8864, -78.8784], "gilbert,AZ": [33.3528, -111.789],
  "reno,NV": [39.5296, -119.8138], "boise,ID": [43.615, -116.2023],
  "richmond,VA": [37.5407, -77.436], "san bernardino,CA": [34.1083, -117.2898],
  "spokane,WA": [47.6588, -117.426], "des moines,IA": [41.5868, -93.625],
  "salt lake city,UT": [40.7608, -111.891], "providence,RI": [41.824, -71.4128],
  "huntsville,AL": [34.7304, -86.586], "birmingham,AL": [33.5186, -86.8104],
  "knoxville,TN": [35.9606, -83.9207], "worcester,MA": [42.2626, -71.8023],
  "little rock,AR": [34.7465, -92.2896], "grand rapids,MI": [42.9634, -85.6681],
  "salem,OR": [44.9429, -123.0351], "eugene,OR": [44.0521, -123.0868],
  "palo alto,CA": [37.4419, -122.143], "mountain view,CA": [37.3861, -122.0839],
  "berkeley,CA": [37.8715, -122.273], "pasadena,CA": [34.1478, -118.1445],
  "cambridge,MA": [42.3736, -71.1097], "ann arbor,MI": [42.2808, -83.743],
  "boulder,CO": [40.015, -105.2705], "scottsdale,AZ": [33.4942, -111.9261],
  "naperville,IL": [41.7508, -88.1535], "bellevue,WA": [47.6101, -122.2015],
  "frisco,TX": [33.1507, -96.8236], "cary,NC": [35.7915, -78.7811],
};

// Coarse first-digit ZIP region centroids — the standard USPS ZIP zones. Used
// ONLY as a last resort for a typed ZIP we can't otherwise place. Very rough.
export const ZIP1_CENTROIDS: Record<string, LatLng> = {
  "0": [42.3, -71.5],  // New England / NJ
  "1": [41.0, -76.5],  // NY / PA
  "2": [38.0, -78.5],  // DC / VA / Carolinas
  "3": [31.0, -84.0],  // Southeast / FL
  "4": [40.0, -84.5],  // Great Lakes (OH/MI/IN/KY)
  "5": [44.5, -94.0],  // Upper Midwest (MN/WI/IA/Dakotas/MT)
  "6": [38.5, -94.5],  // Central plains (IL/MO/KS/NE)
  "7": [31.0, -95.5],  // South central (TX/OK/AR/LA)
  "8": [39.0, -110.0], // Mountain West
  "9": [38.0, -121.0], // West coast / HI / AK
};
