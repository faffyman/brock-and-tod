# Brock & Tod

A small first-person mountain bike game for phone browsers, made for fun for
[Trailbadger](https://trailbadger.com). You are Brock the badger. Chase Tod the
fox through the forest for as long as you can.

- Plays in any modern mobile or desktop browser.
- Installs to the home screen and then works fully offline.
- About 400 KB in total. No accounts, no tracking, no network calls.

## Play it locally

The game is plain files, but browsers only load JavaScript modules over HTTP,
so opening `index.html` directly does not work. Serve the folder instead:

```bash
git clone git@github.com:faffyman/brock-and-tod.git
cd brock-and-tod
python3 -m http.server 8000
```

Then open <http://localhost:8000>. Any static file server works just as well
(`npx serve`, `php -S localhost:8000`, and so on).

To play on a phone on the same Wi-Fi, start the server with
`python3 -m http.server 8000 --bind 0.0.0.0` and open
`http://<your computer's IP>:8000` on the phone. Installing to the home screen
and offline play need HTTPS (or `localhost`), so for those use a tunnel or a
static host.

### Controls

| Action | Touch | Keyboard |
|--------|-------|----------|
| Steer | Touch the left or right half of the screen | Arrow keys, or A and D |
| Use a stored boost | Hold both halves at once | Hold left and right together |
| Start or restart | Tap | Space or Enter (1, 2, 3 pick a difficulty) |
| Pause | Pause button | P or Escape |

The buttons in the top left corner open How to play, Sound, Stats and
Accessibility (reduce motion, easy ride).

## For developers

There is no build step, no framework and no dependencies. Edit a file, reload
the page.

### Layout

```
index.html              Page shell: canvas, HUD, menus and dialogs
manifest.webmanifest    Install metadata
sw.js                   Service worker: offline cache, network first
css/game.css            All styling for the HTML overlay
assets/img/             Logo and app icons
js/config.js            Every tuning value, plus the GameState typedef
js/world.js             All game rules. No DOM access, runs in Node
js/main.js              Game loop, HUD, menus, dialogs, announcements
js/input.js             Touch, pointer and keyboard input
js/audio.js             All sound, synthesised with Web Audio (no audio files)
js/storage.js           High scores, stats and settings in localStorage
js/pwa.js               Service worker registration and install prompt
js/render/scene.js      Sky, ground, trees, themes, night, effects
js/render/sprites.js    Tod, ramps, pickups, hazards
js/render/cockpit.js    Handlebars and Brock's paws
js/render/indicator.js  Shield cue and the "Tod is out of sight" arrow
js/render/anim.js       Render clock (stops when paused) and pose blending
tasks/todo.md           Design notes and a review of each build pass
```

### How it fits together

- `js/config.js` is the contract. Tuning lives in `CONFIG`, and the `GameState`
  typedef documents every field the modules share. To change how the game
  feels, start there.
- `js/world.js` owns the rules and mutates one state object each frame:
  `updateWorld(state, dt, steerInput, boostHeld)`. It never touches the DOM, so
  it can be imported and simulated in Node.
- The renderers and the audio module only read that state. Audio and effects
  find events by comparing each frame with the previous one, so the game loop
  just calls `drawScene`, `drawCockpit`, `drawIndicator` and `audio.update`.
- Everything on the canvas is drawn in code with flat fills. There are no
  sprite sheets. Projection is a simple pinhole:
  `scale = view.focal / z`, `screenX = view.w / 2 + (x - player.x) * scale`.

### Things to know before changing it

- **New files must be added to `PRECACHE` in `sw.js`**, or installed copies
  will not have them offline.
- The service worker is network first with a 3 second timeout, so an online
  launch always gets the newest files and there is no version number to bump.
  While developing, a hard reload or a private window avoids stale copies.
- What is drawn must match what is collided with. A tree trunk is
  `2 * CONFIG.trunkRadius` wide at the ground in every theme, and hazard spans
  are drawn to the pixel.
- Accessibility rules to keep: no blink faster than `CONFIG.maxBlinkRate`,
  every canvas effect respects `state.reduceMotion`, and no cue relies on
  colour alone.
- In player-facing text the badger is Brock and the fox is Tod, and neither is
  given a pronoun.
- Storage keys start with `trailbadger.` for historical reasons. Renaming them
  would wipe players' saved scores.

### Checking changes

There is no test suite. Useful quick checks:

```bash
# Syntax check every module
for f in js/*.js js/render/*.js sw.js; do node --check "$f"; done
```

`js/world.js` can be driven from a Node script to simulate runs and check
rules or balance, for example:

```js
import { createWorld, resetWorld, updateWorld } from './js/world.js';

const state = createWorld();
resetWorld(state, 'normal');
while (state.mode === 'riding') updateWorld(state, 1 / 60, 0, false);
console.log(state.mode, Math.round(state.distance), state.crashCause);
```

## Credits and licence

The Trailbadger name and logo belong to Trailbadger. They are not covered by
any licence for the code, so replace them if you fork this for something else.
No licence has been chosen for the code yet, so all rights are reserved until
one is added.
