// Vice Tide — Port Solano itself: the road grid, city blocks, buildings,
// palms, beach and sea, plus the spatial helpers every other system uses
// (collision, road lookup for drivers, district names for the HUD).

import { WORLD, AVENUES_X, STREETS_Y, ROAD_HALF, DISTRICTS, BUILDING_COLORS } from './config.js';
import { SeededRandom, clamp } from './random.js';

const BUILDING_NAMES = [
  'Hotel Brisa', 'Solano Bank', 'Café Oleada', 'Marina Suites', 'Palm Court',
  'Tide Records', 'Hotel Miramar', 'Dockside Freight', 'Coral Arcade',
  'Banco del Puerto', 'The Pelican', 'Sunset Gym', 'Harbor Pharmacy',
  'Casa Azul', 'Neon Diner', 'Port Solano Library', 'Vela Apartments',
  'The Lighthouse Club', 'Mercado Central', 'Onda Radio', 'Tidewater Inn',
  'Garage Ochoa', 'Palmera Mall', 'Casa del Faro', 'Brisas Condos',
];

export class World {
  constructor(seed = 20261117) {
    const rng = new SeededRandom(seed);
    this.buildings = [];
    this.palms = [];
    this.lamps = [];
    this.buildBlocks(rng);
    this.buildPalms(rng);
  }

  // Fill every block between roads with one to four buildings, leaving a
  // sidewalk margin. Blocks south of the last street become beach instead.
  buildBlocks(rng) {
    const xs = [-80, ...AVENUES_X, WORLD.width + 80];
    const ys = [-80, ...STREETS_Y, WORLD.beachY];
    let nameIndex = 0;
    for (let xi = 0; xi < xs.length - 1; xi++) {
      for (let yi = 0; yi < ys.length - 1; yi++) {
        const bx = xs[xi] + ROAD_HALF + 14;
        const by = ys[yi] + ROAD_HALF + 14;
        const bw = xs[xi + 1] - xs[xi] - ROAD_HALF * 2 - 28;
        const bh = ys[yi + 1] - ys[yi] - ROAD_HALF * 2 - 28;
        if (bw < 90 || bh < 70) continue;
        const split = rng.chance(0.45) && bw > 200;
        const cols = split ? 2 : 1;
        const rows = rng.chance(0.4) && bh > 150 ? 2 : 1;
        for (let cx = 0; cx < cols; cx++) {
          for (let cy = 0; cy < rows; cy++) {
            const w = (bw - (cols - 1) * 16) / cols;
            const h = (bh - (rows - 1) * 16) / rows;
            const inset = rng.range(2, 10);
            const building = {
              x: bx + cx * (w + 16) + inset,
              y: by + cy * (h + 16) + inset,
              w: w - inset * 2,
              h: h - inset * 2,
              color: rng.pick(BUILDING_COLORS),
              roof: rng.pick(['#b5654a', '#8d6e63', '#a1887f', '#c97b5a', '#7d8a96', '#b08968']),
              floors: rng.int(2, 9),
              name: rng.chance(0.34) ? BUILDING_NAMES[nameIndex++ % BUILDING_NAMES.length] : null,
              windowsSeed: rng.int(1, 99999),
            };
            this.buildings.push(building);
          }
        }
      }
    }
  }

  // Palms line the beach and the avenue sidewalks; lamps dot the corners.
  buildPalms(rng) {
    for (let x = 60; x < WORLD.width - 40; x += rng.range(90, 150)) {
      this.palms.push({ x, y: WORLD.beachY + rng.range(24, 90), size: rng.range(15, 24) });
    }
    for (const ax of AVENUES_X) {
      for (let y = 90; y < WORLD.beachY - 60; y += rng.range(210, 330)) {
        if (STREETS_Y.some((sy) => Math.abs(sy - y) < 70)) continue;
        this.palms.push({ x: ax - ROAD_HALF - 16, y, size: rng.range(12, 19) });
      }
    }
    for (const ax of AVENUES_X) {
      for (const sy of STREETS_Y) {
        this.lamps.push({ x: ax - ROAD_HALF - 8, y: sy - ROAD_HALF - 8 });
        this.lamps.push({ x: ax + ROAD_HALF + 8, y: sy + ROAD_HALF + 8 });
      }
    }
  }

  districtAt(x, y) {
    if (y >= WORLD.waterY) return 'The Open Sea';
    if (y >= WORLD.beachY) return 'Coral Beach';
    for (const d of DISTRICTS) {
      if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d.name;
    }
    return 'Port Solano';
  }

  isWater(x, y) {
    return y >= WORLD.waterY;
  }

  isOnRoad(x, y) {
    if (y >= WORLD.beachY) return false;
    for (const ax of AVENUES_X) if (Math.abs(x - ax) <= ROAD_HALF) return true;
    for (const sy of STREETS_Y) if (Math.abs(y - sy) <= ROAD_HALF) return true;
    return false;
  }

  // Nearest point that lies on the road network, used to (re)seat drivers.
  nearestRoadPoint(x, y) {
    let best = null;
    let bestDist = Infinity;
    for (const ax of AVENUES_X) {
      const d = Math.abs(x - ax);
      if (d < bestDist) { bestDist = d; best = { x: ax, y: clamp(y, 60, WORLD.beachY - 60), vertical: true, line: ax }; }
    }
    for (const sy of STREETS_Y) {
      const d = Math.abs(y - sy);
      if (d < bestDist) { bestDist = d; best = { x: clamp(x, 60, WORLD.width - 60), y: sy, vertical: false, line: sy }; }
    }
    return best;
  }

  // Buildings are solid. A circle (player or car) is pushed out of any
  // building it overlaps; returns true when a push happened.
  collideCircle(pos, radius) {
    let hit = false;
    for (const b of this.buildings) {
      const nx = clamp(pos.x, b.x, b.x + b.w);
      const ny = clamp(pos.y, b.y, b.y + b.h);
      const dx = pos.x - nx;
      const dy = pos.y - ny;
      const d2 = dx * dx + dy * dy;
      if (d2 >= radius * radius) continue;
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        pos.x = nx + (dx / d) * radius;
        pos.y = ny + (dy / d) * radius;
      } else {
        // Centre inside the building: leave by the shortest side.
        const left = pos.x - b.x;
        const right = b.x + b.w - pos.x;
        const top = pos.y - b.y;
        const bottom = b.y + b.h - pos.y;
        const min = Math.min(left, right, top, bottom);
        if (min === left) pos.x = b.x - radius;
        else if (min === right) pos.x = b.x + b.w + radius;
        else if (min === top) pos.y = b.y - radius;
        else pos.y = b.y + b.h + radius;
      }
    }
    // The sea and the world edge are solid too.
    if (pos.y > WORLD.waterY - radius) { pos.y = WORLD.waterY - radius; hit = true; }
    if (pos.x < radius) { pos.x = radius; hit = true; }
    if (pos.x > WORLD.width - radius) { pos.x = WORLD.width - radius; hit = true; }
    if (pos.y < radius) { pos.y = radius; hit = true; }
    return hit;
  }

  buildingsNear(x, y, range) {
    const out = [];
    for (const b of this.buildings) {
      if (b.x - range < x && b.x + b.w + range > x && b.y - range < y && b.y + b.h + range > y) out.push(b);
    }
    return out;
  }
}
