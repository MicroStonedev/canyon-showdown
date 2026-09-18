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

Double-click `moba.html` to open it in your browser — nothing to install, no local server needed.

## Gameplay

### Controls

- `W A S D` — Move
- `Mouse` — Aim
- `Left click` — Basic attack (hold to keep attacking)
- `Right click` — Cast skill (unlocks at level 3)
- `Q` — Use item (hook)

### Rules

- 5v5 match: you + 4 AI teammates vs 5 AI enemies
- Win by destroying the enemy crystal; three lanes with one turret per lane
- **XP only comes from defeating enemy heroes**: 120 XP per kill, 60 per assist (you must have damaged the target within 8 seconds before it died)
- Leveling up increases HP, basic attack, and skill damage; skills unlock at level 3, max level 9
- Regenerate 5% HP per second after being out of combat for 5 seconds; the fountain only serves as a respawn point
- All attacks are non-targeted projectiles that can be dodged by moving; rocks block movement and projectiles, bushes grant stealth

### Four Roles

| Role | Traits | Skill |
|---|---|---|
| 🏹 Marksman | Long-range projectiles, high attack speed | Piercing Arrow: extra-long piercing shot |
| 🗡️ Assassin | Melee with a narrow 1/8-circle hitbox, high burst, cannot attack through walls | Shadow Strike: dash (stops on hitting a wall) |
| 🛡️ Tank | Melee full-circle area damage, thick HP | Earthshatter: area damage + slow |
| ✚ Support | Ranged projectiles; basic attacks that hit allies heal them | Holy Wave: damages enemies and heals friendly units in its path |

### Field Items (random spawns)

❤️ Health pack · 🛡️ Shield · 👻 Invisibility · 👟 Speed boost · 🪝 Hook (fire with Q to drag an enemy to you)

## Technical Notes

- Single HTML file, Canvas 2D rendering, `requestAnimationFrame` main loop
- AI behavior includes dodging projectiles, pathing around rocks, retreating at low HP, grabbing items, and throwing hooks
- No external libraries, no build step, no network requests

## License

MIT
