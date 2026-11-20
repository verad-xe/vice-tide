# vice-tide

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/verad-xe/vice-tide/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/verad-xe/vice-tide/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Vice Tide is an original open-world crime game that plays in a desktop browser from static files. Explore the sun-soaked coastal city of Port Solano on foot and by car: traffic and pedestrians fill the streets, cars can be stolen and driven, crimes raise a wanted level that brings the police, and a chain of missions tells the story of a courier pulled into the city's underworld. It has combat, a HUD with a minimap, a start screen, and saved progress.

## How to play

You arrive in Port Solano with nothing but a name: Mara Venn, who runs work out of the Marina and always has a job for someone willing to drive. Follow the gold marker on the minimap to meet her, then take story missions from her and her contacts as they open up across the city's districts — the Marina, Old Town, Palms Row, the Dockyards, and Coral Bay. Finished missions pay cash and earn respect, and between missions you can pick up side jobs to keep the money coming in: taxi fares, courier runs, and timed races through the streets.

Controls:

- **WASD** or **arrow keys** — move on foot
- **Mouse** — aim
- **Click** — shoot
- **E** — enter or exit a car
- **Space** — handbrake while driving
- **P** or **Esc** — pause

Watch the stars in the corner of the HUD. Stealing cars, starting fights, and other crimes raise your wanted level, and the higher it climbs, the harder the police come after you. Break their line of sight and stay out of trouble to let the heat cool down. Get caught and you are busted; get taken down and you are wasted — either way it costs you. Your progress is saved in the browser automatically, so you can close the tab and pick up where you left off.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. No build step and no network requests: everything the game loads is under `game/`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=05egkt5w&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
