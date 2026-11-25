# Trail Badger: basic gameplay

An original first-person forest dodge game for mobile browsers. The player is a
badger on a mountain bike. It takes the genre idea (ride fast through trees, do
not hit one) but has its own name, art and palette. It does not copy the look of
any existing game.

## Scope of this pass

- Auto forward ride through an endless forest, speed ramps up slowly.
- Touch the left half of the screen to steer left, the right half to steer right.
  Arrow keys and A/D for desktop testing.
- Hit a trunk: crash, show distance and best, tap to ride again.
- Handlebars at the bottom of the screen with two badger paws on the grips.
- Out of scope for now: enemies, shooting, sound, levels, saved high scores.

## Tech

Raw JS ES modules, one 2D canvas, no build step, no dependencies. ES modules
need HTTP, so serve the folder (for example `python3 -m http.server`).

## Files

| File | Owner | Purpose |
|------|-------|---------|
| `js/config.js` | done | Tuning values, `GameState` and `View` typedefs (the contract) |
| `index.html` | Agent A | Canvas, HUD overlay, viewport meta |
| `css/game.css` | Agent A | Full-screen layout, HUD, no scroll or zoom |
| `js/main.js` | Agent A | Canvas sizing, game loop, mode changes, HUD text |
| `js/input.js` | Agent A | Touch halves and keyboard |
| `js/world.js` | Agent A | Trees, steering, recycle, collision |
| `js/render/scene.js` | Agent B | Sky, ground, trees |
| `js/render/cockpit.js` | Agent B | Handlebars and badger paws |

## Module contract

```js
// world.js
createWorld(): GameState            // mode 'ready', trees placed
resetWorld(state): void             // new run, keeps state.best and state.time
updateWorld(state, dt, steerInput)  // steerInput is -1, 0 or 1; always advances state.time

// input.js
createInput(element): { steer(): -1|0|1, onTap(callback): void }

// render/scene.js
drawScene(ctx, state, view): void   // paints the whole canvas

// render/cockpit.js
drawCockpit(ctx, state, view): void // paints over the scene
```

Projection, used by both scene and collision reasoning:

```
scale   = view.focal / tree.z
screenX = view.w / 2 + (tree.x - state.player.x) * scale
baseY   = view.horizonY + CONFIG.cameraHeight * scale
```

## Pass 2: jumps, fox chase, splash

Rules:

- **Fox.** A fox on a bike rides ahead and weaves sideways to lose the badger.
  It is slightly faster than the unboosted badger, so the gap grows slowly. It
  is never closer than `foxMinDistance`. The fox is out of sight when
  `abs(fox.x - player.x) / fox.z > state.viewHalfTan` or `fox.z > foxMaxDistance`.
  Out of sight for `foxLostLimit` seconds in a row ends the run with mode `lost`.
- **Ramps.** A ramp appears every `rampGapMin` to `rampGapMax` metres. Riding
  over it (ramp z crosses `hitDistance` with `abs(dx) < rampHalfWidth`) launches
  the badger and gives a speed boost for `boostTime`, which closes the gap to
  the fox. Missing a ramp has no penalty. Ramps are not obstacles. Trees still
  hit while airborne, so a corridor past each ramp is kept free of trees.
- **Levels.** `level = min(maxLevel, 1 + floor(distance / levelDistance))`.
  The level sets the target speed, linear from `startSpeed` at level 1 to
  `maxSpeed` at level 10. Speed eases up to the target at `acceleration`. The
  HUD shows the level and flashes "Level N" briefly on each level-up.
- **Difficulty.** The splash has three buttons: Beginner, Normal, Expert.
  Tapping one starts a run with that tree count (70, 110, 150). Nothing else
  differs. To keep every setting fair, no two trees may sit within `treeGapX`
  sideways of each other when they are within `treeGapZ` along the trail, so
  there is always a rideable gap. The end screen has "Tap to ride again" (same
  difficulty) and a Menu button back to the splash. Best distance is kept per
  difficulty.
- **Splash.** The ready screen shows `assets/img/trailbadger-logo.jpg`, a one
  line goal and "Tap to ride".

Projection with jump height (replaces the earlier baseY line):

```
baseY = view.horizonY + (CONFIG.cameraHeight + state.player.y) * scale
```

Files:

| File | Owner | Change |
|------|-------|--------|
| `js/config.js` | done | Jump and fox tuning, extended `GameState` |
| `js/world.js` | Agent A | Ramps, jump physics, boost, fox, `lost` mode |
| `js/main.js`, `index.html`, `css/game.css` | Agent A | Splash with logo, `lost` message, `viewHalfTan`, call `drawIndicator` |
| `js/render/scene.js` | Agent B | Draw ramps and fox in depth order, jump camera height |
| `js/render/sprites.js` | Agent B | New: `drawFox`, `drawRamp` |
| `js/render/indicator.js` | Agent B | New: `drawIndicator(ctx, state, view)`, edge arrow and countdown when the fox is out of sight |
| `js/render/cockpit.js` | Agent B | Lift in the air, bump on landing, `lost` mode |

- [x] Agent A: world, shell, splash
- [x] Agent B: fox, ramps, indicator, cockpit
- [x] Integration check

### Pass 2 review

2026-11-24. Checked in Chromium: splash with logo and three buttons fits at
390 x 844 and 844 x 390, Beginner starts a run, the fox shows ahead, the level
pill and "Level 2" flash work, a crash shows the end screen with difficulty,
level, best and a Menu button. No console errors.

Node simulation (Agent A): both endings occur, ramps launch and close the fox
gap, no tree ever sits in a landing corridor, level caps at 10, tree counts are
70, 110 and 150. A rider that follows the fox and dodges trees averages 1629 m
on Beginner, 1419 m on Normal and 1190 m on Expert.

After the check the fox was moved closer (start 30 m, floor 16 m, limit 100 m,
weave 18 m) because it was only about 13 px tall in portrait. The simulation
numbers above predate that change.

Not yet checked in a browser: hitting a ramp, the out-of-sight arrow, the
`lost` screen, the Menu button, 360 x 640, and anything on a real phone.

Open tuning points: the difficulty gradient is gentle, and levels 1 to 5 feel
similar because speed only reaches 29 m/s by level 6.

## Pass 3: bigger fox, stored boost, score, high scores

- **Fox.** Drawn `foxSize` times larger, with stronger contrast against the forest.
  Game logic is unchanged.
- **Stored boost.** Every `jumpsPerCharge` landed jumps earns one charge, up to
  `maxCharges`. Holding left and right together fires one charge:
  `chargeBoostTime` seconds of boost. One charge per press; release and press
  again for the next. While both are held, steering is neutral.
- **Score.** `score = floor(distance * pointsPerMetre) + jumps * jumpBonus`.
  A jump counts when it is landed.
- **High scores.** Best score per difficulty, kept in `localStorage` under
  `storageKey`. All storage access is wrapped in try/catch and the game works
  without it.

- **Info.** A small (i) button on the splash and end screens opens a
  how-to-play panel. Hidden while riding. No run starts while it is open.

| File | Owner | Change |
|------|-------|--------|
| `js/config.js` | done | Charge, score and `foxSize` values, extended `GameState` |
| `js/world.js` | Agent A | Count jumps on landing, charges, score, `updateWorld(state, dt, steerInput, boostHeld)` |
| `js/input.js` | Agent A | `both()`: left and right held together |
| `js/storage.js` | Agent A | New: load and save high scores |
| `js/main.js`, `index.html`, `css/game.css` | Agent A | Score HUD, charge HUD, best scores on splash and end screen |
| `js/render/sprites.js`, `js/render/scene.js` | Agent B | Bigger, clearer fox |

- **Install and offline.** `manifest.webmanifest`, `sw.js` and `js/pwa.js`
  make the game installable and fully offline. The service worker precaches
  every game file, then serves network first with a 3 second timeout and falls
  back to the cache. So an online launch always gets and stores the newest
  files, and an offline launch runs the last stored copy. No version number to
  bump. Any new file must be added to the precache list in `sw.js`.
  An Install button shows after the first run where the browser offers a
  prompt (Android, desktop Chrome and Edge). iOS has no prompt, so it shows a
  hint: Share, then Add to Home Screen. Needs https or localhost.

- [x] Agent A (stored boost, score, high scores, info panel, install and offline)
- [x] Agent B (bigger fox)
- [x] Integration check

### Pass 3 review

2026-11-24. Checked in Chromium: splash with best scores under the buttons,
info button and how-to-play panel, HUD with score, distance, level, charge
icons and progress dots, larger fox visible at the start of a run. Service
worker active and controlling the page, 18 files cached, manifest served.
With the browser set offline, a reload showed the splash and logo and a run
could be played, with no failed requests or page errors.

Node simulation (Agent A): charges earned at 5 landings and capped at 3, one
charge per press, score formula exact, new-best logic and storage validation
correct. Fox-following rider averages about 1400 m Beginner, 1320 m Normal,
965 to 1349 m Expert; most runs end by losing the fox, not by hitting a tree.

Not yet checked in a browser: firing a stored boost with two touches, the
"+100" and "Boost!" flashes, saving and reloading a high score, the Install
button and the iOS hint, the update path (change a file, relaunch online),
and anything on a real phone.

## Pass 4: sound

All sound is synthesised in code with the Web Audio API. No audio files, so
nothing to download, license or add to the offline cache apart from one module.

- **Music.** A light, quiet loop. Plays on every screen once the player has
  touched the page (browsers block sound before that), quieter off the trail.
- **Effects.** Badger panting in time with speed, whoosh on a jump and on a
  boost, thud on landing, chime on level-up, a short warning tick while the fox
  is out of sight, crash sound, and a "fox got away" sound.
- **Settings.** A sound button on the splash and end screens opens a panel:
  Music on/off, Effects on/off, Volume normal/low. Saved in `localStorage`
  under `settingsKey`.

Contract for `js/audio.js` (Agent C), wired up by Agent A:

```js
createAudio(): {
  unlock(): void,                 // call inside a user gesture; safe to call many times
  setSettings({ music, effects, volume }): void,
  update(state): void             // once per frame; finds events by comparing with the last frame
}
```

| File | Owner | Change |
|------|-------|--------|
| `js/config.js` | done | Sound settings values |
| `js/audio.js` | Agent C | New: all synthesis and event detection |
| `js/storage.js` | Agent A | `loadSettings`, `saveSettings` |
| `js/main.js`, `index.html`, `css/game.css`, `sw.js` | Agent A | Settings panel, wiring, precache entry |

- [x] Agent C
- [x] Agent A
- [x] Integration check

### Pass 4 review

2026-11-24. Checked in Chromium at 390 x 844: page loads with the audio
module, speaker button opens the Sound panel, Music off and Volume low apply,
are written to `localStorage` and survive a reload, a run starts afterwards,
no page or console errors.

Agent C measured peaks in Chromium on a scripted run: overall 0.70 with no
clipping, crash loudest, ride (music plus panting) about 0.11. Landing was
lowered after measuring and not re-measured.

Nobody has heard it. Sound character (panting, music over several minutes,
crash on phone speakers) needs a listen on a phone, and iOS unlock on first
touch is untested. Tuning constants are at the top of `js/audio.js`.

## Pass 5: shielded boost with tree bounce

- Firing a stored charge sets `state.shield = chargeBoostTime`. It counts down
  while riding. A ramp boost gives no shield.
- While `shield > 0`, a tree hit does not end the run. The rider bounces off:
  placed just clear of the trunk on the side they were already on, with a
  sideways kick that dies away. `bounceTime`, `bounceDir` and `bounces` record it.
- When the shield reaches 0 the rider can crash again. The last
  `shieldWarnTime` second is shown as a warning.
- The fox can still be lost while shielded.

| File | Owner | Change |
|------|-------|--------|
| `js/config.js` | done | Bounce values, `shield`, `bounceTime`, `bounceDir`, `bounces` |
| `js/world.js`, `js/main.js`, `index.html` | Agent A | Shield and bounce logic, how-to-play text |
| `js/render/` | Agent B | Shield cue, bounce jolt |
| `js/audio.js` | Agent C | Bounce sound, shield ending cue |

- [x] Agent A
- [x] Agent B
- [x] Agent C
- [x] Integration check (Node only, see below)

### Pass 5 review

2026-11-25. Logic tests (Node): bounce places the rider 1.2 m from the trunk
centre on the correct side, protection ends at 4 s, a ramp boost gives none,
200 unsteered Expert runs had no crash while protected and 232 bounces, the
fox can still be lost while protected.

Integration (Node, real world, render and audio modules with a stub canvas, 60
runs at both screen shapes, about 32,000 frames, 58 bounces): no exception from
any module, syntax check clean on every file.

Render agent looked at still frames in its own harness: glow, draining arc,
warning blink, bounce burst on the correct side, shield cue with the fox arrow.
Audio agent measured peaks: bounce 0.20, shield warning 0.09, crash 0.79.

Browser check (Chromium, 390 x 844, live page with a test hook exposing state):
firing a charge with both arrow keys gave shield 3.86 and the glow and arc; a
forced trunk hit bounced the rider (mode stays riding, bounces 1, chips on the
trunk side); after the shield reached 0 a forced hit crashed. No page or
console errors. The glow's hard top edge was fixed by running it full height.

Not checked: the jolt motion by eye, how the sounds sound, a real phone. Open choice: the view kicks towards the bounce
direction; flip the sign in `js/render/scene.js` if it feels wrong.

Also 2026-11-25: icons reduced to 128 colour PNG, install size 518 KB to 245 KB.

## Pass 6: near miss, jump combo, score breakdown, fox taunt, pause

- **Near miss.** A trunk that crosses `hitDistance` within `nearMissMargin` of
  a hit, without hitting, scores `nearMissPoints`. Not counted while shielded
  or in the air. No on-screen flash; it shows in the end-of-run breakdown.
- **Jump combo.** Each ramp landed in a row raises the combo, up to `comboMax`.
  A landed jump scores `jumpBonus * combo`. A ramp that passes without being
  hit resets the combo to 0. The landing flash shows the points and the combo.
- **Score breakdown.** The end screen lists distance points, jump points (with
  jumps landed and best combo), near-miss points and the total.
- **Fox taunt.** Every `foxTauntGapMin` to `foxTauntGapMax` seconds the fox
  eases off for `foxTauntTime` (gap closes, it looks back), then sprints for
  `foxSprintTime`. No taunt when the gap is already near `foxMinDistance`.
- **Pause.** A pause button in a top corner while riding. Mode `paused` freezes
  the run. Tap to resume. Leaving the app while riding pauses the run.

| File | Owner | Change |
|------|-------|--------|
| `js/config.js` | done | Combo, near-miss and taunt values, `paused` mode, new state fields |
| `js/world.js`, `js/main.js`, `index.html`, `css/game.css` | Logic agent | All rules, pause button and overlay, breakdown on end screen |
| `js/render/` | Render agent | Fox looks back when taunting, frozen frame when paused |
| `js/audio.js` | Audio agent | Taunt yip, `paused` handling |

- [x] Logic agent
- [x] Render agent
- [x] Audio agent
- [x] Integration check

### Pass 6 review

2026-11-25. Node tests (logic agent): near miss counts only when grounded and
unshielded, combo gives 100, 200, 300 and caps at 5, a missed ramp resets it,
score formula exact, fox phases cycle with the configured times, pause leaves
the state byte-identical over 300 frames and does not fire a stored charge.

Browser check (Chromium, live page with a test hook, 360 x 640 and 844 x 390):
HUD with score, combo, charges and pause button fits at 360 px; pause freezes
distance; Space resumes; window blur auto-pauses; the end card shows the
breakdown table and fits both shapes; fox taunt pose shows. No errors.

Changes after the agents reported:
- `js/render/anim.js` is a new file, added to the precache list in `sw.js`.
- `foxSprintLead` raised from 4 to 7. With 4 the taunt made runs about 60
  percent longer, because each taunt closed more gap than the sprint gave
  back. 7 makes a taunt cycle roughly neutral. Not re-simulated.
- While paused the HUD drops below the corner buttons (`.hud--paused`),
  because it overlapped them at 360 px.

Not checked: sounds by ear, a real phone, the balance after the sprint change.

## Pass 7: pickups

Pickups lie on the trail and are collected by riding over them on the ground
(within `pickupRadius` as they cross `hitDistance`). Missing one has no cost.
They never spawn inside a tree or on a ramp.

- **Berries.** `berryPoints` each. Common, in rows of 1 to `berryRowMax`.
  No flash; they show in the score breakdown.
- **Mushroom** (red and white). Held for `mushroomTime` seconds. While held,
  the fox may be out of sight for `mushroomBonus` longer. `state.lostLimit`
  carries the limit in force. Picking up another restarts the timer.
- **Snake** (green). Hitting it throws it at the fox (`snakeFlightTime`), and
  the fox then rides straight for `snakeStraightTime`: no weaving, no taunt.
- **Acorn.** Rare, none before level `acornMinLevel`, one held at most. A crash
  while holding one uses it up instead of ending the run: nearby trees are
  cleared and the rider gets `respawnShieldTime` of the existing shield. It
  does not save a run lost to the fox.

| File | Owner | Change |
|------|-------|--------|
| `js/config.js` | done | Pickup values and state fields |
| `js/world.js`, `js/main.js`, `index.html`, `css/game.css` | Logic agent | Spawning, collecting, effects, HUD icons, breakdown row, help text |
| `js/render/` | Render agent | Four pickup sprites, snake flight, fox riding straight, respawn effect, limit in the indicator |
| `js/audio.js` | Audio agent | Pickup sounds, snake, respawn, `lostLimit` in the tick |

- [x] Logic agent
- [x] Render agent
- [x] Audio agent
- [x] Integration check

### Pass 7 review

2026-11-25. Node tests (logic agent): every pickup effect, collect radius,
airborne riders pass over, mushroom limit 4 s then back to 3 s, fox dead
straight for 3 s after a snake, acorn save with rider thrown clear and trees
moved, no acorn below level 5, 30 km per difficulty with no pickup inside a
tree or on a ramp, pause freezes all of it, score exact.

Browser check (Chromium, live page with a test hook, 360 x 640): all four
sprites visible on the trail, each collected with the right state change, HUD
shows the mushroom countdown and the acorn, snake wraps the fox, acorn save
keeps the run going with the shield, the next unshielded hit crashes, end card
shows the Berries row and "Acorn saves: 1" and fits, help text lists pickups.
No errors.

Not checked: sounds by ear (snake and acorn levels were retuned after
measuring and not re-measured), landscape for the effects, a real phone.

Tuning notes: berries come about every 90 m and may clutter; the mushroom's
extra second may feel weak; mushroom and snake about every 700 m, acorn about
every 1100 m from level 5.

## Pass 8: catch the fox at the top level

- At level `maxLevel` the fox can be caught. Its cruise lead becomes
  `catchFoxLead` and the `foxMinDistance` floor no longer applies, so boosts
  and taunts close the gap for good.
- Caught when `fox.z <= catchDistance` and the rider is within
  `catchHalfWidth` sideways. Reward `catchPoints`. The run carries on: level
  drops to `catchRestartLevel` (speed follows), and a new fox starts at
  `foxStartDistance`. Distance and score keep counting.
- The end-of-run breakdown gets a "Fox caught" row.

| File | Owner | Change |
|------|-------|--------|
| `js/config.js` | done | Catch values, `catches`, `catchTime`, `levelOrigin` |
| `js/world.js`, `js/main.js`, `index.html`, `css/game.css` | Logic agent | Catch rule, level restart, flashes, breakdown row, help text |
| `js/render/` | Render agent | Catchable cue on the fox, catch celebration |
| `js/audio.js` | Audio agent | Catch fanfare, top-level cue |

- [x] Logic agent
- [x] Render agent
- [x] Audio agent
- [x] Integration check

### Pass 8 review

2026-11-25. Node tests (logic agent): floor holds below the top level, catch
fires once at level 10 when lined up, +1000, level to 5, new fox 30 m ahead in
sprint, speed eases down over about 3 s, held items survive, level climbs
again and a second catch is possible, score exact.

Browser check (Chromium, live page with a test hook, 390 x 844 and 844 x 390):
level pill turns orange at level 10, cyan ring and arrow mark the fox, fox at
9 m draws cleanly, catch gives confetti and paw stamp, level 5 and a new fox
at 30 m straight after, speed 28.9 a few seconds later, end card shows the
"Fox caught" row and fits both shapes. No errors.

Balance (bot, rough): only 9, 4 and 2 of 30 runs reached level 10 on Beginner,
Normal and Expert, and a catch then took 1.5 to 2.8 km. `catchFoxLead` was
changed from 0 to -1.5 after that so a 30 m gap closes in about 20 s. Not
re-simulated. Level length left at 500 m.

Not checked: sounds by ear, a real phone, whether a human reaches level 10.

## Pass 9: hazards

- **Fallen log.** Lies across the trail, `logLength` wide. Riding into it on
  the ground ends the run. A rider in the air (above `logClearHeight`) clears
  it. Trees are kept away from both ends so there is always a way round.
- **Falling tree.** A tree that starts to fall across the trail when the rider
  is `fallTriggerDistance` away and is down after `fallTime`. Once down it acts
  as a log of `fallLength` on the side it fell. Its stump is a normal trunk.
- One log or falling tree per level, at a random point in the level.
- **Bear.** Leans out from behind a tree, at most one per `bearLevelGap`
  levels, none on level 1. It starts to lean out when the tree is
  `bearPeekDistance` away and widens that trunk by `bearReach` on one side.
- **Bird.** Rare. Flies out of a tree across the view and blocks it for
  `birdBlockTime`. It cannot be hit.
- Shield: a log or fallen tree is smashed through; a bear bounces the rider
  off like a trunk. An acorn saves a crash into any of them.
- The end screen says what was hit.

| File | Owner | Change |
|------|-------|--------|
| `js/config.js` | done | Hazard values and state fields |
| `js/world.js`, `js/main.js`, `index.html`, `css/game.css` | Logic agent | Spawning, collisions, crash cause, help text |
| `js/render/` | Render agent | Log, falling tree, bear, bird, smash effect |
| `js/audio.js` | Audio agent | Creak and thud, growl, bird flap, smash |

- [x] Logic agent
- [x] Render agent
- [x] Audio agent
- [x] Integration check

### Pass 9 review

2026-11-25. Node tests (logic agent): every hazard rule, shield smash and
bounce, acorn save, one log or falling tree per level, bears at levels 2, 5
and 8, bird exclusions. Fairness over 20 km per difficulty sampled four times
a second: no hazard without a rideable gap (smallest 2.78 m at a log end,
2.13 m beside a bear), none on ramps or landing corridors, no pickups on
blocked spans.

Render agent measured drawn extents against blocked spans: within 1 px for
log, fallen tree and bear.

Browser check (Chromium, live page with a test hook, 390 x 844): log drawn on
the trail; shielded rider smashes through; a falling tree falls on its own and
a rider in its span ends with "Hit a log!"; the bird covers the view; a bear
leans out from a tree and a rider in its zone ends with "Bear!". No errors.

Changes after the agents reported: `fallTriggerDistance` 75 to 95 so the
warning at level 10 is about 2.4 s instead of 1.85 s (not re-simulated).
Berries made rarer (gap 140 to 300 m) and all pickups drawn smaller, berries
smallest, after phone feedback.

Not checked: sounds by ear, landscape, a real phone. Concern: in portrait a
hazard 80 m away is only a few pixels high, so the falling tree's early lean
may be hard to spot; judge on a phone.

The audio agent looped on its final report and was stopped; its work was
complete.

## Pass 10: stats screen

Lifetime totals kept in `localStorage` under `statsKey`, updated once when a
run ends in a crash or a lost fox (not when a paused run is abandoned from the
Menu). A stats button on the splash and end screens opens a panel. The panel
has a reset button with a confirm step. The game works without storage.

Kept: runs, total distance, longest run, highest level, jumps landed, best
combo, berries, near misses, foxes caught, acorn saves, logs smashed, bounces,
endings by cause (tree, log, bear, fox lost), best score per difficulty (read
from the existing high scores).

| File | Owner | Change |
|------|-------|--------|
| `js/config.js` | done | `statsKey` |
| `js/storage.js`, `js/main.js`, `index.html`, `css/game.css` | Stats agent | Storage, recording, button, panel |

- [x] Stats agent
- [x] Integration check

### Pass 10 review

2026-11-25. Node tests (stats agent): storage survives missing, throwing and
corrupt storage and rejects bad values per field; totals and maxima correct
over three sample runs; save and load round trip.

Browser check (Chromium, live page with a test hook, 360 x 640): three corner
buttons 8 px apart with no overlap, empty state line, one crashed run recorded
once with the right counters, panel shows all groups, stats survive a reload,
two-tap reset zeroes stats and leaves the high score in place. No errors.

Not checked: the panel in landscape, a real phone.

## Pass 11: day and night, themes per level

Colours and tree shapes only. No effect on play, collisions or sizes.

- **Day and night.** Runs alternate: first run of a session is day, the next
  is night, and so on. `state.night` carries it. Night is the same theme with
  a dark sky, moon and stars, and darker ground and trees. The fox, pickups,
  ramps and hazards must stay as easy to see as by day.
- **Themes.** `state.theme` comes from `CONFIG.levelThemes` for the current
  level: spring, autumn, winter, redwood, pine, cherry. Each has its own sky,
  ground, haze and tree set. Colours cross-fade over `themeBlendTime` at a
  level change, with no frame stutter (palettes built ahead of time).

| File | Owner | Change |
|------|-------|--------|
| `js/config.js` | done | `levelThemes`, `themeBlendTime`, `theme`, `night` |
| `js/world.js` | Theme agent | Set `theme` and `night` |
| `js/render/` | Theme agent | Palettes, tree variants per theme, night sky |

- [x] Theme agent
- [x] Integration check

### Pass 11 review

2026-11-25. Theme agent looked at all six themes by day and by night in its
harness (portrait), three in landscape, and a mid-blend frame. Frame cost on
desktop Chromium about 3 ms before and 3 to 3.8 ms after; redwood and cherry
are the heaviest. Tree shapes change only for trees beyond 100 m or as trees
recycle, so nothing pops near the rider; colours cross-fade.

Browser check (Chromium, live page with a test hook, 390 x 844): a real run
stepped through spring, autumn, winter, redwood, pine and cherry with no
errors; the second run was night. Looked at autumn, redwood and cherry by day
and winter by night: each clearly different, fox and pickups stand out.

Change after the agent reported: the first run of a session is now day
(`runCount` in `resetWorld`); as first written it was night.

Not checked: frame rate on a phone (redwood and cherry first), landscape in
the live page, pine and spring night by eye in the live page. Known: the
cockpit is not dimmed at night; sprite distance haze still uses the spring
haze colour; winter night horizon is low contrast.

### Rename, 2026-11-25

The game is now "Brock & Tod": Brock is the badger, Tod is the fox, and
Trailbadger presents it ("A Trailbadger game"). Page title, install manifest,
splash, help text, flashes, end screen and stats labels use the names. Internal
code names and storage keys are unchanged so saved scores survive. New logo
without the ".com" element: `assets/img/trailbadger-logo.webp` (36 KB), icons
rebuilt from it. Splash checked at 360 x 640, 390 x 844 and 844 x 390.

### State at 2026-11-25

Everything on the ideas list is built except the daily seed run, which was
advised against. Install size 398 KB. All game files are in the precache list.
Open items needing a phone: all sound character, frame rate in the heavier
themes, hazard visibility at range in portrait, whether level 10 is reachable.

## Pass 12: accessibility

Audit on 2026-11-25 found the menus sound and the gameplay lacking. This pass:

1. **Flash safety, always on.** No on-off blink faster than `maxBlinkRate`
   (2 per second). The crash flash is no longer full screen.
2. **Reduce motion.** A setting, defaulting to the system preference. When on,
   the canvas has no shake, jolt, zoom pulse, scene roll, confetti, drifting
   snow or petals, speed lines or handlebar bob, and the bird fades in and out
   in place. Steering still turns the handlebars.
3. **Zoom.** The page no longer blocks pinch zoom on menus and dialogs. The
   canvas still ignores gestures so steering works.
4. **Screen readers.** The canvas has a label. A hidden live region announces
   run start, level changes, Tod out of sight, boost ready, and the result.
5. **Not colour alone.** Level 10, the shield and the out-of-sight warning
   each get a shape or text as well as a colour. Berries get a light outline.
6. **Accessibility menu.** A fourth corner button opens a panel with Reduce
   motion and Easy ride. Easy ride multiplies the out-of-sight allowance by
   `easyRideLostFactor` (3 s becomes 4 s; with a mushroom 4 s becomes 5.3 s).
   Easy ride runs are marked on the end screen and share the same high scores.

| File | Owner | Change |
|------|-------|--------|
| `js/config.js` | done | `easyRideLostFactor`, `maxBlinkRate`, settings default, state fields |
| `js/world.js`, `js/storage.js`, `js/main.js`, `index.html`, `css/game.css` | UI agent | Settings, menu, live region, zoom, easy ride rule, non-colour HUD cues |
| `js/render/` | Render agent | Reduce motion in the canvas, blink limit, smaller crash flash, non-colour canvas cues |

- [x] UI agent
- [x] Render agent
- [x] Integration check

### Pass 12 review

2026-11-25. Measured by the render agent (average screen brightness over 120
frames): shield warning 5.5 alternations a second before, 2.0 after; arrow
pulse 5.0 before, 2.0 after; largest single-frame brightness jump in a crash
50.5 before, 5.4 after. With reduce motion on, frames 0.1 s apart are
identical for landing, full-lock steering, snow, petals and boost, and differ
only inside the fading badge for bounce, smash, pickup, catch and respawn.
With reduce motion off and no warning active the scene is pixel-identical to
before, except the outlined ramp, log, bear and berries.

Browser check (Chromium, live page with a test hook): the Accessibility
button and panel fit at 360 px; the system reduced-motion setting is followed
until the player chooses; easy ride gives a 3.99 s allowance; announcements
captured in order for ride start, out of sight, back in sight, level, boost
ready, paused, resumed and the end result; score ticks are not announced.
Looked at: steering with reduce motion on (level horizon, bars still turn),
shield with icon and seconds, arrow with countdown and exclamation marks,
crash edge vignette. No errors.

Not checked: a real screen reader, pinch zoom by hand, a reduce-motion jump.
Open accessibility items, not built: a one-finger boost button, a slower-speed
option. A blind player still cannot play; that is a limit of this game type.


### Phone test by Tim, 2026-11-25

Played through on a real phone: reached level 10, caught Tod, run carried on
from level 5 as designed. Saw redwood, cherry, winter and autumn themes and a
night run, all good. This settles two open items: level 10 is reachable by a
person at the current 500 m level length, and the themes and night mode work
on a phone. Still open: sound by ear, hazard visibility at range, a real
screen reader, pinch zoom by hand.

## Checklist

- [x] Design and contract (`js/config.js`, this file)
- [x] Agent A: shell, loop, input, world
- [x] Agent B: scene and cockpit rendering
- [x] Integration check in a phone-sized browser viewport
- [x] Review section

## Review

2026-11-24. Both halves integrated with no contract changes.

Checked in Chromium at 390 x 844: the page loads with no console errors apart
from a missing favicon, the ready screen shows, Space starts a run, a synthetic
touch on the right half steers right (scene rolls, handlebars and paws turn),
and the distance HUD counts up. `world.js` was simulated in Node: crashes
trigger with no steering, tree count stays at 110 and the forest follows the
player sideways.

Not yet checked: a real phone (touch feel, frame rate, safe areas), landscape
in the integrated page, and the crash and restart flow in the browser.

Known gap: the ready screen has no trees near the camera, so the first seconds
of a run are empty until the forest arrives.
