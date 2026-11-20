// Vice Tide — everything the player sees: the sunlit city, cars and
// people, the HUD with its minimap, dialogue and banners, and the title,
// pause, busted and wasted screens. Pure canvas, no image assets.

import { WORLD, AVENUES_X, STREETS_Y, ROAD_HALF, COLORS, WEAPON } from './config.js';
import { clamp, distance } from './random.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.shakeX = 0;
    this.shakeY = 0;
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.floor(window.innerWidth * dpr);
    this.canvas.height = Math.floor(window.innerHeight * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w: window.innerWidth, h: window.innerHeight };
  }

  // The camera centres on the player and leans into their velocity.
  cameraFor(game, w, h) {
    const focus = game.player.car || game.player;
    const vx = focus.vx || Math.cos(focus.angle || 0) * (focus.speed || 0);
    const vy = focus.vy || Math.sin(focus.angle || 0) * (focus.speed || 0);
    const lookX = clamp(vx * 0.42, -150, 150);
    const lookY = clamp(vy * 0.42, -110, 110);
    const camX = clamp(focus.x + lookX - w / 2, 0, Math.max(0, WORLD.width - w));
    const camY = clamp(focus.y + lookY - h / 2, 0, Math.max(0, WORLD.height - h));
    return { x: camX + this.shakeX, y: camY + this.shakeY };
  }

  addShake(amount) {
    this.shakeX = (Math.random() - 0.5) * amount;
    this.shakeY = (Math.random() - 0.5) * amount;
  }

  draw(game, w, h) {
    const ctx = this.ctx;
    this.shakeX *= 0.86;
    this.shakeY *= 0.86;
    if (game.mode === 'title') {
      this.drawTitleBackdrop(game, w, h);
      this.drawTitleText(game, w, h);
      return;
    }
    const cam = this.cameraFor(game, w, h);
    game.camera = cam;
    this.drawWorld(game, cam, w, h);
    this.drawMarkers(game, cam);
    this.drawPedestrians(game, cam);
    this.drawCars(game, cam);
    if (!game.player.car) this.drawPlayer(game, cam);
    this.drawBulletsAndParticles(game, cam);
    this.drawObjectiveArrow(game, cam, w, h);
    this.drawHud(game, w, h);
    if (game.missions.dialogue) this.drawDialogue(game, w, h);
    if (game.missions.banner) this.drawBanner(game, w, h);
    if (game.mode === 'pause') this.drawPause(game, w, h);
    if (game.mode === 'busted') this.drawEndScreen(game, w, h, 'BUSTED', 'The Port Solano police walk you to a cell.', '#3b6ea5');
    if (game.mode === 'wasted') this.drawEndScreen(game, w, h, 'WASTED', 'You wake up outside Coral Bay Hospital, lighter by the bill.', '#b03a3a');
  }

  // ---- World ----------------------------------------------------------
  drawWorld(game, cam, w, h) {
    const ctx = this.ctx;
    const world = game.world;
    ctx.fillStyle = COLORS.grass;
    ctx.fillRect(0, 0, w, h);
    const x0 = Math.max(0, cam.x - 60);
    const y0 = Math.max(0, cam.y - 60);
    const x1 = Math.min(WORLD.width, cam.x + w + 60);
    const y1 = Math.min(WORLD.height, cam.y + h + 60);
    // Beach and sea along the south edge.
    ctx.fillStyle = COLORS.sand;
    ctx.fillRect(0, WORLD.beachY - cam.y, w, WORLD.waterY - WORLD.beachY);
    const wave = Math.sin(game.time * 1.4) * 5;
    ctx.fillStyle = COLORS.water;
    ctx.fillRect(0, WORLD.waterY - cam.y + wave * 0.3, w, h);
    ctx.fillStyle = COLORS.waterDeep;
    for (let i = 0; i < 5; i++) {
      const wy = WORLD.waterY + 42 + i * 42 - cam.y + Math.sin(game.time * 0.9 + i * 1.7) * 4;
      if (wy > -6 && wy < h + 6) ctx.fillRect(0, wy, w, 5);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(0, WORLD.waterY - cam.y + wave, w, 3);
    // Roads: asphalt strips, then lane dashes and crosswalks.
    ctx.fillStyle = COLORS.road;
    for (const ax of AVENUES_X) ctx.fillRect(ax - ROAD_HALF - cam.x, 0, ROAD_HALF * 2, WORLD.beachY);
    for (const sy of STREETS_Y) ctx.fillRect(0, sy - ROAD_HALF - cam.y, WORLD.width, ROAD_HALF * 2);
    ctx.strokeStyle = COLORS.roadLine;
    ctx.lineWidth = 3;
    ctx.setLineDash([22, 26]);
    ctx.beginPath();
    for (const ax of AVENUES_X) { ctx.moveTo(ax - cam.x, -cam.y); ctx.lineTo(ax - cam.x, WORLD.beachY - cam.y); }
    for (const sy of STREETS_Y) { ctx.moveTo(-cam.x, sy - cam.y); ctx.lineTo(WORLD.width - cam.x, sy - cam.y); }
    ctx.stroke();
    ctx.setLineDash([]);
    // Sidewalk edges.
    ctx.strokeStyle = COLORS.sidewalk;
    ctx.lineWidth = 5;
    ctx.beginPath();
    for (const ax of AVENUES_X) {
      ctx.moveTo(ax - ROAD_HALF - cam.x, -cam.y); ctx.lineTo(ax - ROAD_HALF - cam.x, WORLD.beachY - cam.y);
      ctx.moveTo(ax + ROAD_HALF - cam.x, -cam.y); ctx.lineTo(ax + ROAD_HALF - cam.x, WORLD.beachY - cam.y);
    }
    for (const sy of STREETS_Y) {
      ctx.moveTo(-cam.x, sy - ROAD_HALF - cam.y); ctx.lineTo(WORLD.width - cam.x, sy - ROAD_HALF - cam.y);
      ctx.moveTo(-cam.x, sy + ROAD_HALF - cam.y); ctx.lineTo(WORLD.width - cam.x, sy + ROAD_HALF - cam.y);
    }
    ctx.stroke();
    // Buildings with shadows, roofs and lit windows.
    for (const b of world.buildingsNear(cam.x + w / 2, cam.y + h / 2, Math.max(w, h) * 0.75)) {
      const bx = b.x - cam.x;
      const by = b.y - cam.y;
      ctx.fillStyle = 'rgba(30,40,30,0.25)';
      ctx.fillRect(bx + 7, by + 9, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(bx, by, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(bx + 5, by + 5, b.w - 10, b.h - 10);
      this.drawWindows(b, bx, by);
      if (b.name && b.w > 110) {
        ctx.fillStyle = 'rgba(20,24,32,0.75)';
        ctx.font = '600 10px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(b.name, bx + b.w / 2, by + 15);
      }
    }
    // Palms: a curved trunk and a fan of fronds.
    for (const palm of world.palms) {
      const px = palm.x - cam.x;
      const py = palm.y - cam.y;
      if (px < -40 || py < -40 || px > w + 40 || py > h + 40) continue;
      ctx.strokeStyle = '#8a6b46';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.quadraticCurveTo(px + 4, py - palm.size * 0.7, px + 8, py - palm.size);
      ctx.stroke();
      ctx.strokeStyle = '#2f9e4f';
      ctx.lineWidth = 3;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.4;
        ctx.beginPath();
        ctx.moveTo(px + 8, py - palm.size);
        ctx.quadraticCurveTo(
          px + 8 + Math.cos(a) * palm.size * 0.7, py - palm.size - 5 + Math.sin(a) * 4,
          px + 8 + Math.cos(a) * palm.size, py - palm.size + 4 + Math.sin(a) * 7,
        );
        ctx.stroke();
      }
    }
    // Street lamps.
    ctx.fillStyle = '#5d6d7e';
    for (const lamp of world.lamps) {
      const lx = lamp.x - cam.x;
      const ly = lamp.y - cam.y;
      if (lx < -10 || ly < -10 || lx > w + 10 || ly > h + 10) continue;
      ctx.fillRect(lx - 2, ly - 2, 4, 4);
    }
  }

  drawWindows(b, bx, by) {
    const ctx = this.ctx;
    const cols = Math.max(2, Math.floor(b.w / 22));
    const rows = Math.max(2, Math.floor(b.h / 20));
    ctx.fillStyle = 'rgba(255,244,190,0.75)';
    let n = b.windowsSeed;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        n = (n * 1103515245 + 12345) & 0x7fffffff;
        if (n % 3 === 0) ctx.fillRect(bx + 9 + i * 22, by + 9 + j * 20, 9, 11);
      }
    }
  }

  // ---- Entities ---------------------------------------------------------
  drawMarkers(game, cam) {
    const ctx = this.ctx;
    const t = game.time;
    const beam = (x, y, color, label) => {
      const sx = x - cam.x;
      const sy = y - cam.y;
      const grad = ctx.createLinearGradient(0, sy - 130, 0, sy);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(1, color);
      ctx.fillStyle = grad;
      ctx.fillRect(sx - 7, sy - 130, 14, 130);
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(sx, sy, 24 + Math.sin(t * 4) * 4, 10 + Math.sin(t * 4) * 2, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(sx, sy - 44 - Math.sin(t * 3) * 4, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#14202b';
      ctx.font = '800 14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, sx, sy - 39 - Math.sin(t * 3) * 4);
    };
    const giver = game.missions.currentGiver();
    if (!game.missions.active && giver) beam(giver.x, giver.y, '#ffd94d', '!');
    const offer = game.missions.sideOffer;
    if (!game.missions.active && !game.missions.sideJob && offer) {
      beam(offer.x, offer.y, offer.color, offer.kind === 'taxi' ? 'T' : offer.kind === 'courier' ? 'C' : 'R');
    }
    const point = game.missions.objectivePoint();
    if (point) beam(point.x, point.y, '#4dff88', '◆');
    const stage = game.missions.active && game.missions.active.stage;
    if (stage && stage.collect) {
      for (const bag of stage.collect) {
        const sx = bag.x - cam.x;
        const sy = bag.y - cam.y;
        ctx.fillStyle = '#2e7d4f';
        ctx.fillRect(sx - 10, sy - 8, 20, 16);
        ctx.fillStyle = '#ffd94d';
        ctx.font = '800 12px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('$', sx, sy + 4);
      }
    }
  }

  drawPedestrians(game, cam) {
    const ctx = this.ctx;
    for (const ped of game.crowd.peds) {
      const sx = ped.x - cam.x;
      const sy = ped.y - cam.y;
      if (sx < -30 || sy < -30 || sx > 1400 || sy > 900) continue;
      if (ped.state === 'down') {
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(ped.angle + Math.PI / 2);
        ctx.fillStyle = ped.shirt;
        ctx.fillRect(-5, -12, 10, 20);
        ctx.fillStyle = ped.skin;
        ctx.beginPath(); ctx.arc(0, -15, 5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        continue;
      }
      const bob = Math.sin(ped.walkCycle) * (ped.speed > 4 ? 2.4 : 0.7);
      ctx.fillStyle = 'rgba(20,30,20,0.22)';
      ctx.beginPath(); ctx.ellipse(sx, sy + 9, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = ped.pants;
      ctx.fillRect(sx - 5, sy + 1 + bob * 0.4, 4, 8);
      ctx.fillRect(sx + 1, sy + 1 - bob * 0.4, 4, 8);
      ctx.fillStyle = ped.shirt;
      ctx.beginPath(); ctx.arc(sx, sy - 2, 7.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = ped.skin;
      ctx.beginPath(); ctx.arc(sx, sy - 3, 4.6, 0, Math.PI * 2); ctx.fill();
      if (ped.role === 'giver' || ped.role === 'passenger') {
        ctx.fillStyle = '#ffd94d';
        ctx.font = '800 13px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(ped.role === 'giver' ? '!' : '?', sx, sy - 18);
      }
    }
  }

  drawCars(game, cam) {
    for (const car of game.allCars()) {
      this.drawCar(game, car, cam);
    }
  }

  drawCar(game, car, cam) {
    const ctx = this.ctx;
    const sx = car.x - cam.x;
    const sy = car.y - cam.y;
    if (sx < -80 || sy < -80 || sx > 1440 || sy > 940) return;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.fillStyle = 'rgba(15,20,25,0.3)';
    ctx.beginPath(); ctx.ellipse(3, 6, car.w * 0.55, car.h * 0.62, 0, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(car.angle);
    // Wheels.
    ctx.fillStyle = '#15181c';
    const ww = car.w * 0.2;
    const wh = car.h * 0.24;
    for (const [wx, wy] of [[-car.w * 0.3, -car.h / 2], [car.w * 0.28, -car.h / 2], [-car.w * 0.3, car.h / 2 - wh], [car.w * 0.28, car.h / 2 - wh]]) {
      ctx.fillRect(wx, wy, ww, wh);
    }
    // Body with a two-tone paint job.
    ctx.fillStyle = car.wrecked ? '#4a4a4a' : car.color;
    this.roundRect(-car.w / 2, -car.h / 2, car.w, car.h, 6);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    this.roundRect(-car.w / 2, -car.h / 2, car.w, car.h * 0.42, 6);
    ctx.fill();
    // Cabin and glass.
    ctx.fillStyle = '#20303c';
    this.roundRect(-car.w * 0.14, -car.h * 0.36, car.w * 0.36, car.h * 0.72, 4);
    ctx.fill();
    ctx.fillStyle = '#9fd8e8';
    this.roundRect(-car.w * 0.1, -car.h * 0.3, car.w * 0.13, car.h * 0.6, 3);
    ctx.fill();
    // Headlights and tail lights.
    ctx.fillStyle = '#fff6bf';
    ctx.fillRect(car.w / 2 - 3, -car.h * 0.32, 3, 5);
    ctx.fillRect(car.w / 2 - 3, car.h * 0.32 - 5, 3, 5);
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(-car.w / 2, -car.h * 0.32, 3, 5);
    ctx.fillRect(-car.w / 2, car.h * 0.32 - 5, 3, 5);
    if (car.isPolice) {
      ctx.fillStyle = '#14202b';
      ctx.fillRect(-car.w * 0.3, -car.h * 0.14, car.w * 0.6, car.h * 0.28);
      const flash = Math.sin(game.time * 10) > 0;
      ctx.fillStyle = flash ? '#ff4757' : '#3742fa';
      ctx.fillRect(-6, -car.h * 0.2, 12, 5);
      ctx.fillStyle = flash ? '#3742fa' : '#ff4757';
      ctx.fillRect(-6, car.h * 0.2 - 5, 12, 5);
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 7px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('POLICE', 0, 2.5);
    }
    if (car.type.kind === 'taxi') {
      ctx.fillStyle = '#14202b';
      ctx.fillRect(-5, -4, 10, 8);
      ctx.fillStyle = '#ffd94d';
      ctx.font = '700 6px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TAXI', 0, 2);
    }
    if (car === game.stolenTarget) {
      ctx.strokeStyle = '#ffd94d';
      ctx.lineWidth = 2.5;
      this.roundRect(-car.w / 2 - 4, -car.h / 2 - 4, car.w + 8, car.h + 8, 8);
      ctx.stroke();
    }
    if (car === game.player.car) {
      // A soft white halo so the player's car reads at a glance.
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 2;
      this.roundRect(-car.w / 2 - 2.5, -car.h / 2 - 2.5, car.w + 5, car.h + 5, 8);
      ctx.stroke();
    }
    ctx.restore();
    if (car.wrecked) {
      ctx.fillStyle = 'rgba(60,60,60,0.35)';
      ctx.beginPath();
      ctx.arc(sx, sy - 8 - Math.sin(game.time * 2 + car.x) * 3, 9, 0, Math.PI * 2);
      ctx.arc(sx + 7, sy - 15 - Math.sin(game.time * 1.6 + car.y) * 3, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawPlayer(game, cam) {
    const ctx = this.ctx;
    const p = game.player;
    const sx = p.x - cam.x;
    const sy = p.y - cam.y;
    ctx.fillStyle = 'rgba(20,30,20,0.25)';
    ctx.beginPath(); ctx.ellipse(sx, sy + 10, 10, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    // Legs and torso, turned toward the aim.
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#27324a';
    ctx.fillRect(-4, -8, 4.6, 9);
    ctx.fillRect(-4, 1, 4.6, 9);
    ctx.fillStyle = '#ff8c42';
    ctx.beginPath(); ctx.arc(0, 0, 8.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f1c27d';
    ctx.beginPath(); ctx.arc(1.5, 0, 5, 0, Math.PI * 2); ctx.fill();
    // The pistol in both hands.
    ctx.fillStyle = '#1c2733';
    ctx.fillRect(6, -1.8, 13, 3.6);
    if (game.combat.muzzleTimer > 0) {
      ctx.fillStyle = '#ffd76a';
      ctx.beginPath();
      ctx.moveTo(19, 0);
      ctx.lineTo(30, -4);
      ctx.lineTo(28, 0);
      ctx.lineTo(30, 4);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  drawBulletsAndParticles(game, cam) {
    const ctx = this.ctx;
    ctx.strokeStyle = '#ffe9a8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (const b of game.combat.bullets) {
      ctx.moveTo(b.x - cam.x, b.y - cam.y);
      ctx.lineTo(b.x - cam.x - b.vx * 0.014, b.y - cam.y - b.vy * 0.014);
    }
    ctx.stroke();
    for (const p of game.combat.particles) {
      ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - cam.x - p.size / 2, p.y - cam.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    // Skid smoke behind a hard-driving player car.
    const car = game.player.car;
    if (car && Math.abs(car.speed) > 200 && Math.random() < 0.4) {
      game.combat.particles.push({
        x: car.x - Math.cos(car.angle) * 20, y: car.y - Math.sin(car.angle) * 20,
        vx: 0, vy: -12, life: 0.5, maxLife: 0.5, color: '#e8e8e8', size: 6,
      });
    }
  }

  // ---- HUD ---------------------------------------------------------------
  drawObjectiveArrow(game, cam, w, h) {
    const point = game.missions.objectivePoint();
    if (!point || game.mode !== 'play') return;
    const ctx = this.ctx;
    const sx = point.x - cam.x;
    const sy = point.y - cam.y;
    if (sx > -20 && sx < w + 20 && sy > -20 && sy < h + 20) return;  // beam is visible
    const cx = w / 2;
    const cy = h / 2;
    const angle = Math.atan2(sy - cy, sx - cx);
    const edge = 54;
    const ax = cx + Math.cos(angle) * (Math.min(w / 2, h / 2) - edge - 60);
    const ay = cy + Math.sin(angle) * (Math.min(w / 2, h / 2) - edge - 60);
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(angle);
    ctx.fillStyle = '#ffd94d';
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-10, -10);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-10, 10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    const d = Math.round(distance(game.player.x, game.player.y, point.x, point.y));
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${d}m`, ax, ay + 26);
  }

  panel(x, y, w, h) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(10,18,28,0.62)';
    this.roundRect(x, y, w, h, 10);
    ctx.fill();
  }

  drawHud(game, w, h) {
    const ctx = this.ctx;
    const p = game.player;
    // Top-left: health and cash.
    this.panel(14, 14, 208, 62);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('HEALTH', 26, 36);
    ctx.fillStyle = '#3a4552';
    this.roundRect(96, 26, 112, 11, 5);
    ctx.fill();
    ctx.fillStyle = p.health > 30 ? '#51d88a' : '#e74c3c';
    this.roundRect(96, 26, 112 * clamp(p.health / 100, 0, 1), 11, 5);
    ctx.fill();
    ctx.fillStyle = '#ffd94d';
    ctx.font = '800 17px system-ui, sans-serif';
    ctx.fillText(`$${p.cash}`, 26, 64);
    ctx.fillStyle = '#cfe3ee';
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.fillText(`Respect ${game.respect} · Jobs ${game.sideJobsDone}`, 92, 63);
    // Top-right: wanted stars and the clock.
    this.panel(w - 226, 14, 212, 62);
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i < game.police.stars ? '#ffd94d' : 'rgba(255,255,255,0.22)';
      ctx.font = '20px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('★', w - 212 + i * 25, 40);
    }
    const hh = Math.floor(game.clockMinutes / 60) % 24;
    const mm = Math.floor(game.clockMinutes % 60);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 14px system-ui, sans-serif';
    ctx.fillText(`Day ${game.day} · ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, w - 212, 64);
    ctx.fillStyle = '#9fd8e8';
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(game.world.districtAt(p.x, p.y), w - 26, 64);
    // Top-centre: the objective.
    const objective = game.missions.objectiveText();
    ctx.font = '700 14px system-ui, sans-serif';
    const tw = ctx.measureText(objective).width + 34;
    this.panel(w / 2 - tw / 2, 14, tw, 34);
    ctx.fillStyle = '#ffe9a8';
    ctx.textAlign = 'center';
    ctx.fillText(objective, w / 2, 37);
    // Bottom-left: weapon.
    this.panel(14, h - 66, 196, 52);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(WEAPON.name, 26, h - 42);
    ctx.fillStyle = '#ffd94d';
    ctx.font = '800 15px system-ui, sans-serif';
    ctx.textAlign = 'right';
    const ammoText = game.combat.reloadTimer > 0 ? '···' : `${game.combat.ammo} / ${WEAPON.magazine}`;
    ctx.fillText(ammoText, 198, h - 42);
    ctx.fillStyle = '#9fb6c4';
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(game.player.car ? 'E exit · Space handbrake · Click drive-by' : 'E enter car · R reload · Shift sprint', 26, h - 24);
    // Interaction prompt.
    if (game.promptText) {
      ctx.font = '700 15px system-ui, sans-serif';
      const pw = ctx.measureText(game.promptText).width + 36;
      this.panel(w / 2 - pw / 2, h - 118, pw, 36);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(game.promptText, w / 2, h - 94);
    }
    // Bust meter.
    if (game.police.bustMeter > 0.02) {
      this.panel(w / 2 - 110, h - 168, 220, 30);
      ctx.fillStyle = '#e74c3c';
      this.roundRect(w / 2 - 100, h - 158, 200 * game.police.bustMeter, 10, 5);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('THE POLICE ARE CLOSING IN — RUN!', w / 2, h - 144 + 24);
    }
    this.drawMinimap(game, w, h);
    // Damage vignette.
    if (game.hurtFlash > 0) {
      ctx.fillStyle = `rgba(200,30,30,${game.hurtFlash * 0.25})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  drawMinimap(game, w, h) {
    const ctx = this.ctx;
    const mw = 196;
    const mh = 148;
    const mx = w - mw - 14;
    const my = h - mh - 14;
    const sx = mw / WORLD.width;
    const sy = mh / WORLD.height;
    ctx.save();
    this.panel(mx - 4, my - 4, mw + 8, mh + 8);
    ctx.beginPath();
    this.roundRect(mx, my, mw, mh, 8);
    ctx.clip();
    ctx.fillStyle = '#79b657';
    ctx.fillRect(mx, my, mw, mh);
    ctx.fillStyle = COLORS.sand;
    ctx.fillRect(mx, my + WORLD.beachY * sy, mw, (WORLD.waterY - WORLD.beachY) * sy);
    ctx.fillStyle = COLORS.water;
    ctx.fillRect(mx, my + WORLD.waterY * sy, mw, mh);
    ctx.strokeStyle = '#3c4148';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (const ax of AVENUES_X) { ctx.moveTo(mx + ax * sx, my); ctx.lineTo(mx + ax * sx, my + WORLD.beachY * sy); }
    for (const ly of STREETS_Y) { ctx.moveTo(mx, my + ly * sy); ctx.lineTo(mx + mw, my + ly * sy); }
    ctx.stroke();
    const dot = (x, y, color, r) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(mx + x * sx, my + y * sy, r, 0, Math.PI * 2);
      ctx.fill();
    };
    for (const car of game.traffic.cars) if (!car.parked) dot(car.x, car.y, 'rgba(255,255,255,0.65)', 1.6);
    for (const c of game.police.cruisers) dot(c.x, c.y, Math.sin(game.time * 8) > 0 ? '#ff4757' : '#3742fa', 3);
    const point = game.missions.objectivePoint();
    if (point) dot(point.x, point.y, '#ffd94d', 4);
    const giver = game.missions.currentGiver();
    if (!game.missions.active && giver) dot(giver.x, giver.y, '#ffd94d', 3.4);
    // The player as a heading arrow.
    const px = mx + game.player.x * sx;
    const py = my + game.player.y * sy;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(game.player.car ? game.player.car.angle : game.player.angle);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(-4, -4);
    ctx.lineTo(-4, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '700 10px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('PORT SOLANO', mx + mw, my - 8);
  }

  drawDialogue(game, w, h) {
    const ctx = this.ctx;
    const d = game.missions.dialogue;
    const [speaker, line] = d.lines[d.index];
    const boxH = 92;
    ctx.fillStyle = 'rgba(8,14,22,0.82)';
    this.roundRect(w / 2 - 330, h - boxH - 76, 660, boxH, 12);
    ctx.fill();
    ctx.fillStyle = '#ffd94d';
    ctx.font = '800 14px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(speaker, w / 2 - 306, h - boxH - 46);
    ctx.fillStyle = '#ffffff';
    ctx.font = '15px system-ui, sans-serif';
    this.wrapText(line, w / 2 - 306, h - boxH - 22, 612, 20);
    ctx.fillStyle = '#9fb6c4';
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('E / click ▸', w / 2 + 306, h - 92);
  }

  drawBanner(game, w, h) {
    const ctx = this.ctx;
    const b = game.missions.banner;
    ctx.globalAlpha = clamp(b.timer, 0, 1);
    ctx.fillStyle = 'rgba(8,14,22,0.78)';
    this.roundRect(w / 2 - 280, 92, 560, 74, 12);
    ctx.fill();
    ctx.fillStyle = '#ffd94d';
    ctx.font = '800 21px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(b.title, w / 2, 124);
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillText(b.sub, w / 2, 148);
    ctx.globalAlpha = 1;
  }

  // ---- Screens ------------------------------------------------------------
  drawTitleBackdrop(game, w, h) {
    const ctx = this.ctx;
    // A slow pan across the city stands in for the game's own world.
    const cam = {
      x: clamp(1200 + Math.sin(game.time * 0.05) * 500, 0, WORLD.width - w),
      y: clamp(1150 + Math.cos(game.time * 0.04) * 320, 0, WORLD.height - h),
    };
    game.camera = cam;
    this.drawWorld(game, cam, w, h);
    this.drawPedestrians(game, cam);
    this.drawCars(game, cam);
    ctx.fillStyle = 'rgba(16,32,54,0.34)';
    ctx.fillRect(0, 0, w, h);
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(255,166,88,0.20)');
    grad.addColorStop(1, 'rgba(10,20,40,0.30)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  drawTitleText(game, w, h) {
    const ctx = this.ctx;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd94d';
    ctx.font = '900 84px system-ui, sans-serif';
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 18;
    ctx.fillText('VICE TIDE', w / 2, h * 0.3);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 21px system-ui, sans-serif';
    ctx.fillText('P O R T   S O L A N O', w / 2, h * 0.3 + 40);
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillStyle = '#e8f2f8';
    ctx.fillText('One courier. One coastal city. Every crew wants the tide chart.', w / 2, h * 0.3 + 72);
    const items = game.titleItems;
    ctx.font = '700 19px system-ui, sans-serif';
    items.forEach((item, i) => {
      const y = h * 0.52 + i * 38;
      ctx.fillStyle = i === game.titleSelection ? '#ffd94d' : 'rgba(255,255,255,0.85)';
      ctx.fillText(`${i === game.titleSelection ? '▸ ' : ''}${item}`, w / 2, y);
    });
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    const help = [
      'WASD / arrows — move & drive · Mouse — aim · Click — shoot',
      'E — enter / steal car, talk, pick up · R — reload · Shift — sprint',
      'Space — handbrake · P / Esc — pause · M — mute',
    ];
    help.forEach((line, i) => ctx.fillText(line, w / 2, h * 0.52 + items.length * 38 + 26 + i * 20));
    if (game.showHelp) {
      ctx.fillStyle = 'rgba(8,14,22,0.85)';
      this.roundRect(w / 2 - 320, h * 0.72, 640, 108, 12);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '14px system-ui, sans-serif';
      const story = 'Mara Venn runs Port Solano’s fastest courier crew — and its most wanted. Work the gold markers, run the story, keep the stars low, and bank the tide money. Busted or wasted costs cash; the safehouse saves your run.';
      this.wrapText(story, w / 2 - 296, h * 0.72 + 30, 592, 20);
    }
  }

  drawPause(game, w, h) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(8,14,22,0.6)';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 40px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', w / 2, h * 0.42);
    ctx.font = '600 16px system-ui, sans-serif';
    ctx.fillText('P / Esc — resume · Progress saves at the safehouse and after every job', w / 2, h * 0.42 + 36);
  }

  drawEndScreen(game, w, h, title, sub, color) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(8,10,16,0.66)';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = color;
    ctx.font = '900 64px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, w / 2, h * 0.44);
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 16px system-ui, sans-serif';
    ctx.fillText(sub, w / 2, h * 0.44 + 38);
    ctx.fillText(game.endPenaltyText || '', w / 2, h * 0.44 + 64);
    ctx.fillStyle = '#ffd94d';
    ctx.fillText('Press Enter to carry on', w / 2, h * 0.44 + 102);
  }

  roundRect(x, y, w, h, r) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  wrapText(text, x, y, maxWidth, lineHeight) {
    const ctx = this.ctx;
    const words = text.split(' ');
    let line = '';
    let yy = y;
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, yy);
        line = word;
        yy += lineHeight;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, x, yy);
  }
}
