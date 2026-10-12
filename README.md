# Isomarble Run

An isometric marble run toy. Build a track out of pixel-art blocks, drop some marbles on it and watch them roll, fall and paint the track in their colours.

**Play it:** https://james-ws-mccullough.github.io/isomarble-run/

![A marble run with two marbles rolling along a colourful track](docs/screenshot.png)

## How to play

| Tool | What it does |
| --- | --- |
| 🔨 Place | Pick a piece from the palette and click an empty cell to place it. Click a piece to remove it. |
| ✋ Move | Drag a piece to move it. |
| ⬚ Select | Drag a box to select pieces, then drag the selection to move them together. |
| ⚪ Marble | Click anywhere to drop a marble. |
| 🕳️ Deepen | Left-click a piece to add a wall layer below it. Right-click to remove one. |

Press **Step** to move the marbles one cell at a time, or tick **Auto** to let them run. Tick **Sound** for rolling and landing sounds.

## Running locally

You'll need [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Build the static site into `out/` |
| `npm run check` | Run lint, type checking and tests (what CI runs) |
| `npm run lint` / `npm run lint:fix` | Check / fix formatting and lint with [Biome](https://biomejs.dev) |
| `npm run typecheck` | Type-check with TypeScript |
| `npm test` | Run the unit tests with [Vitest](https://vitest.dev) |

## How it works

The board is a 2D grid drawn as an isometric diamond: +x runs down-right and +y runs down-left. Moving +1 in **both** x and y moves straight down the screen by exactly one block, so "falling" is just a step along that diagonal. This is what lets a flat grid look like a 3D structure.

Each simulation step moves every marble exactly one cell, using a small state machine:

- **rolling**: the marble is on a block. The block's behaviour (in `block-types.ts`) decides which way it goes next, based on the direction it arrived from.
- **falling**: there's no block, so the marble drops one cell.
- **behind**: the marble rolled off the *back* of the track, so it's drawn behind the blocks until it falls clear of them.

Marbles that reach the bottom of the grid wrap back to the top, and marbles that roll off the side are removed. Each marble paints the blocks it rolls over and changes colour every time it starts a new fall.

### Project layout

```
src/
  app/page.tsx              Page: wires the world, editor and sound together
  components/
    IsometricGrid.tsx       The board: renders blocks/marbles, reports pointer events
    IsometricSprite.tsx     One block or wall sprite
    Marble.tsx              One marble
    Sidebar.tsx             Tools, palette and simulation controls
  hooks/
    useTrackEditor.ts       Tool state and pointer handling
    useMarbleSounds.ts      Landing and rolling sounds
  lib/
    block-types.ts          Block definitions and behaviours
    marble-state-machine.ts How a single marble moves each step
    world.ts                World state, reducer and simulation step
    editing.ts              Pure helpers for placing/moving blocks
    isometric.ts            Grid ↔ screen maths
public/
  sprites/                  Block and marble art
  audio/                    Sound effects
```

## Deployment

Every push to `main` runs the checks in `.github/workflows/ci.yml` and publishes the static build to GitHub Pages. Pull requests run the same checks without deploying.
