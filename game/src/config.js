// Vice Tide — shared tuning constants for the city of Port Solano.
// Every other module imports from here so the whole game can be rebalanced
// by editing one file: world size, road layout, prices, police pressure.

export const WORLD = {
  width: 3200,
  height: 2400,
  beachY: 2050,      // sand starts here
  waterY: 2240,      // open water starts here; nobody drives into the sea
};

// Avenues run north-south, streets run east-west. Cars drive on these lines.
export const AVENUES_X = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000];
export const STREETS_Y = [180, 540, 900, 1260, 1620, 1980];
export const ROAD_HALF = 46;        // half the width of a road, in pixels
export const LANE_OFFSET = 23;      // right-hand traffic lane offset

export const DISTRICTS = [
  { name: 'Old Town', x: 0, y: 0, w: 1200, h: 1080 },
  { name: 'Palms Row', x: 1200, y: 0, w: 1200, h: 1080 },
  { name: 'Dockyards', x: 2400, y: 0, w: 800, h: 1080 },
  { name: 'Solano Heights', x: 0, y: 1080, w: 1200, h: 970 },
  { name: 'Coral Bay', x: 1200, y: 1080, w: 1200, h: 970 },
  { name: 'Marina', x: 2400, y: 1080, w: 800, h: 970 },
];

export const PLAYER = {
  radius: 13,
  walkSpeed: 178,
  sprintSpeed: 272,
  maxHealth: 100,
  startCash: 120,
  startX: 1420,
  startY: 1700,
};

export const WANTED = {
  heatPerStar: 100,
  maxStars: 5,
  decayPerSecond: 6,        // heat lost while the police have lost sight
  hiddenSeconds: 6,         // unseen for this long before decay starts
  sightRange: 470,          // police "see" the player inside this distance
  bustSeconds: 2.6,         // stood still next to police this long = busted
};

export const WEAPON = {
  name: 'Harbor Pistol',
  magazine: 12,
  reloadSeconds: 0.95,
  fireSeconds: 0.16,
  bulletSpeed: 940,
  bulletRange: 560,
  damage: 34,
};

export const COLORS = {
  water: '#1d7fa8',
  waterDeep: '#166b91',
  sand: '#ecd28f',
  sandDark: '#dfc078',
  grass: '#79b657',
  grassDark: '#6aa84e',
  sidewalk: '#cfd4d6',
  road: '#3c4148',
  roadLine: '#f4e9c8',
  crosswalk: '#e8ecec',
};

export const CAR_COLORS = [
  '#e74c3c', '#f39c12', '#f5f0e6', '#3498db', '#9b59b6', '#1abc9c',
  '#e67e22', '#95a5a6', '#fd79a8', '#00b894', '#6c5ce7', '#dfe6e9',
];

export const BUILDING_COLORS = [
  '#f6d8a8', '#f2b8c6', '#a8d8ea', '#ffeaa7', '#dfe6e9', '#fab1a0',
  '#81ecec', '#ffe8d6', '#fdcb6e', '#e0f2f1', '#f7e7ce', '#ffd1dc',
];

export const SAVE_KEY = 'vice-tide-save-v1';
export const FIXED_STEP = 1 / 60;
