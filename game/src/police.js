// Vice Tide — the Port Solano police: wanted heat, stars, patrol cruisers
// that hunt the player, ram them, and try to box them in; plus the bust
// pressure that builds when officers close in on a player on foot.

import { WORLD, WANTED } from './config.js';
import { clamp, distance, angleTo } from './random.js';
import { Car, stepCarPhysics } from './vehicles.js';

const POLICE_TYPE = { kind: 'cruiser', w: 47, h: 23, maxSpeed: 430, accel: 330, grip: 3.6 };

export class Police {
  constructor() {
    this.cruisers = [];
    this.heat = 0;              // 0..500; one star per 100
    this.unseenTimer = 0;       // seconds since any cruiser saw the player
    this.bustMeter = 0;         // 0..1 while officers crowd a player on foot
  }

  get stars() {
    return Math.min(WANTED.maxStars, Math.ceil(this.heat / WANTED.heatPerStar));
  }

  addHeat(points, game) {
    const before = this.stars;
    this.heat = clamp(this.heat + points, 0, WANTED.heatPerStar * WANTED.maxStars);
    if (this.stars > before && game && game.sound) game.sound.pickup();
  }

  cruiserCount() {
    return this.cruisers.length;
  }

  // Spawn cruisers at road points away from the player, up to the number
  // the wanted level calls for; retire the far ones when the heat dies.
  syncCruisers(game) {
    const wanted = this.stars === 0 ? 0 : Math.min(6, this.stars + 1);
    while (this.cruisers.length < wanted) {
      const spot = game.world.nearestRoadPoint(
        game.player.x + game.rng.range(-900, 900),
        game.player.y + game.rng.range(-900, 900),
      );
      if (!spot) break;
      if (distance(spot.x, spot.y, game.player.x, game.player.y) < 300) continue;
      const angle = spot.vertical ? Math.PI / 2 : 0;
      const car = new Car(spot.x, spot.y, angle, POLICE_TYPE, '#f4f6f7');
      car.driver = 'police';
      car.isPolice = true;
      car.roadVertical = spot.vertical;
      car.roadLine = spot.line;
      this.cruisers.push(car);
    }
    if (this.stars === 0) {
      // Heat is gone: cruisers peel away and despawn with distance.
      this.cruisers = this.cruisers.filter((c) => distance(c.x, c.y, game.player.x, game.player.y) < 1200);
      for (const c of this.cruisers) c.driver = 'traffic';
      if (this.cruisers.length && this.cruisers.every((c) => distance(c.x, c.y, game.player.x, game.player.y) > 900)) {
        this.cruisers = [];
      }
    }
  }

  playerSeen(game) {
    for (const c of this.cruisers) {
      if (distance(c.x, c.y, game.player.x, game.player.y) < WANTED.sightRange) return true;
    }
    return false;
  }

  update(game, dt) {
    this.syncCruisers(game);
    const seen = this.playerSeen(game);
    if (seen) this.unseenTimer = 0;
    else this.unseenTimer += dt;
    if (this.unseenTimer > WANTED.hiddenSeconds && this.heat > 0) {
      this.heat = Math.max(0, this.heat - WANTED.decayPerSecond * dt * 4);
    }
    const target = game.player.car || game.player;
    let crowding = 0;
    for (const car of this.cruisers) {
      if (car.wrecked) continue;
      const d = distance(car.x, car.y, target.x, target.y);
      // Aim at where the target is heading, not where it was.
      const lead = clamp(d / 300, 0, 0.8);
      const tx = target.x + (target.vx || Math.cos(target.angle || 0) * (target.speed || 0)) * lead * 0.4;
      const ty = target.y + (target.vy || Math.sin(target.angle || 0) * (target.speed || 0)) * lead * 0.4;
      const want = angleTo(car.x, car.y, tx, ty);
      let steer = clamp(((want - car.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI, -1, 1) * 1.6;
      steer = clamp(steer, -1, 1);
      // If the player is on foot and close, stop and crowd instead of running them down.
      const onFoot = !game.player.car;
      let throttle = 1;
      if (onFoot && d < 90) {
        throttle = car.speed > 8 ? -1 : 0;
        if (d < 120) crowding += 1;
      } else if (d < 60) {
        throttle = 0.4;   // stay on the bumper, keep ramming gently
      }
      if (car.stuckTimer > 0.5) {
        throttle = -1;
        steer = -steer;
        car.stuckTimer = 0;
      }
      const prevX = car.x;
      const prevY = car.y;
      stepCarPhysics(car, dt, throttle, steer, false);
      if (Math.abs(car.speed) > 60 && distance(prevX, prevY, car.x, car.y) < 2 * dt) {
        car.stuckTimer = (car.stuckTimer || 0) + dt;
      }
      // Wedged on a corner for a while: fall back to the nearest road
      // behind the player and rejoin the hunt instead of grinding a wall.
      car.wedgedTimer = Math.abs(car.speed) < 14 && d < 700 ? (car.wedgedTimer || 0) + dt : 0;
      if (car.wedgedTimer > 2.2) {
        const spot = game.world.nearestRoadPoint(
          game.player.x - Math.cos(game.player.angle || 0) * 420,
          game.player.y - Math.sin(game.player.angle || 0) * 420,
        );
        if (spot) {
          car.x = spot.x;
          car.y = spot.y;
          car.angle = spot.vertical ? Math.PI / 2 : 0;
          car.speed = 120;
          car.wedgedTimer = 0;
        }
      }
      if (game.world.collideCircle(car, car.radius)) {
        car.speed *= -0.3;
      }
      if (car.health <= 0) car.wrecked = true;
    }
    // Bust pressure: officers close to a slow player on foot fill the meter.
    if (!game.player.car && crowding > 0 && Math.hypot(game.player.vx || 0, game.player.vy || 0) < 60) {
      this.bustMeter += dt / WANTED.bustSeconds;
    } else {
      this.bustMeter = Math.max(0, this.bustMeter - dt * 0.7);
    }
    if (this.bustMeter >= 1) {
      this.bustMeter = 0;
      game.onBusted();
    }
    if (game.sound) game.sound.setSiren(this.stars > 0 && game.mode === 'play');
  }
}
