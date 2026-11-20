// Vice Tide — deterministic screenshot scenes for ?shot=<name>&seed=<n>.
// Each scene arranges a real gameplay state (the same entities, physics
// and HUD as normal play) and installs a small autopilot that drives the
// car along one block of Port Solano, so the maker's captures are honest
// renders of the game running, taken the same way every time.

import { clamp, distance, angleTo, angleDelta } from './random.js';
import { STORY_MISSIONS } from './missions.js';

// Drive a loop of waypoints around one city block forever.
function installBlockDriver(game, waypoints, cruiseSpeed) {
  let index = 0;
  game.input.autopilot = (g, control) => {
    const car = g.player.car;
    if (!car) return;
    let target = waypoints[index];
    if (distance(car.x, car.y, target.x, target.y) < 100) {
      index = (index + 1) % waypoints.length;
      target = waypoints[index];
    }
    const want = angleTo(car.x, car.y, target.x, target.y);
    const turn = angleDelta(car.angle, want);
    control.steer = clamp(turn * 1.9, -1, 1);
    control.throttle = car.speed < cruiseSpeed ? 1 : 0;
    control.reverse = false;
    control.handbrake = false;
    control.shoot = false;
  };
}

const BLOCK_LOOP = [
  { x: 1423, y: 1000 },
  { x: 1350, y: 880 },
  { x: 1050, y: 877 },
  { x: 977, y: 1000 },
  { x: 977, y: 1450 },
  { x: 1050, y: 1523 },
  { x: 1350, y: 1523 },
  { x: 1423, y: 1450 },
];

// Put the player behind the wheel of a car at a chosen place and speed.
function seatPlayerInCar(game, x, y, angle, speed, kind) {
  let car = game.traffic.cars.find((c) => !c.parked && c.driver === 'traffic' && (!kind || c.type.kind === kind));
  if (!car) car = game.traffic.cars[0];
  car.x = x;
  car.y = y;
  car.angle = angle;
  car.speed = speed;
  car.driver = 'player';
  car.parked = false;
  car.enteredAtStep = 0;
  game.player.car = car;
  game.player.x = x;
  game.player.y = y;
  return car;
}

// Bring a few traffic cars near a point so the street feels alive.
function gatherTraffic(game, x, y) {
  let placed = 0;
  for (const car of game.traffic.cars) {
    if (car.driver !== 'traffic' || placed >= 4) continue;
    car.x = x + (placed % 2 === 0 ? -23 : 23);
    car.y = y - 260 + placed * 170;
    car.angle = placed % 2 === 0 ? Math.PI / 2 : -Math.PI / 2;
    car.roadVertical = true;
    car.roadLine = 1400;
    car.speed = car.aiSpeed;
    placed += 1;
  }
}

export function setupShotScene(game, name, seed) {
  game.player.cash = 640;
  game.clockMinutes = 10 * 60 + 24;
  game.day = 3;
  game.respect = 2;

  if (name === 'start') {
    game.mode = 'title';
    game.titleSelection = 0;
    game.showHelp = false;
    return;
  }

  if (name === 'drive') {
    seatPlayerInCar(game, 1423, 1420, -Math.PI / 2, 215, 'sedan');
    gatherTraffic(game, 1400, 1300);
    installBlockDriver(game, BLOCK_LOOP, 235);
    return;
  }

  if (name === 'chase') {
    const car = seatPlayerInCar(game, 1423, 1420, -Math.PI / 2, 265, 'sport');
    gatherTraffic(game, 1400, 1500);
    // Three stars, with two cruisers already on the tail so the chase
    // reads in the frame the moment the maker takes the shot.
    game.police.heat = 300;
    game.police.syncCruisers(game);
    game.police.cruisers.forEach((cruiser, i) => {
      cruiser.x = 1400 + (i % 2 === 0 ? -16 : 30);
      cruiser.y = 1420 + 130 + i * 95;
      cruiser.angle = -Math.PI / 2;
      cruiser.speed = 255;
    });
    game.combat.burst(car.x, car.y - 20, 8, '#e8e8e8', 90, 0.5);
    installBlockDriver(game, BLOCK_LOOP, 245);
    return;
  }

  if (name === 'mission') {
    // Standing with Mara at the safehouse, her first job on the table:
    // the dialogue box open, the gold marker overhead, the city around.
    game.storyIndex = 0;
    game.player.x = 1446;
    game.player.y = 1692;
    game.player.angle = Math.atan2(1660 - 1692, 1480 - 1446);
    game.ensureGiverPed();
    const mission = STORY_MISSIONS[0];
    game.missions.showDialogue(mission.intro, null);
    return;
  }

  // Unknown scene name: fall back to a calm drive.
  seatPlayerInCar(game, 1423, 1420, -Math.PI / 2, 180, 'sedan');
  installBlockDriver(game, BLOCK_LOOP, 200);
}
