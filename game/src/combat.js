// Vice Tide — gunplay: the player's pistol, bullets in flight, muzzle
// flash and hit sparks, and what a bullet does to people and cars.

import { WEAPON } from './config.js';
import { distance } from './random.js';

export class Combat {
  constructor() {
    this.bullets = [];
    this.particles = [];
    this.ammo = WEAPON.magazine;
    this.reloadTimer = 0;
    this.fireTimer = 0;
    this.muzzleTimer = 0;
  }

  // Try to fire one round from (x, y) toward the aim angle.
  tryShoot(game, x, y, angle) {
    if (this.reloadTimer > 0 || this.fireTimer > 0) return false;
    if (this.ammo <= 0) {
      this.startReload(game);
      return false;
    }
    this.ammo -= 1;
    this.fireTimer = WEAPON.fireSeconds;
    this.muzzleTimer = 0.05;
    const spread = (game.rng.next() - 0.5) * 0.045;
    this.bullets.push({
      x: x + Math.cos(angle) * 20,
      y: y + Math.sin(angle) * 20,
      vx: Math.cos(angle + spread) * WEAPON.bulletSpeed,
      vy: Math.sin(angle + spread) * WEAPON.bulletSpeed,
      life: WEAPON.bulletRange / WEAPON.bulletSpeed,
    });
    this.burst(x + Math.cos(angle) * 26, y + Math.sin(angle) * 26, 3, '#ffd76a', 90, 0.12);
    if (game.sound) game.sound.shoot();
    game.onGunFired(x, y);
    return true;
  }

  startReload(game) {
    if (this.reloadTimer > 0 || this.ammo === WEAPON.magazine) return;
    this.reloadTimer = WEAPON.reloadSeconds;
    if (game.sound) game.sound.reload();
  }

  burst(x, y, count, color, speed, life) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      this.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: life * (0.6 + Math.random() * 0.8),
        maxLife: life,
        color,
        size: 1.6 + Math.random() * 2.2,
      });
    }
  }

  update(game, dt) {
    this.fireTimer = Math.max(0, this.fireTimer - dt);
    this.muzzleTimer = Math.max(0, this.muzzleTimer - dt);
    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) this.ammo = WEAPON.magazine;
    }
    // Bullets fly, then test people, cars and buildings.
    for (const b of this.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0) { b.dead = true; continue; }
      for (const building of game.world.buildingsNear(b.x, b.y, 4)) {
        if (b.x > building.x && b.x < building.x + building.w && b.y > building.y && b.y < building.y + building.h) {
          b.dead = true;
          this.burst(b.x, b.y, 4, '#d8cfc0', 70, 0.2);
          break;
        }
      }
      if (b.dead) continue;
      for (const ped of game.crowd.peds) {
        if (ped.state === 'down') continue;
        if (distance(b.x, b.y, ped.x, ped.y) < ped.radius + 3) {
          b.dead = true;
          ped.state = 'down';
          ped.dead = true;
          this.burst(ped.x, ped.y, 10, '#e05252', 120, 0.4);
          game.onPedestrianShot(ped);
          break;
        }
      }
      if (b.dead) continue;
      for (const car of game.allCars()) {
        if (distance(b.x, b.y, car.x, car.y) < car.radius) {
          b.dead = true;
          car.health -= WEAPON.damage;
          this.burst(b.x, b.y, 6, '#ffd76a', 110, 0.25);
          if (car.health <= 0 && !car.wrecked) {
            car.wrecked = true;
            this.burst(car.x, car.y, 22, '#ff9f43', 170, 0.6);
            if (game.sound) game.sound.crash(1);
          }
          game.onCarShot(car);
          break;
        }
      }
    }
    this.bullets = this.bullets.filter((b) => !b.dead);
    // Particles drift and fade.
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }
}
