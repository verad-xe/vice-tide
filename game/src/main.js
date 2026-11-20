// Vice Tide — the game itself: state, the fixed-step loop, the player on
// foot and behind the wheel, crime and punishment callbacks that wire the
// systems together, and the title / pause / busted / wasted flow.
//
// Port Solano is an original city. Mara Venn's courier crew, its districts
// and its tide-chart story were written for this game.

import { PLAYER, WORLD, FIXED_STEP } from './config.js';
import { SeededRandom, clamp, distance, angleTo } from './random.js';
import { World } from './world.js';
import { Traffic, stepCarPhysics, makeParkedCar } from './vehicles.js';
import { Crowd } from './pedestrians.js';
import { Police } from './police.js';
import { Combat } from './combat.js';
import { Missions, SAFEHOUSE } from './missions.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { SoundBank } from './audio.js';
import { hasSave, readSave, writeSave, clearSave } from './save.js';
import { setupShotScene } from './shots.js';

export class ViceTideGame {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    this.input = new Input(canvas);
    this.sound = new SoundBank();
    this.rng = new SeededRandom(20261117);
    this.world = new World(20261117);
    this.traffic = new Traffic(this.world, new SeededRandom(777));
    this.crowd = new Crowd(this.world, new SeededRandom(4242));
    this.police = new Police();
    this.combat = new Combat();
    this.player = this.freshPlayer();
    this.missions = new Missions(this);
    this.mode = 'title';
    this.time = 0;
    this.clockMinutes = 9 * 60;
    this.day = 1;
    this.respect = 0;
    this.storyIndex = 0;
    this.sideJobsDone = 0;
    this.camera = { x: 0, y: 0 };
    this.promptText = '';
    this.hurtFlash = 0;
    this.endPenaltyText = '';
    this.stolenTarget = null;
    this.stolenTargetTaken = false;
    this.titleSelection = 0;
    this.showHelp = false;
    this.giverPed = null;
    this.stepCount = 0;
    this.lastHurtAt = -99;
    this.shotMode = false;
    this.accumulator = 0;
    this.lastTimestamp = 0;
    this.view = this.renderer.resize();
    window.addEventListener('resize', () => { this.view = this.renderer.resize(); });
    this.titleItems = this.buildTitleItems();

    const params = new URLSearchParams(window.location.search);
    if (params.has('shot')) {
      this.shotMode = true;
      this.mode = 'play';
      setupShotScene(this, params.get('shot'), Number(params.get('seed') || 1));
    }
    window.__viceTide = this;
    requestAnimationFrame((t) => this.frame(t));
  }

  freshPlayer() {
    return {
      x: PLAYER.startX, y: PLAYER.startY, angle: -Math.PI / 2,
      vx: 0, vy: 0, health: PLAYER.maxHealth, cash: PLAYER.startCash,
      car: null, radius: PLAYER.radius,
    };
  }

  buildTitleItems() {
    return hasSave() ? ['New Game', 'Continue', 'The Story'] : ['New Game', 'The Story'];
  }

  allCars() {
    return this.traffic.cars.concat(this.police.cruisers);
  }

  addCash(amount) {
    this.player.cash += amount;
  }

  saveProgress() {
    if (this.shotMode) return;
    writeSave(this);
  }

  // ---- Crime and consequence callbacks --------------------------------
  onGunFired(x, y) {
    this.crowd.scare(x, y, 260);
    if (this.police.playerSeen(this) || this.crowd.peds.some((p) => distance(p.x, p.y, x, y) < 240)) {
      this.police.addHeat(16, this);
    }
  }

  onPedestrianHit(ped, car) {
    this.sound.crash(0.7);
    this.combat.burst(ped.x, ped.y, 8, '#e05252', 110, 0.35);
    if (car === this.player.car) {
      this.police.addHeat(55, this);
      this.renderer.addShake(7);
    }
  }

  onPedestrianShot(ped) {
    this.police.addHeat(70, this);
  }

  onCarShot(car) {
    if (car.isPolice) this.police.addHeat(45, this);
    else if (this.police.playerSeen(this)) this.police.addHeat(22, this);
    this.crowd.scare(car.x, car.y, 200);
  }

  onCarCrash(impact) {
    this.sound.crash(clamp(impact / 260, 0.3, 1));
    this.renderer.addShake(clamp(impact / 40, 2, 9));
    if (this.player.car) {
      if (impact > 250) this.damagePlayer(5, 'crash');
      if (this.police.playerSeen(this)) this.police.addHeat(10, this);
    }
  }

  damagePlayer(amount, cause) {
    this.player.health -= amount;
    this.hurtFlash = 1;
    this.lastHurtAt = this.time;
    if (cause !== 'crash') this.sound.hurt();
    if (this.player.health <= 0 && this.mode === 'play') this.onWasted();
  }

  onBusted() {
    if (this.mode !== 'play') return;
    const fine = Math.min(this.player.cash, 120 + this.police.stars * 45);
    this.player.cash -= fine;
    this.endPenaltyText = `Fine paid: $${fine}. Your car was impounded.`;
    this.mode = 'busted';
    this.sound.busted();
    this.finishArrest();
  }

  onWasted() {
    if (this.mode !== 'play') return;
    const bill = Math.min(this.player.cash, 180);
    this.player.cash -= bill;
    this.endPenaltyText = `Hospital bill: $${bill}.`;
    this.mode = 'wasted';
    this.sound.busted();
    this.finishArrest();
  }

  // Shared cleanup after busted/wasted: heat clears, the player wakes at
  // the safehouse on foot, the clock jumps forward two hours.
  finishArrest() {
    if (this.player.car) {
      this.player.car.driver = null;
      this.player.car.parked = true;
      this.player.car = null;
    }
    this.police.heat = 0;
    this.police.cruisers = [];
    this.police.bustMeter = 0;
    this.player.health = PLAYER.maxHealth;
    this.player.x = SAFEHOUSE.x;
    this.player.y = SAFEHOUSE.y + 30;
    this.clockMinutes += 120;
    if (this.clockMinutes >= 24 * 60) { this.clockMinutes -= 24 * 60; this.day += 1; }
    this.saveProgress();
  }

  markStolenTarget(kind, point) {
    let best = null;
    let bestDist = Infinity;
    for (const car of this.traffic.cars) {
      if (car.type.kind !== kind || car.wrecked) continue;
      const d = distance(car.x, car.y, point.x, point.y);
      if (d < bestDist) { bestDist = d; best = car; }
    }
    if (!best || bestDist > 700) {
      best = makeParkedCar(this.rng, point.x + 26, point.y + 30, 0);
      this.traffic.cars.push(best);
    }
    best.color = '#e34234';   // the vermilion coupe everyone talks about
    best.parked = true;
    if (best.driver === 'traffic') best.driver = null;
    best.x = point.x + 26;
    best.y = point.y + 30;
    best.speed = 0;
    this.stolenTarget = best;
    this.stolenTargetTaken = false;
  }

  // ---- Frame loop --------------------------------------------------------
  frame(timestamp) {
    requestAnimationFrame((t) => this.frame(t));
    const delta = Math.min(0.1, (timestamp - this.lastTimestamp) / 1000 || 0);
    this.lastTimestamp = timestamp;
    this.accumulator += delta;
    let steps = 0;
    while (this.accumulator >= FIXED_STEP && steps < 6) {
      this.step(FIXED_STEP);
      this.accumulator -= FIXED_STEP;
      steps += 1;
    }
    if (steps === 6) this.accumulator = 0;
    this.renderer.draw(this, this.view.w, this.view.h);
    this.input.endFrame();
  }

  step(dt) {
    this.time += dt;
    const control = this.input.read(this);
    if (this.input.pressed.has('KeyM')) this.sound.toggleMute();
    if (control.clicked || control.confirm) this.sound.unlock();

    if (this.mode === 'title') {
      this.stepTitle(dt, control);
      this.traffic.update(this, dt);
      this.crowd.update(this, dt);
      return;
    }
    if (this.mode === 'pause') {
      if (control.pause) this.mode = 'play';
      return;
    }
    if (this.mode === 'busted' || this.mode === 'wasted') {
      if (control.confirm) this.mode = 'play';
      return;
    }
    this.stepPlay(dt, control);
  }

  stepTitle(dt, control) {
    if (this.input.pressed.has('ArrowDown') || this.input.pressed.has('KeyS')) {
      this.titleSelection = (this.titleSelection + 1) % this.titleItems.length;
      this.sound.uiClick();
    }
    if (this.input.pressed.has('ArrowUp') || this.input.pressed.has('KeyW')) {
      this.titleSelection = (this.titleSelection - 1 + this.titleItems.length) % this.titleItems.length;
      this.sound.uiClick();
    }
    if (control.confirm || control.clicked) {
      const item = this.titleItems[this.titleSelection];
      if (item === 'New Game') {
        clearSave();
        this.startRun(null);
      } else if (item === 'Continue') {
        this.startRun(readSave());
      } else if (item === 'The Story') {
        this.showHelp = !this.showHelp;
        this.sound.uiClick();
      }
    }
  }

  startRun(saved) {
    this.player = this.freshPlayer();
    this.police.heat = 0;
    this.police.cruisers = [];
    this.combat = new Combat();
    this.storyIndex = 0;
    this.respect = 0;
    this.sideJobsDone = 0;
    this.day = 1;
    this.clockMinutes = 9 * 60;
    if (saved) {
      this.player.cash = saved.cash;
      this.player.x = saved.playerX;
      this.player.y = saved.playerY;
      this.storyIndex = saved.storyIndex;
      this.respect = saved.respect;
      this.sideJobsDone = saved.sideJobsDone;
      this.day = saved.day;
      this.clockMinutes = saved.clockMinutes;
    }
    this.missions = new Missions(this);
    this.giverPed = null;
    this.mode = 'play';
    this.sound.unlock();
    this.sound.missionDone();
  }

  stepPlay(dt, control) {
    // Dialogue freezes the world but lets the player read and advance.
    if (this.missions.dialogue) {
      if (control.interact || control.clicked) this.missions.advanceDialogue();
      this.promptText = '';
      return;
    }
    if (control.pause) { this.mode = 'pause'; return; }

    this.clockMinutes += dt * 3;
    if (this.clockMinutes >= 24 * 60) { this.clockMinutes -= 24 * 60; this.day += 1; }
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2.2);

    this.stepCount += 1;
    this.updatePlayer(dt, control);
    this.traffic.update(this, dt);
    this.crowd.update(this, dt);
    this.police.update(this, dt);
    this.combat.update(this, dt);
    this.missions.update(dt);
    this.ensureGiverPed();
    this.updateInteractions(control);
    // Leaving the car uses the same key as entering; it is checked last,
    // and only for a car entered on an earlier step, so one press can
    // never both enter and exit.
    if (this.player.car && control.enter && this.stepCount > (this.player.car.enteredAtStep || 0)) {
      this.exitCar();
    }
    this.updateCarBust(dt);

    // Slow recovery when things are calm.
    if (this.time - this.lastHurtAt > 6 && this.police.stars === 0) {
      this.player.health = Math.min(PLAYER.maxHealth, this.player.health + 1.4 * dt);
    }
    this.sound.setEngine(
      this.player.car ? this.player.car.speed / this.player.car.type.maxSpeed : 0,
      !!this.player.car && this.mode === 'play',
    );
  }

  updatePlayer(dt, control) {
    const p = this.player;
    if (p.car) {
      const car = p.car;
      const throttle = control.throttle ? 1 : control.reverse ? -1 : 0;
      stepCarPhysics(car, dt, throttle, control.steer, control.handbrake);
      // collideCircle pushes the car back out of the wall; a fast hit
      // still crunches, and the bounce kills the speed into the wall.
      if (this.world.collideCircle(car, car.radius)) {
        if (Math.abs(car.speed) > 170) this.onCarCrash(Math.abs(car.speed));
        car.speed *= -0.28;
      }
      p.x = car.x;
      p.y = car.y;
      p.vx = Math.cos(car.angle) * car.speed;
      p.vy = Math.sin(car.angle) * car.speed;
      // Aim from the car for drive-by shots.
      const aim = this.aimAngle();
      p.angle = aim;
      if (control.shoot) this.combat.tryShoot(this, car.x, car.y, aim);
      if (control.reload) this.combat.startReload(this);
      return;
    }
    // On foot.
    const len = Math.hypot(control.moveX, control.moveY) || 1;
    const speed = control.sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
    const moving = control.moveX !== 0 || control.moveY !== 0;
    p.vx = moving ? (control.moveX / len) * speed : 0;
    p.vy = moving ? (control.moveY / len) * speed : 0;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    this.world.collideCircle(p, p.radius);
    p.angle = this.aimAngle();
    if (control.shoot) this.combat.tryShoot(this, p.x, p.y, p.angle);
    if (control.reload) this.combat.startReload(this);
    // Being run down hurts.
    for (const car of this.allCars()) {
      if (Math.abs(car.speed) > 130 && distance(car.x, car.y, p.x, p.y) < car.radius + 6) {
        this.damagePlayer(26, 'runover');
        p.x += Math.cos(angleTo(car.x, car.y, p.x, p.y)) * 26;
        p.y += Math.sin(angleTo(car.x, car.y, p.x, p.y)) * 26;
        this.renderer.addShake(8);
        break;
      }
    }
  }

  aimAngle() {
    const p = this.player;
    const sx = p.x - this.camera.x;
    const sy = p.y - this.camera.y;
    return Math.atan2(this.input.mouseY - sy, this.input.mouseX - sx);
  }

  // One key, many jobs: advance talk, start jobs, steal cars, get out.
  updateInteractions(control) {
    const p = this.player;
    this.promptText = '';
    if (p.car) return;   // exiting is handled below by the same key
    const giver = this.missions.currentGiver();
    if (!this.missions.active && giver && distance(p.x, p.y, giver.x, giver.y) < 52) {
      this.promptText = `E — Talk to ${giver.name}`;
      if (control.interact) this.missions.tryStartStory();
      return;
    }
    const offer = this.missions.sideOffer;
    if (!this.missions.active && !this.missions.sideJob && offer && distance(p.x, p.y, offer.x, offer.y) < 52) {
      this.promptText = `E — Start: ${offer.label}`;
      if (control.interact) this.missions.tryStartSideJob();
      return;
    }
    // Nearest car: entering is one press, and it is instant.
    let nearest = null;
    let nearestDist = 58;
    for (const car of this.allCars()) {
      if (car.wrecked) continue;
      const d = distance(p.x, p.y, car.x, car.y);
      if (d < nearestDist) { nearestDist = d; nearest = car; }
    }
    if (nearest) {
      this.promptText = nearest.driver === 'traffic' ? 'E — Steal the car' : 'E — Get in the car';
      if (control.enter) this.enterCar(nearest);
    }
  }

  enterCar(car) {
    const p = this.player;
    car.enteredAtStep = this.stepCount;
    const wasTraffic = car.driver === 'traffic';
    const wasParked = car.parked;
    car.driver = 'player';
    car.parked = false;
    p.car = car;
    p.x = car.x;
    p.y = car.y;
    this.sound.door();
    if (car === this.stolenTarget) this.stolenTargetTaken = true;
    if (wasTraffic) {
      this.police.addHeat(38, this);
      this.crowd.scare(car.x, car.y, 220);
    } else if (wasParked && !car.stolen) {
      car.stolen = true;
      const witnessed = this.police.playerSeen(this) || this.crowd.peds.some((ped) => distance(ped.x, ped.y, car.x, car.y) < 190);
      this.police.addHeat(witnessed ? 24 : 6, this);
    }
  }

  exitCar() {
    const p = this.player;
    const car = p.car;
    if (!car) return;
    car.driver = null;
    car.parked = true;
    car.speed = 0;
    p.car = null;
    p.x = car.x + Math.cos(car.angle - Math.PI / 2) * 30;
    p.y = car.y + Math.sin(car.angle - Math.PI / 2) * 30;
    this.world.collideCircle(p, p.radius);
    this.sound.door();
  }

  updateCarBust(dt) {
    const p = this.player;
    if (!p.car) return;
    let near = false;
    for (const c of this.police.cruisers) {
      if (distance(c.x, c.y, p.x, p.y) < 86) { near = true; break; }
    }
    if (near && Math.abs(p.car.speed) < 10) {
      this.police.bustMeter += dt / 3.4;
      if (this.police.bustMeter >= 1) {
        this.police.bustMeter = 0;
        this.onBusted();
      }
    }
  }

  ensureGiverPed() {
    const giver = this.missions.currentGiver();
    if (!giver) {
      if (this.giverPed) this.giverPed.role = null;
      this.giverPed = null;
      return;
    }
    if (!this.giverPed) {
      this.giverPed = this.crowd.addPed(giver.x, giver.y, this.rng);
      this.giverPed.role = 'giver';
    }
    this.giverPed.state = 'giver';
    this.giverPed.role = 'giver';
    this.giverPed.name = giver.name;
    this.giverPed.x = giver.x;
    this.giverPed.y = giver.y;
  }
}

const canvas = document.getElementById('game');
const game = new ViceTideGame(canvas);
