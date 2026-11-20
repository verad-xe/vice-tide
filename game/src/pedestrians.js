// Vice Tide — the people of Port Solano: they stroll the sidewalks and
// the beach, chat in pairs, flee from gunfire and reckless drivers, and
// fall when hit. Mission givers are pedestrians with a job, flagged here.

import { WORLD, STREETS_Y, AVENUES_X, ROAD_HALF } from './config.js';
import { SeededRandom, clamp, distance, angleTo, moveAngle } from './random.js';

const SHIRTS = ['#ff7675', '#74b9ff', '#ffeaa7', '#55efc4', '#fd79a8', '#a29bfe', '#fdcb6e', '#e17055', '#00cec9', '#ffffff'];
const PANTS = ['#2d3436', '#636e72', '#0984e3', '#6c5ce7', '#b2bec3', '#d63031'];

export class Pedestrian {
  constructor(x, y, rng) {
    this.x = x;
    this.y = y;
    this.angle = rng.range(0, Math.PI * 2);
    this.speed = 0;
    this.walkSpeed = rng.range(38, 62);
    this.state = 'walk';        // walk | flee | down | giver | passenger
    this.targetX = x;
    this.targetY = y;
    this.waitTimer = rng.range(0, 3);
    this.fleeTimer = 0;
    this.shirt = rng.pick(SHIRTS);
    this.pants = rng.pick(PANTS);
    this.skin = rng.pick(['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac']);
    this.radius = 10;
    this.role = null;           // mission role: 'giver' | 'passenger' | 'contact'
    this.name = null;
    this.dead = false;
    this.walkCycle = rng.range(0, 6);
  }
}

export class Crowd {
  constructor(world, rng) {
    this.peds = [];
    // Strollers near street corners and along the beach.
    for (let i = 0; i < 46; i++) {
      const onBeach = rng.chance(0.22);
      let x;
      let y;
      if (onBeach) {
        x = rng.range(80, WORLD.width - 80);
        y = rng.range(WORLD.beachY + 30, WORLD.waterY - 50);
      } else {
        const ax = rng.pick(AVENUES_X);
        const sy = rng.pick(STREETS_Y);
        x = ax + (rng.chance(0.5) ? -1 : 1) * (ROAD_HALF + rng.range(10, 60));
        y = sy + (rng.chance(0.5) ? -1 : 1) * (ROAD_HALF + rng.range(10, 60));
      }
      const ped = new Pedestrian(x, y, rng);
      ped.targetX = x + rng.range(-160, 160);
      ped.targetY = y + rng.range(-160, 160);
      this.peds.push(ped);
    }
  }

  addPed(x, y, rng) {
    const ped = new Pedestrian(x, y, rng);
    this.peds.push(ped);
    return ped;
  }

  scare(x, y, range) {
    for (const ped of this.peds) {
      if (ped.state === 'down' || ped.role === 'giver') continue;
      if (distance(x, y, ped.x, ped.y) < range) {
        ped.state = 'flee';
        ped.fleeTimer = 2.4;
        ped.angle = angleTo(x, y, ped.x, ped.y);
      }
    }
  }

  update(game, dt) {
    const rng = game.rng;
    for (const ped of this.peds) {
      if (ped.state === 'down' || ped.state === 'giver') continue;
      ped.walkCycle += dt * (ped.speed > 4 ? 9 : 2);
      // Danger check: a fast car coming close makes anyone run.
      let danger = null;
      for (const car of game.allCars()) {
        if (Math.abs(car.speed) > 120 && distance(car.x, car.y, ped.x, ped.y) < 74) { danger = car; break; }
      }
      if (danger && ped.state !== 'flee') {
        ped.state = 'flee';
        ped.fleeTimer = 1.6;
        ped.angle = angleTo(danger.x, danger.y, ped.x, ped.y);
        if (distance(danger.x, danger.y, ped.x, ped.y) < 46 && game.sound) game.sound.hurt();
      }
      if (ped.state === 'flee') {
        ped.fleeTimer -= dt;
        ped.speed = 168;
        ped.x += Math.cos(ped.angle) * ped.speed * dt;
        ped.y += Math.sin(ped.angle) * ped.speed * dt;
        if (ped.fleeTimer <= 0) { ped.state = 'walk'; ped.speed = 0; }
      } else if (ped.state === 'passenger') {
        // Walk toward the player's car door; main.js picks them up on arrival.
        const car = game.player.car || game.player;
        const d = distance(ped.x, ped.y, car.x, car.y);
        if (d > 26) {
          ped.angle = angleTo(ped.x, ped.y, car.x, car.y);
          ped.speed = 120;
          ped.x += Math.cos(ped.angle) * ped.speed * dt;
          ped.y += Math.sin(ped.angle) * ped.speed * dt;
        } else {
          ped.speed = 0;
        }
      } else {
        // Amble toward a stroll target; pick a new one on arrival.
        const d = distance(ped.x, ped.y, ped.targetX, ped.targetY);
        if (ped.waitTimer > 0) {
          ped.waitTimer -= dt;
          ped.speed = 0;
        } else if (d < 12) {
          ped.targetX = clamp(ped.x + rng.range(-260, 260), 30, WORLD.width - 30);
          ped.targetY = clamp(ped.y + rng.range(-260, 260), 30, WORLD.waterY - 24);
          ped.waitTimer = rng.range(0, 2.5);
          ped.speed = 0;
        } else {
          ped.angle = moveAngle(ped.angle, angleTo(ped.x, ped.y, ped.targetX, ped.targetY), 3.2 * dt);
          ped.speed = ped.walkSpeed;
          ped.x += Math.cos(ped.angle) * ped.speed * dt;
          ped.y += Math.sin(ped.angle) * ped.speed * dt;
        }
      }
      game.world.collideCircle(ped, ped.radius);
      // Run over: a fast car overlapping a pedestrian knocks them down.
      for (const car of game.allCars()) {
        if (Math.abs(car.speed) > 60 && distance(car.x, car.y, ped.x, ped.y) < car.radius + 4) {
          ped.state = 'down';
          ped.dead = true;
          game.onPedestrianHit(ped, car);
          break;
        }
      }
    }
    // Keep the city populated: replace the fallen after a while.
    this.peds = this.peds.filter((p) => !(p.state === 'down' && (p.downTimer = (p.downTimer || 0) + dt) < 14));
    while (this.peds.filter((p) => p.state !== 'down').length < 40) {
      const x = game.rng.range(100, WORLD.width - 100);
      const y = game.rng.range(100, WORLD.beachY - 60);
      this.addPed(x, y, game.rng);
    }
  }
}
