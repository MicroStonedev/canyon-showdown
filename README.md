English | [简体中文](README.zh-CN.md)

# Canyon Showdown - Web-based 5v5 MOBA Game

A 5v5 tower-pushing battle game built with pure native HTML + CSS + JavaScript. Zero dependencies, single file — open it in a browser and play.

**Play online:** https://microstonedev.github.io/canyon-showdown/

## Game Files

| File | Description |
|---|---|
| `index.html` | Landing page (GitHub Pages entry point) |
| `moba.html` | Canyon Showdown (5v5 MOBA tower-push battle) |
| `champions.html` | Champion design sheet (Canvas concept art) |

## How to Play

Open `index.html` (landing page) or `moba.html` directly — nothing to install, no local server needed. On the login screen, enter your name (up to 10 characters) and pick a language — 中文 or English — the entire UI follows your choice, including menus, announcements, and augment cards.

## Gameplay

### Controls

- `W A S D` — Move
- `Mouse` — Aim (the camera pans when the cursor touches a screen edge and recenters with `Space`)
- `Left click` — Basic attack (hold to keep attacking); shots fire from your weapon and land exactly where you aim
- `Right click` — Cast skill (unlocks at level 3)
- `Q` — Use item (hook)
- `ESC` — Settings / pause
- `M` — Mute
- `Mouse wheel` — Zoom the camera

### Rules

- 5v5 match: you + 4 AI teammates vs 5 AI enemies on a wide two-lane map (2000 × 900)
- 8 turrets — two per lane per team (outer + inner) — plus a crystal that fights back with homing shots
- Win by destroying the enemy crystal
- **Turret shots lock on**: once fired they chase you any distance and cannot be dodged — leave the turret's range before it fires, or bring friends
- **XP only comes from defeating enemy heroes**: 170 XP per kill, 100 per assist (you must have damaged the target within 8 seconds before it died); each level costs 100 XP, so matches end around level 8–9
- Leveling up increases HP, basic attack, and skill damage; skills unlock at level 3, max level 9
- Regenerate 5% HP per second after being out of combat for 5 seconds (attacking counts as combat); the fountain only serves as a respawn point
- All hero attacks are non-targeted projectiles that can be dodged by moving; rocks block movement and projectiles, bushes grant stealth
- **Multi-kill announcements**: double / triple / quadra / penta kill when you score several kills within a 10-second window
- **MVP**: the end screen crowns the match MVP (kills ×3 + assists ×1.5 − deaths ×2 + damage/400)

### HUD

- Top right — your K / D / A
- Left of the HP bar — your stats: attack damage, attack speed, move speed, ability haste (plus crit / dodge / vamp / damage reduction when you own the matching augments)
- Above the HP bar — your augments with live stack counters (evil AD, science AD, tank stacks, haste, storm %, quest %)

### Four Roles

| Role | Traits | Skill |
|---|---|---|
| 🏹 Marksman | Long-range projectiles, high attack speed | Piercing Arrow: extra-long piercing shot |
| 🗡️ Assassin | Melee with a narrow 45° frontal hitbox, high burst, cannot attack through walls | Shadow Strike: dash (stops on hitting a wall) |
| 🛡️ Tank | Melee 360° area damage, thick HP | Earthshatter: area damage + slow |
| ✚ Support | Ranged projectiles; basic attacks that hit allies heal them | Holy Wave: damages enemies and heals friendly units in its path |

### HEX Augments (levels 2 / 5 / 8)

At levels 2, 5, and 8 the match pauses and you pick one of three augments — ARAM-style, with a Prismatic tier (25%, powerful) and a Gold tier (75%, standard). Every champion rolls from the same pool; each augment is unique per game, and its live stack counter is shown above your HP bar.

- **Prismatic**: 🎲 Dice Gambler · ♾️ Infinite Loop · 🚜 Tank Engine · 😈 Super Evil · 🔮 Spell Crit · 🗡️ Twin Blades · 🦵 Flying Kick · 🎯 Might Quest
- **Gold**: 💖 Blessing (support-only) · 🩸 Vampirism · 🔬 Shrink Engine · 👻 Soul Siphon · 👹 Shoulder Demon · 🧪 Mad Scientist · 💪 Mighty · 🔨 Giant Slayer · 🌌 Astral Body · 🪶 Agility · ⏱️ Swift Quest · ✊ Grasp · 💀 Dark Harvest · ⛈️ Storm Gathering

### Rare Team Buffs (Ancient Crystals)

Three times per match, an ancient crystal spawns on the river line — top, middle, or bottom, announced 25 seconds in advance with a countdown marker on the map. Whoever picks it up grants a **permanent buff to their entire team** (random type): ⚔️ +12 AD · ❤️ +90 HP · 👟 +20 move speed · ⏱️ +15 ability haste · 🛡️ −4% damage taken. Only one exists at a time and it fades after 45 seconds if unclaimed — contests over it are the heart of the mid game.

### Maps

Pick a map on the login screen — hover a card for a description; your choice is remembered.

- **Grasslands** — the classic layout: river, rocks, and balanced bushes
- **Molten Cauldron** — lava river and pools: standing in lava slows you by 40% and burns 6% max HP per second (it never kills); bots steer around it
- **Jungle** — extra-large bushes everywhere, limited vision — ambush heaven

### Field Items (random spawns)

❤️ Health pack · 🛡️ Shield · 👻 Invisibility · 👟 Speed boost · 🪝 Hook (fire with Q to drag an enemy to you)

## Technical Notes

- Single HTML file, Canvas 2D rendering, `requestAnimationFrame` main loop
- Rectangle hitboxes framed on the champion models; turret shots are homing and undodgeable, champion projectiles are dodgeable skillshots
- AI behavior includes dodging projectiles, pathing around rocks, retreating at low HP, grabbing items and map buffs, throwing hooks, and fighting for turrets
- Sound effects and background music are fully synthesized with the Web Audio API — zero audio assets; the generative chiptune BGM shifts between menu and battle intensity
- Audio settings (master / music / SFX volume, mute) live behind the ⚙ button or `ESC`; they pause the match in-game and persist via `localStorage`
- Bilingual UI (简体中文 / English) selected on the login screen
- No external libraries, no build step, no network requests

## License

MIT
