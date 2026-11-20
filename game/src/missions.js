// Vice Tide — the story of Mara Venn, a courier who owes the wrong people.
// Six story missions chain across Port Solano, each with dialogue, an
// objective marker and a cash reward; between them, taxi fares, courier
// runs and checkpoint races pay the rent. This module owns the objective
// state machine; main.js feeds it events (arrived, delivered, escaped).

import { distance } from './random.js';

export const SAFEHOUSE = { x: 1420, y: 1700, name: 'Venn Safehouse' };
export const GARAGE = { x: 2620, y: 760, name: 'Garage Ochoa' };
export const MARINA_DOCK = { x: 2900, y: 1960, name: 'Marina Dock 9' };
export const OLD_TOWN_DROP = { x: 420, y: 700, name: 'Old Town Arcade' };
export const BEACH_HUT = { x: 700, y: 2130, name: 'Coral Beach Hut' };
export const HILLS_LOOKOUT = { x: 300, y: 1330, name: 'Solano Heights Lookout' };

// Each story mission: where it starts (its giver), the dialogue that opens
// it, and a list of stages. A stage ends when the player reaches its point
// (optionally in a car, optionally a specific car, optionally with heat).
export const STORY_MISSIONS = [
  {
    id: 'first-run',
    title: 'First Run',
    giver: { x: 1480, y: 1660, name: 'Mara Venn' },
    reward: 220,
    intro: [
      ['Mara', 'You drive, you keep quiet, you get paid. That is the whole contract.'],
      ['You', 'And the package?'],
      ['Mara', 'Dock 9, Marina. It is already in a crate with your name spelled wrong. Bring it to the Old Town Arcade.'],
    ],
    outro: [
      ['Mara', 'On time and in one piece. The tide might like you after all.'],
    ],
    stages: [
      { text: 'Pick up the package at Marina Dock 9', point: MARINA_DOCK, needCar: false },
      { text: 'Deliver the package to the Old Town Arcade', point: OLD_TOWN_DROP, needCar: false },
    ],
  },
  {
    id: 'hot-wheels',
    title: 'Hot Wheels',
    giver: { x: 1480, y: 1660, name: 'Mara Venn' },
    reward: 340,
    intro: [
      ['Mara', 'A collector in Palms Row parks a vermilion sports coupe outside Café Oleada and never locks it.'],
      ['Mara', 'Garage Ochoa pays cash for exactly that car. Try not to bring the police with it.'],
    ],
    outro: [
      ['Ochoa', 'Beautiful. The collector will cry into his espresso. Pleasure doing crime with you.'],
    ],
    stages: [
      { text: 'Steal the vermilion sports coupe in Palms Row', point: { x: 1700, y: 460, name: 'Café Oleada' }, stealKind: 'sport' },
      { text: 'Deliver the coupe to Garage Ochoa', point: GARAGE, needCar: true },
    ],
  },
  {
    id: 'beach-money',
    title: 'Beach Money',
    giver: { x: 760, y: 2090, name: 'Old Sef' },
    reward: 420,
    intro: [
      ['Old Sef', 'Three money bags washed off a smuggler boat, right onto my beach.'],
      ['Old Sef', 'The police want them too. Grab all three and run them back to my hut. On foot, quiet-like.'],
    ],
    outro: [
      ['Old Sef', 'Wet money spends the same. You run like the tide owes you.'],
    ],
    stages: [
      { text: 'Collect the washed-up money bags (0/3)', collect: [
        { x: 1050, y: 2150 }, { x: 1650, y: 2110 }, { x: 2300, y: 2160 },
      ], heatOnStart: 130 },
      { text: 'Bring the money back to the Coral Beach Hut', point: BEACH_HUT },
    ],
  },
  {
    id: 'the-shipment',
    title: 'The Shipment',
    giver: { x: 2660, y: 820, name: 'Ochoa' },
    reward: 520,
    intro: [
      ['Ochoa', 'My van, four drops, one nervous client. Dockyards, Marina, Old Town, then home.'],
      ['Ochoa', 'The clock on the dash is not decoration. Move.'],
    ],
    outro: [
      ['Ochoa', 'Four for four. The client sends his regards and a suspicious amount of cash.'],
    ],
    stages: [
      { text: 'Run the shipment route before time runs out', checkpoints: [
        { x: 2900, y: 300, name: 'Dockyards Gate' },
        { x: 2900, y: 1500, name: 'Marina West' },
        { x: 420, y: 700, name: 'Old Town Arcade' },
        { x: 2620, y: 760, name: 'Garage Ochoa' },
      ], timeLimit: 150, needCar: true },
    ],
  },
  {
    id: 'heat',
    title: 'Heat',
    giver: { x: 1480, y: 1660, name: 'Mara Venn' },
    reward: 600,
    intro: [
      ['Mara', 'The drop went loud. Half the precinct is warming up its engines.'],
      ['Mara', 'Get to the Heights lookout and lose them. Do not lead them home.'],
    ],
    outro: [
      ['Mara', 'Gone like sea mist. One more job, and we are both out of this town.'],
    ],
    stages: [
      { text: 'Reach the Solano Heights lookout', point: HILLS_LOOKOUT, heatOnStart: 300 },
      { text: 'Lose the police', loseHeat: true },
    ],
  },
  {
    id: 'tide-king',
    title: 'Tide King',
    giver: { x: 2900, y: 1900, name: 'Mara Venn' },
    reward: 1000,
    intro: [
      ['Mara', 'Last run. Every crew in Port Solano wants this tide chart.'],
      ['Mara', 'Hit every buoy marker around the coast road, then bring it to Dock 9. The boat leaves when you arrive.'],
    ],
    outro: [
      ['Mara', 'That is the whole tide, delivered. Port Solano is yours now. Spend it kindly.'],
    ],
    stages: [
      { text: 'Run the coast road markers', checkpoints: [
        { x: 300, y: 1980, name: 'West Beach Gate' },
        { x: 300, y: 300, name: 'Old Town North' },
        { x: 3050, y: 300, name: 'Dockyards North' },
        { x: 3050, y: 1500, name: 'Marina East' },
        { x: 2900, y: 1960, name: 'Marina Dock 9' },
      ], timeLimit: 170, needCar: true },
    ],
  },
];

const SIDE_KINDS = [
  { kind: 'taxi', label: 'Taxi fare', color: '#f7b731' },
  { kind: 'courier', label: 'Courier run', color: '#4ecdc4' },
  { kind: 'race', label: 'Checkpoint race', color: '#fd79a8' },
];

export class Missions {
  constructor(game) {
    this.game = game;
    this.active = null;       // { mission, stageIndex, stage state... }
    this.dialogue = null;     // { lines, index, onDone }
    this.banner = null;       // { title, sub, timer }
    this.sideJob = null;      // current side activity state
    this.sideOffer = null;    // marker waiting for the player
    this.refreshSideOffer();
  }

  get storyDone() {
    return this.game.storyIndex >= STORY_MISSIONS.length;
  }

  currentGiver() {
    if (this.storyDone) return null;
    return STORY_MISSIONS[this.game.storyIndex].giver;
  }

  // Walk into a giver marker: open the intro dialogue, then start.
  tryStartStory() {
    if (this.active || this.storyDone) return false;
    const mission = STORY_MISSIONS[this.game.storyIndex];
    this.showDialogue(mission.intro, () => this.beginStage(mission, 0));
    this.pendingMission = mission;
    return true;
  }

  beginStage(mission, stageIndex) {
    const stage = mission.stages[stageIndex];
    this.active = {
      mission,
      stageIndex,
      stage,
      collected: 0,
      checkpointIndex: 0,
      timeLeft: stage.timeLimit || null,
      startedAt: this.game.time,
    };
    if (stage.heatOnStart) this.game.police.addHeat(stage.heatOnStart, this.game);
    if (stage.stealKind) this.game.markStolenTarget(stage.stealKind, stage.point);
    this.game.sound.missionDone();
  }

  showDialogue(lines, onDone) {
    this.dialogue = { lines, index: 0, onDone };
  }

  advanceDialogue() {
    if (!this.dialogue) return;
    this.dialogue.index += 1;
    this.game.sound.uiClick();
    if (this.dialogue.index >= this.dialogue.lines.length) {
      const done = this.dialogue.onDone;
      this.dialogue = null;
      if (done) done();
    }
  }

  // The point the HUD arrow and minimap should highlight right now.
  objectivePoint() {
    if (this.active) {
      const s = this.active.stage;
      if (s.collect) return s.collect[this.active.collected] || s.point;
      if (s.checkpoints) return s.checkpoints[this.active.checkpointIndex];
      if (s.loseHeat) return null;
      return s.point;
    }
    if (this.sideJob) return this.sideJob.target;
    return null;
  }

  objectiveText() {
    if (this.dialogue) return 'Talking…';
    if (this.active) {
      const s = this.active.stage;
      let text = s.text;
      if (s.collect) text = `Collect the washed-up money bags (${this.active.collected}/${s.collect.length})`;
      if (s.checkpoints) text = `${this.active.mission.title}: checkpoint ${this.active.checkpointIndex + 1}/${s.checkpoints.length}`;
      if (this.active.timeLeft !== null) text += ` — ${Math.max(0, Math.ceil(this.active.timeLeft))}s`;
      if (s.loseHeat) text = 'Lose the police: break their line of sight';
      return text;
    }
    if (this.sideJob) return this.sideJob.text;
    if (this.storyDone) return 'Port Solano is yours. Side jobs still pay — find a glowing marker.';
    const giver = this.currentGiver();
    return giver ? `Meet ${giver.name} at the gold marker to start “${STORY_MISSIONS[this.game.storyIndex].title}”` : 'Free roam';
  }

  // Called every frame by main.js.
  update(dt) {
    const game = this.game;
    if (this.banner) {
      this.banner.timer -= dt;
      if (this.banner.timer <= 0) this.banner = null;
    }
    if (!this.active) {
      this.updateSideJob(dt);
      return;
    }
    const a = this.active;
    const s = a.stage;
    if (a.timeLeft !== null) {
      a.timeLeft -= dt;
      if (a.timeLeft <= 0) {
        this.failStage('Out of time. The job resets — try again from the giver.');
        return;
      }
    }
    const player = game.player;
    if (s.collect) {
      const target = s.collect[a.collected];
      if (target && distance(player.x, player.y, target.x, target.y) < 44) {
        a.collected += 1;
        game.sound.cash();
        game.addCash(40);
        if (a.collected >= s.collect.length) this.completeStage();
      }
      return;
    }
    if (s.checkpoints) {
      const target = s.checkpoints[a.checkpointIndex];
      if (target && distance(player.x, player.y, target.x, target.y) < 78) {
        a.checkpointIndex += 1;
        game.sound.pickup();
        if (a.checkpointIndex >= s.checkpoints.length) this.completeStage();
        else if (a.timeLeft !== null) a.timeLeft += 12;
      }
      return;
    }
    if (s.loseHeat) {
      if (game.police.stars === 0) this.completeStage();
      return;
    }
    if (s.point) {
      const d = distance(player.x, player.y, s.point.x, s.point.y);
      const inCarOk = !s.needCar || !!player.car;
      if (d < (s.needCar ? 88 : 52) && inCarOk) {
        if (s.stealKind) {
          // This stage completes only when the marked car is taken.
          if (game.stolenTargetTaken) this.completeStage();
        } else {
          this.completeStage();
        }
      }
    }
  }

  completeStage() {
    const game = this.game;
    const a = this.active;
    const nextIndex = a.stageIndex + 1;
    if (nextIndex < a.mission.stages.length) {
      this.beginStage(a.mission, nextIndex);
      return;
    }
    // Mission complete: pay out, tell the story beat, save progress.
    const mission = a.mission;
    this.active = null;
    game.addCash(mission.reward);
    game.respect += 1;
    game.storyIndex += 1;
    game.sound.missionDone();
    this.banner = { title: `Mission complete: ${mission.title}`, sub: `+$${mission.reward} — respect grows in Port Solano`, timer: 4.2 };
    this.showDialogue(mission.outro, null);
    game.saveProgress();
    this.refreshSideOffer();
  }

  failStage(reason) {
    this.active = null;
    this.banner = { title: 'Job failed', sub: reason, timer: 3.6 };
    this.game.sound.busted();
  }

  // --- Side activities -------------------------------------------------
  refreshSideOffer() {
    const game = this.game;
    const kind = SIDE_KINDS[game.rng.int(0, SIDE_KINDS.length - 1)];
    const spots = [
      { x: 620, y: 1160 }, { x: 2280, y: 620 }, { x: 1150, y: 2050 },
      { x: 2750, y: 1250 }, { x: 480, y: 380 }, { x: 1900, y: 1080 },
    ];
    const spot = spots[game.rng.int(0, spots.length - 1)];
    this.sideOffer = { ...kind, x: spot.x, y: spot.y };
  }

  tryStartSideJob() {
    if (this.sideJob || !this.sideOffer) return false;
    const game = this.game;
    const offer = this.sideOffer;
    if (offer.kind === 'taxi') {
      const passenger = game.crowd.addPed(offer.x + 18, offer.y + 10, game.rng);
      passenger.role = 'passenger';
      passenger.state = 'passenger';
      const drop = { x: 400 + game.rng.range(0, 2600), y: 300 + game.rng.range(0, 1500), name: 'Drop-off' };
      this.sideJob = { kind: 'taxi', phase: 'pickup', passenger, target: drop, text: 'Pick up the passenger (get in a car, they will come to you)' };
    } else if (offer.kind === 'courier') {
      const drop = { x: 300 + game.rng.range(0, 2700), y: 260 + game.rng.range(0, 1600), name: 'Client' };
      this.sideJob = { kind: 'courier', phase: 'deliver', target: drop, timeLeft: 75, text: 'Courier: reach the client before the timer ends' };
    } else {
      const points = [];
      for (let i = 0; i < 5; i++) points.push({ x: 260 + game.rng.range(0, 2700), y: 240 + game.rng.range(0, 1650), name: `Gate ${i + 1}` });
      this.sideJob = { kind: 'race', phase: 'run', points, index: 0, target: points[0], timeLeft: 95, text: 'Race: hit every gate before the timer ends' };
    }
    this.sideOffer = null;
    game.sound.pickup();
    return true;
  }

  updateSideJob(dt) {
    const job = this.sideJob;
    if (!job) return;
    const game = this.game;
    const player = game.player;
    if (job.timeLeft !== undefined && job.timeLeft !== null) {
      job.timeLeft -= dt;
      job.text = job.kind === 'courier'
        ? `Courier: reach the client — ${Math.ceil(job.timeLeft)}s`
        : `Race: gate ${job.index + 1}/${job.points.length} — ${Math.ceil(job.timeLeft)}s`;
      if (job.timeLeft <= 0) {
        this.sideJob = null;
        this.banner = { title: 'Side job failed', sub: 'Out of time.', timer: 3 };
        this.refreshSideOffer();
        return;
      }
    }
    if (job.kind === 'taxi') {
      if (job.phase === 'pickup') {
        if (player.car && distance(player.x, player.y, job.passenger.x, job.passenger.y) < 60) {
          job.phase = 'deliver';
          job.passenger.state = 'down';   // aboard: hidden until drop-off
          job.passenger.dead = false;
          job.text = 'Drive the passenger to the drop-off marker';
          game.sound.door();
        }
      } else if (distance(player.x, player.y, job.target.x, job.target.y) < 84 && player.car) {
        const fare = 60 + Math.round(distance(job.target.x, job.target.y, player.x, player.y) / 10) + game.rng.int(10, 60);
        this.finishSideJob(`Fare paid: +$${fare}`, fare);
      }
      return;
    }
    if (job.kind === 'courier') {
      if (distance(player.x, player.y, job.target.x, job.target.y) < 70) {
        this.finishSideJob('Package delivered: +$130', 130);
      }
      return;
    }
    if (job.kind === 'race') {
      const target = job.points[job.index];
      if (distance(player.x, player.y, target.x, target.y) < 84) {
        job.index += 1;
        game.sound.pickup();
        if (job.index >= job.points.length) {
          this.finishSideJob('Race won: +$200', 200);
        } else {
          job.target = job.points[job.index];
          job.timeLeft += 10;
        }
      }
    }
  }

  finishSideJob(text, cash) {
    const game = this.game;
    game.addCash(cash);
    game.sideJobsDone += 1;
    game.sound.cash();
    this.banner = { title: 'Side job complete', sub: text, timer: 3.4 };
    this.sideJob = null;
    game.saveProgress();
    this.refreshSideOffer();
  }
}
