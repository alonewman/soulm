# DEEPHOLD

First-person horror made only of ASCII text, built to be played on a phone held sideways.
A few bullets, a lantern, and a dwarven fortress that never ends. Four hand-built levels and a boss.

## Play

Open `index.html` in a browser (phone or desktop). For a public link, enable GitHub Pages
(Settings > Pages > Deploy from a branch > `main` / root) or deploy the folder as a static site.

## Controls

- **Phone:** drag on the left to walk (drag far to run); drag on the right to look; buttons FIRE, RUN, RELOAD.
- **Keyboard:** WASD move, arrows/Q/E turn, Space fire, Shift run, R reload, Esc pause.

## Structure

| File | Contents |
|---|---|
| `levels.js` | maps, notes and settings for each level |
| `core.js` | state, collision, enemies, light |
| `render.js`, `art.js` | ASCII raycaster, palette, sprites |
| `logic.js` | player, combat, enemy AI, level flow |
| `audio.js` | synthesized sound (WebAudio) |
| `input.js`, `main.js`, `shell.html` | controls, interface, page |

## Development

```
python3 build.py            # builds index.html (single file) from the parts
node tests/test_levels.js   # validates the maps and that everything is reachable
node tests/test_sim.js      # a bot plays all 4 levels to the end
```
