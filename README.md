# Isomarble Run

An isometric wooden marble run where impossible tracks work. Build a run out of wooden pieces, drop in some glass marbles, and watch them roll and fall. Pieces that only *look* connected really are connected, so you can build Escher-style loops that go downhill forever.

**Play it:** https://james-ws-mccullough.github.io/isomarble-run/

![Glass marbles rolling round an impossible wooden marble run inspired by Escher's Waterfall](docs/screenshot.png)

## How to play

Build with the **hotbar** along the bottom, Minecraft style: press **1–9** to pick a slot, then click on the board. Press **E** to open the inventory and fill the slots with any piece, the marble or a tool (click an item to put it in the selected slot, or drag it onto any slot). Your hotbar is remembered.

| In hand | What clicking does |
| --- | --- |
| 🧱 A piece | Place it on the grid, or on the top or side of a piece. **R** turns it. Pieces snap to the depth where they join up with the track, so you can build impossible joins just by drawing what you want to see. **[** and **]** slide a piece further away or closer without moving it on screen. |
| 🔮 Marble | Drop a marble. |
| ✋ Move | Drag a piece somewhere else. **R** turns the piece under the pointer. |
| 🧽 Erase | Remove a piece. |

Pieces: Straight, Curve, Splitter, Crossing, Catcher, Block, Tube, Outlet, Funnel, Fan, Seesaw, Flip-flop, Portal, Vortex, Dispenser and Hole.

- **🧪 Tube**: a vertical glass pipe. Marbles that fall in the top drop down inside it and land on whatever is below.
- **↪️ Outlet**: a tube with a spout. Marbles blown up to it shoot out of the spout onto the track; marbles rolling into the spout drop down the tube. Keep pressing **R** to turn it upside down: then the spout is at the bottom, and marbles dropping down the pipe come out onto the track one level down.
- **🥤 Funnel**: a wide glass mouth on a tube. Marbles that land anywhere on it, or roll in over its rim, spiral down into the tube below. Press **R** to turn it upside down, so its mouth catches marbles blown up from below.
- **🌀 Fan**: a crossroads with a fan set into the middle, so marbles can roll onto it from any side, and wisps of air show where it blows. It works as a jump pad. Marbles that roll or drop onto it get blown about two tiles up. If they rise into the bottom of a tube (or an upside-down funnel) on the way, the fan sucks them up the whole column like a vacuum, out of the first outlet or the open top. Marbles dropped into a column above a fan sink to the bottom first, then get blown back up.
- **⚖️ Seesaw**: three tiles long, with a stand in the middle and a cup over each end. A marble waits in the low cup; when another lands (or rolls) into the high cup, it tips over and flings the waiting marble into the air, and the new one waits in its place, ready to go again.
- **🔀 Flip-flop**: shaped like a splitter, with a wooden flipper where the branches meet. Marbles coming down the stem go the way the flipper points and knock it over, so they take turns down each branch. Marbles coming up a branch join the stem.
- **🌀 Portal**: a track through a glowing ring. Portals pair up in the order you place them (first with second, third with fourth...), and each pair glows its own colour. A marble rolling into one ring comes out of its twin's, heading the same way relative to the twin, so turning a portal changes where marbles go. A portal on its own glows grey and is just a track.
- **🌪️ Vortex**: a wide wooden cone over 3 by 3 tiles with a hole in the middle. Marbles that land on it or roll in over its rim go round and round, knocking into each other, and spiral in faster and faster until they drop through the hole onto whatever's below: a track, a tube or a funnel.
- **🫙 Dispenser**: a hopper full of marbles that lets one roll out of its side every two seconds, so a run keeps itself going. It waits while there are already lots of marbles about.
- **🕳️ Hole**: a crossroads with a deep hole in the middle. Marbles that roll or drop onto it fall in and are gone: a good end for a dispenser's run.

| Control | Action |
| --- | --- |
| 1–9 | Pick a hotbar slot |
| E | Inventory |
| R / Shift+R | Turn the piece |
| Right-click | Remove a piece, whatever's in hand |
| Scroll | Zoom |
| Shift-drag, middle-drag or arrow keys | Pan |
| [ / ] | Slide the piece you're placing further away / closer |
| Space | Play / pause |
| Ctrl+Z / Ctrl+Y | Undo / redo |
| Ctrl+S | Save |

**💾 Save** (Ctrl+S) keeps your run in this browser, and **📂 My runs** shows all your saved runs as a grid of thumbnails to open, rename or delete. Your current track is also autosaved, so it's still there when you come back.

Press **Load example** to get the starter track back: Escher's Waterfall, where marbles fall off a tower and roll along a "flat" track back to the top.

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

The world is a real 3D grid (x and y across, z up), drawn with a true isometric camera that looks along the diagonal (−1, −1, −1). From that angle, a point and the point one step along *every* axis, p + (1, 1, 1), land on exactly the same spot on screen. A piece one level down and one step forward looks identical to a piece right next door, and the simulation uses that:

- **"If it looks connected, it is connected."** When a marble reaches the edge of a piece, it rolls onto any piece whose groove visibly carries on from this one, at whatever depth it really is. The marble slides along your line of sight to get there, which is invisible from this camera. A join only counts if no wood covers it: heading down the screen (+x or +y) the next piece must be at the same depth or closer to you; heading up the screen it must be the same depth or further away. Otherwise the front wall of one piece would hang over the join and it would look like a step.
- **Building impossible joins.** Every spot on screen is really a whole line of 3D positions. When you place a grooved piece, the game tries each one and picks the one where the piece joins up seamlessly with the most neighbouring track, so you can draw a join and let it work out the hidden depth. Pieces can sit below the floor if that's where a join needs them.
- **Falling uses real gravity.** Marbles leave the end of a track with their speed and fall in an arc. Pieces are solid: a falling marble bounces off their sides and drops down gaps between them, hidden behind anything in front of it. A marble that set off towards the camera also lands on any top face it visibly reaches, even one that is really closer to the camera. A marble falling off the back of a track drops *behind* pieces in front of it.
- **Speed is real too, within limits.** Falls speed marbles up, friction slows them back down to a gentle cruising speed on the flat, curves scrub off a little speed, and catchers bounce marbles back. Falling speed is capped, so endless loops settle into a steady pace.
- **Grooves are rounded channels.** The 3D models and the physics share one groove shape, so marbles sit snugly in the bottom of the groove, roll down into it if they land on the edge, and bounce off the side of a piece that has no opening. Catchers have a wide round bowl with an exit groove, so they catch marbles that land near their edge. Marbles rolling across flat blocks are level with the tops of other pieces, so they roll over the rim into a groove or bowl instead of bouncing off.
- **Marbles bump into each other.** They collide when they visibly touch, either really touching in 3D or rolling on track that visibly joins (even across a hidden change of depth). Marbles that only overlap because one is passing in front of the other don't collide. A marble on track keeps the part of a bump that runs along its groove, so a head-on hit sends it back the way it came.
- Marbles that fall off the bottom of the board come back in at the top. Each marble keeps its own colour and design (swirl, cat's eye, beach ball, galaxy, two-tone or polka dot), so you can follow it round the run.

Everything is drawn with [three.js](https://threejs.org) via [React Three Fiber](https://r3f.docs.pmnd.rs). The wood and marble textures are generated in code, so there are no image files to download.

### Project layout

```
src/
  app/page.tsx            Page: wires the simulation, editor, sound and board together
  components/
    Sidebar.tsx           Marble, track and history controls
    Hotbar.tsx            The numbered hotbar along the bottom of the board
    InventoryDialog.tsx   Everything you can build with, to fill the hotbar
    PieceIcon.tsx         Isometric icons for the palette
  hooks/
    useEditor.ts          Building with what's in hand, and the undoable track
    useHotbar.ts          Hotbar slots, number keys and the remembered layout
    useHistory.ts         Undo/redo for any value
    useSaves.ts           Saved runs in local storage
  lib/
    simulation/           Marble physics
      index.ts            The simulation: stepping marbles, landing and rolling onto pieces
      marble.ts           A marble and what it's doing (flying, rolling, in a tube, held)
      landing.ts          Where a falling marble lands: the "looks connected" rule
      behaviours.ts       What special pieces do when a marble lands or rolls in
      tubes.ts            Tubes, funnels, outlets and fans
      seesaws.ts          Cup seesaws
      dispensers.ts       When each dispenser lets out its next marble
      holes.ts            Marbles dropping into holes
      switches.ts         Which way each flip-flop points
      vortex.ts           Marbles spiralling round a vortex
      collisions.ts       Marbles bumping into each other
      walls.ts            Bouncing off the sides of pieces
      routes.ts           Paths across pieces
      physics.ts          Tuning: gravity, speeds and bounciness
    track.ts              Placed pieces and fast lookups by on-screen position
    pieces.ts             Every kind of piece: its shape, openings and rules
    hotbar.ts             What can go in the hotbar, and its default layout
    portals.ts            Which portals are paired with which
    vortex.ts             The vortex's cone, shared by the physics and the model
    centrelines.ts        Building blocks for the grooves carved into pieces
    grooves.ts            The carved surface, shared by the 3D models and the physics
    paths.ts              Routes across the top of a piece
    space.ts              World coordinates and the isometric projection
    directions.ts         The four horizontal directions
    sound.ts              Web Audio landing taps and speed-matched rolling
    example.ts            The starter track, Escher's Waterfall
    saves.ts              Saving runs and autosaving the current track
    placement.ts          Snapping new pieces to the depth where they join up
    seesaw.ts             Cup seesaw geometry, shared by the physics and the model
    funnel.ts             Funnel shape, shared by the physics and the model
    air.ts                Where the air from each fan rises, for drawing it
    testing.ts            Helpers shared by the simulation tests
  three/
    Board.tsx             The 3D scene and build preview
    targeting.ts          What the pointer is over, and where a piece would go
    SimulationContext.ts  The running simulation, for moving parts to follow
    CameraRig.tsx         Fixed isometric camera with zoom and pan
    PieceMesh.tsx         Any piece: its own model, or a block carved with its grooves
    Marbles.tsx           Glass marbles that spin as they roll
    pieceGeometry.ts      Piece models, with rounded grooves carved into the top
    TubeMeshes.tsx        Glass tubes, outlets and funnels
    FanMesh.tsx           The fan set into its crossroads
    DispenserMesh.tsx     The dispenser's hopper of marbles
    FlipFlopMesh.tsx      The flip-flop's flipper, swinging to follow the switch
    PortalMesh.tsx        A portal's glowing ring, in its pair's colour
    VortexMesh.tsx        The vortex's cone, frame and spout
    SeesawMesh.tsx        The cup seesaw, tipping with the simulation
    AirParticles.tsx      Air rising from fans and through the tubes they blow
    materials.ts          Stained wood and marble materials
    textures.ts           Procedural wood grain and marble swirl
public/audio/             Sound effects
```

### Adding a piece

1. **`src/lib/pieces.ts`**: add the kind and its definition: label, hotkey,
   openings, where it sends marbles, the grooves carved into it, and any
   traits (flat top, part of a tube column, open space, more than one tile
   long).
2. **`src/lib/simulation/behaviours.ts`**: only if it does something special
   when a marble lands on it or rolls into it.
3. **`src/three/PieceMesh.tsx`** and **`src/components/PieceIcon.tsx`**: only
   if it needs its own model or icon. Otherwise it's drawn as a wooden block
   with its grooves carved in.

## Deployment

Every push to `main` runs the checks in `.github/workflows/ci.yml` and publishes the static build to GitHub Pages. Pull requests run the same checks without deploying.
