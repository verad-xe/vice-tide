// Vice Tide — cars: the vehicle entity, driving physics for the player,
// traffic AI that cruises the road grid, and parked cars waiting to be
// stolen. Police cars live in police.js but share this physics.

import { WORLD, AVENUES_X, STREETS_Y, LANE_OFFSET, CAR_COLORS } from './config.js';
import { SeededRandom, clamp, angleTo, moveAngle, distance } from './random.js';

const CAR_TYPES = [
  { kind: 'compact', w: 48, h: 25, maxSpeed: 330, accel: 250, grip: 3.4 },
  { kind: 'sedan', w: 53, h: 26, maxSpeed: 360, accel: 265, grip: 3.2 },
  { kind: 'taxi', w: 53, h: 26, maxSpeed: 350, accel: 260, grip: 3.2, color: '#f7b731' },
  { kind: 'sport', w: 53, h: 25, maxSpeed: 470, accel: 360, grip: 3.8 },
  { kind: 'van', w: 60, h: 28, maxSpeed: 300, accel: 220, grip: 2.8 },
  { kind: 'pickup', w: 57, h: 27, maxSpeed: 330, accel: 245, grip: 3.0 },
];

export class Car {
  constructor(x, y, angle, type, color) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.type = type;
    this.w = type.w;
    this.h = type.h;
    this.color = color;
    this.speed = 0;
    this.health = 100;
    this.driver = null;        // 'traffic' | 'player' | 'police' | null (parked)
    this.parked = false;
    this.stolen = false;
    this.wrecked = false;
    this.hornTimer = 0;
    // Traffic AI state: follow one road line, maybe turn at crossings.
    this.roadVertical = Math.abs(Math.sin(angle)) < 0.5 ? false : true;
    this.roadLine = 0;
    this.aiSpeed = type.maxSpeed * 0.45;
    this.aiPause = 0;
  }

  get radius() {
    return this.w * 0.46;
  }
}

// Shared arcade physics step used by the player, traffic and police.
// steerInput in [-1, 1]; throttleInput in [-1, 1] (negative = reverse).
export function stepCarPhysics(car, dt, throttleInput, steerInput, handbrake) {
  const accel = car.type.accel;
  if (throttleInput > 0) car.speed += accel * throttleInput * dt;
  else if (throttleInput < 0) {
    if (car.speed > 12) car.speed -= accel * 1.5 * dt;      // braking
    else car.speed += accel * 0.55 * throttleInput * dt;   // reverse
  } else {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 90 * dt); // engine drag
  }
  if (handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 420 * dt);
  car.speed -= car.speed * (handbrake ? 0.25 : 0.55) * dt;  // rolling drag
  const maxReverse = -car.type.maxSpeed * 0.32;
  car.speed = clamp(car.speed, maxReverse, car.type.maxSpeed);
  const steerAuthority = clamp(Math.abs(car.speed) / 120, 0, 1) * (handbrake ? 1.5 : 1);
  const turnRate = car.type.grip * steerAuthority;
  if (Math.abs(car.speed) > 1) {
    car.angle += steerInput * turnRate * dt * Math.sign(car.speed);
  }
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
}

// Decide which road line a car sits on, so traffic can follow it.
function adoptRoad(world, car) {
  const near = world.nearestRoadPoint(car.x, car.y);
  if (!near) return;
  car.roadVertical = near.vertical;
  car.roadLine = near.line;
}

export class Traffic {
  constructor(world, rng) {
    this.cars = [];
    this.rng = rng;
    // Cruising traffic, seated on random road lines.
    for (let i = 0; i < 26; i++) {
      const type = CAR_TYPES[rng.int(0, CAR_TYPES.length - 1)];
      const vertical = rng.chance(0.5);
      const line = vertical ? rng.pick(AVENUES_X) : rng.pick(STREETS_Y);
      const along = vertical ? rng.range(120, WORLD.beachY - 120) : rng.range(120, WORLD.width - 120);
      const dir = rng.chance(0.5) ? 1 : -1;
      const x = vertical ? line + LANE_OFFSET * dir : along;
      const y = vertical ? along : line + (vertical ? 0 : LANE_OFFSET * (dir > 0 ? 1 : -1));
      const angle = vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
      const car = new Car(x, vertical ? along : y, angle, type, type.color || rng.pick(CAR_COLORS));
      car.driver = 'traffic';
      car.roadVertical = vertical;
      car.roadLine = line;
      car.aiSpeed = type.maxSpeed * rng.range(0.34, 0.5);
      car.speed = car.aiSpeed * dir * (vertical ? Math.sin(angle) : Math.cos(angle)) >= 0 ? car.aiSpeed : -car.aiSpeed;
      car.speed = car.aiSpeed;
      this.cars.push(car);
    }
    // Parked cars along the blocks: the stealable ones.
    for (let i = 0; i < 16; i++) {
      const type = CAR_TYPES[rng.int(0, CAR_TYPES.length - 1)];
      const vertical = rng.chance(0.5);
      const line = vertical ? rng.pick(AVENUES_X) : rng.pick(STREETS_Y);
      const along = vertical ? rng.range(150, WORLD.beachY - 150) : rng.range(150, WORLD.width - 150);
      const side = rng.chance(0.5) ? 1 : -1;
      const x = vertical ? line + (ROAD_PARK_EDGE) * side : along;
      const y = vertical ? along : line + (ROAD_PARK_EDGE) * side;
      const angle = vertical ? Math.PI / 2 : 0;
      const car = new Car(x, y, angle, type, type.color || rng.pick(CAR_COLORS));
      car.parked = true;
      car.roadVertical = vertical;
      car.roadLine = line;
      this.cars.push(car);
    }
  }

  // One traffic brain tick: follow the lane, slow for the car ahead,
  // sometimes turn at a crossing, respawn far-away wrecks as fresh cars.
  update(game, dt) {
    const world = game.world;
    for (const car of this.cars) {
      if (car.driver !== 'traffic' || car.wrecked) continue;
      car.hornTimer = Math.max(0, car.hornTimer - dt);
      // Desired heading along the current road line, in the right lane.
      let targetAngle;
      let laneX = car.x;
      let laneY = car.y;
      if (car.roadVertical) {
        const dir = Math.sin(car.angle) >= 0 ? 1 : -1;
        laneX = car.roadLine + laneOffsetFor(car);
        targetAngle = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        const dir = Math.cos(car.angle) >= 0 ? 1 : -1;
        laneY = car.roadLine + laneOffsetFor(car);
        targetAngle = dir > 0 ? 0 : Math.PI;
      }
      // Slow down when something is right in front.
      let desired = car.aiSpeed;
      const aheadX = car.x + Math.cos(car.angle) * 64;
      const aheadY = car.y + Math.sin(car.angle) * 64;
      for (const other of game.allCars()) {
        if (other === car) continue;
        if (distance(aheadX, aheadY, other.x, other.y) < 40) { desired = 0; break; }
      }
      if (game.player.car === null && distance(aheadX, aheadY, game.player.x, game.player.y) < 34) desired = 0;
      if (car.aiPause > 0) { car.aiPause -= dt; desired = 0; }
      // Steer toward the lane point, then run the shared physics.
      const steerTarget = angleTo(car.x, car.y, laneX + Math.cos(targetAngle) * 120, laneY + Math.sin(targetAngle) * 120);
      const steer = clamp((steerTarget - car.angle) * 2.2, -1, 1);
      const throttle = car.speed < desired ? 0.75 : -0.4;
      stepCarPhysics(car, dt, desired === 0 && car.speed < 4 ? -0.2 : throttle, steer, false);
      if (desired === 0 && Math.abs(car.speed) < 6) car.speed = 0;
      // At a crossing, sometimes pick the crossing road.
      this.maybeTurn(game, car);
      // Collisions with the solid world: the push-out in collideCircle
      // leaves the car beside the wall; just kill its speed into it.
      if (world.collideCircle(car, car.radius)) {
        car.speed *= -0.25;
        adoptRoad(world, car);
      }
    }
    this.separateCars(game);
  }

  maybeTurn(game, car) {
    const lines = car.roadVertical ? STREETS_Y : AVENUES_X;
    const pos = car.roadVertical ? car.y : car.x;
    for (const line of lines) {
      if (Math.abs(pos - line) < 6 && !car.justTurned) {
        if (this.rng.chance(0.4)) {
          car.roadVertical = !car.roadVertical;
          car.roadLine = line;
          car.justTurned = true;
          const dir = this.rng.chance(0.5) ? 1 : -1;
          car.angle = car.roadVertical
            ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2)
            : (dir > 0 ? 0 : Math.PI);
          car.x = car.roadVertical ? line + laneOffsetFor(car) : car.x;
          car.y = car.roadVertical ? car.y : line + laneOffsetFor(car);
        }
        car.justTurned = true;
      }
    }
    if (car.justTurned && !lines.some((line) => Math.abs(pos - line) < 10)) car.justTurned = false;
    // Keep traffic inside the city: turn around at the edges.
    if (car.y > WORLD.beachY - 70 && car.roadVertical && Math.sin(car.angle) > 0) car.angle = -Math.PI / 2;
    if (car.y < 70 && car.roadVertical && Math.sin(car.angle) < 0) car.angle = Math.PI / 2;
    if (car.x > WORLD.width - 70 && !car.roadVertical && Math.cos(car.angle) > 0) car.angle = Math.PI;
    if (car.x < 70 && !car.roadVertical && Math.cos(car.angle) < 0) car.angle = 0;
  }

  // Gentle pairwise separation so traffic does not stack into one blob,
  // and real bumps register as crashes (noise, damage, a little heat).
  separateCars(game) {
    const cars = game.allCars();
    for (let i = 0; i < cars.length; i++) {
      for (let j = i + 1; j < cars.length; j++) {
        const a = cars[i];
        const b = cars[j];
        const d = distance(a.x, a.y, b.x, b.y);
        const min = (a.radius + b.radius) * 0.92;
        if (d <= 0.01 || d >= min) continue;
        const push = (min - d) / 2;
        const nx = (b.x - a.x) / d;
        const ny = (b.y - a.y) / d;
        const aMover = a.driver !== null;
        const bMover = b.driver !== null;
        if (aMover) { a.x -= nx * push; a.y -= ny * push; }
        if (bMover) { b.x += nx * push; b.y += ny * push; }
        const impact = Math.abs(a.speed - b.speed);
        if (impact > 130) {
          a.health -= 6; b.health -= 6;
          if (a === game.player.car || b === game.player.car) {
            game.onCarCrash(impact);
          }
          a.speed *= 0.55; b.speed *= 0.55;
        }
      }
    }
  }
}

// Parked cars sit on the asphalt near the kerb: far enough out of the
// lane to miss traffic, close enough in to clear the buildings.
const ROAD_PARK_EDGE = 26;

// Right-hand traffic: when heading "forward" along a line, the lane sits
// to the driver's right. Expressed against the line coordinate.
export function laneOffsetFor(car) {
  if (car.roadVertical) {
    // Heading south (+y) drives on the west lane, north on the east lane.
    return Math.sin(car.angle) > 0 ? -LANE_OFFSET : LANE_OFFSET;
  }
  // Heading east (+x) drives on the south lane, west on the north lane.
  return Math.cos(car.angle) > 0 ? LANE_OFFSET : -LANE_OFFSET;
}

export function makeParkedCar(rng, x, y, angle) {
  const type = CAR_TYPES[rng.int(0, CAR_TYPES.length - 1)];
  const car = new Car(x, y, angle, type, type.color || rng.pick(CAR_COLORS));
  car.parked = true;
  return car;
}

export { CAR_TYPES };
