import type { JSX, ReactNode } from "react";
import { type Centreline, type Point, rotatePoint } from "@/lib/centrelines";
import {
  grooveCentrelines,
  isUpsideDown,
  type PieceKind,
  piecePorts,
} from "@/lib/pieces";

const SIZE = 40;
const SCALE = 27;

const WOOD = { fill: "#e2bc8a", stroke: "#8b5e34" };
const GROOVE = "#a2774c";
const GLASS = { fill: "#dff1fb", fillOpacity: 0.35, stroke: "#9fc6dc" };
const COLLAR = "#c99c66";
const MARBLE = "#4f9fd1";

interface IconProps {
  kind: PieceKind;
  rotation: number;
}

/** Pieces drawn their own way, rather than as their carved top face */
const ICONS: Partial<Record<PieceKind, (props: IconProps) => JSX.Element>> = {
  tube: TubeIcon,
  outlet: TubeIcon,
  funnel: FunnelIcon,
  seesaw: SeesawIcon,
  vortex: VortexIcon,
};

/** Extra details drawn over a piece's top face */
const DETAILS: Partial<
  Record<PieceKind, (props: { rotation: number }) => JSX.Element>
> = {
  fan: FanDetails,
  dispenser: DispenserDetails,
  flipflop: FlipFlopDetails,
  portal: PortalDetails,
};

/**
 * A piece's icon: the top face as it looks on the board, grooves included,
 * or its own drawing for pieces that aren't just a carved block
 */
export function PieceIcon({ kind, rotation }: IconProps) {
  const Special = ICONS[kind];
  if (Special) return <Special kind={kind} rotation={rotation} />;
  const Details = DETAILS[kind];

  const face = [
    project(-0.5, -0.5),
    project(0.5, -0.5),
    project(0.5, 0.5),
    project(-0.5, 0.5),
  ];
  const lines = grooveCentrelines(kind, rotation);

  return (
    <Icon>
      <polygon points={face.join(" ")} {...WOOD} strokeWidth="1" />
      {lines.map((line, i) => (
        // Centrelines never change order, so their index is a stable key
        // biome-ignore lint/suspicious/noArrayIndexKey: see above
        <GrooveLine key={i} line={line} />
      ))}
      {Details && <Details rotation={rotation} />}
    </Icon>
  );
}

/** An icon's frame; `flip` turns the drawing upside down */
function Icon({ children, flip }: { children: ReactNode; flip?: boolean }) {
  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      aria-hidden="true"
    >
      <g transform={flip ? `matrix(1 0 0 -1 0 ${SIZE})` : undefined}>
        {children}
      </g>
    </svg>
  );
}

/** One groove, bowl or well on a top face */
function GrooveLine({ line }: { line: Centreline }) {
  switch (line.type) {
    case "segment":
      return <Groove points={[line.from, line.to]} />;
    case "arc":
      return <Groove points={arcPoints(line.corner)} />;
    case "bowl":
      return <polygon points={circle(line.radius)} fill={GROOVE} />;
    case "well":
      return <polygon points={circle(line.radius)} fill="#2a1d14" />;
  }
}

function Groove({ points }: { points: Point[] }) {
  return (
    <polyline
      points={points.map((p) => project(p.x, p.y)).join(" ")}
      fill="none"
      stroke={GROOVE}
      strokeWidth="6"
    />
  );
}

/** The dispenser's hopper of marbles, seen from above */
function DispenserDetails({ rotation }: { rotation: number }) {
  const centre = rotatePoint({ x: -0.12, y: 0 }, rotation);
  const [cx, cy] = project(centre.x, centre.y).split(",").map(Number);
  return (
    <>
      <polygon points={circle(0.3, centre)} {...GLASS} />
      <circle cx={cx - 3} cy={cy + 1} r="2.6" fill="#e0533d" />
      <circle cx={cx + 1} cy={cy - 2} r="2.6" fill={MARBLE} />
      <circle cx={cx + 0.5} cy={cy + 3} r="2.6" fill="#f2c94c" />
    </>
  );
}

/** The portal's ring, standing across the track */
function PortalDetails({ rotation }: { rotation: number }) {
  const a = rotatePoint({ x: 0, y: -0.34 }, rotation);
  const b = rotatePoint({ x: 0, y: 0.34 }, rotation);
  return (
    <polyline
      points={[project(a.x, a.y), project(b.x, b.y)].join(" ")}
      stroke="#c084fc"
      strokeWidth="4"
      strokeLinecap="round"
    />
  );
}

/**
 * The flip-flop's T: its leg leaning up the stem to steer marbles into one
 * branch, its top bar's arms reaching into both
 */
function FlipFlopDetails({ rotation }: { rotation: number }) {
  const tilt = 0.4;
  const leg = rotatePoint(
    { x: 0.3 * Math.cos(tilt), y: 0.3 * Math.sin(tilt) },
    rotation,
  );
  const armA = rotatePoint(
    { x: -0.28 * Math.sin(tilt), y: 0.28 * Math.cos(tilt) },
    rotation,
  );
  const armB = { x: -armA.x, y: -armA.y };
  const stroke = {
    stroke: "#6b4423",
    strokeWidth: 3,
    strokeLinecap: "round",
  } as const;
  return (
    <>
      <polyline
        points={[project(0, 0), project(leg.x, leg.y)].join(" ")}
        {...stroke}
      />
      <polyline
        points={[project(armA.x, armA.y), project(armB.x, armB.y)].join(" ")}
        {...stroke}
      />
    </>
  );
}

/** The fan's guard and blades, in the well of its crossroads */
function FanDetails() {
  return (
    <>
      <polygon points={circle(0.27)} fill="none" stroke="#c9a25e" />
      <polyline
        points={[project(-0.22, 0), project(0.22, 0)].join(" ")}
        stroke="#d8d2c8"
        strokeWidth="2"
      />
      <polyline
        points={[project(0, -0.22), project(0, 0.22)].join(" ")}
        stroke="#d8d2c8"
        strokeWidth="2"
      />
    </>
  );
}

/**
 * A glass tube side-on, with a spout on the side for an outlet: at the
 * bottom when it's upside down
 */
function TubeIcon({ kind, rotation }: IconProps) {
  // Which way the spout points on screen: right for +x and -y
  const spout = piecePorts(kind, rotation)[0];
  const right = spout === "+x" || spout === "-y";
  const flip = isUpsideDown({ kind, rotation });
  return (
    <Icon flip={flip}>
      <rect x="13" y="4" width="14" height="32" rx="3" {...GLASS} />
      <rect x="11" y="33" width="18" height="3" rx="1" fill={COLLAR} />
      {spout ? (
        <rect
          x={right ? 26 : 2}
          y="5"
          width="12"
          height="9"
          rx="2"
          {...GLASS}
        />
      ) : (
        <rect x="11" y="4" width="18" height="3" rx="1" fill={COLLAR} />
      )}
      <circle cx="20" cy="22" r="4" fill={MARBLE} />
    </Icon>
  );
}

/** A funnel side-on; upside down, it's flipped and marbles go up it */
function FunnelIcon({ rotation }: IconProps) {
  return (
    <Icon flip={isUpsideDown({ kind: "funnel", rotation })}>
      <path d="M5 5 L35 5 L27 18 L13 18 Z" {...GLASS} />
      <rect x="13" y="17" width="14" height="19" rx="2" {...GLASS} />
      <rect x="4" y="3" width="32" height="3" rx="1" fill={COLLAR} />
      <rect x="11" y="33" width="18" height="3" rx="1" fill={COLLAR} />
      <circle cx="13" cy="9" r="4" fill={MARBLE} />
      <path
        d="M20 22 L20 29 M17 26 L20 29 L23 26"
        stroke="#7dd3fc"
        strokeWidth="1.5"
        fill="none"
      />
    </Icon>
  );
}

/** The vortex from above: a wide cone with a spiral down to its hole */
function VortexIcon() {
  const spiral = Array.from({ length: 49 }, (_, i) => {
    const t = i / 48;
    const r = 0.46 - 0.38 * t;
    const angle = t * Math.PI * 5;
    return project(r * Math.cos(angle), r * Math.sin(angle));
  }).join(" ");
  return (
    <Icon>
      <polygon points={circle(0.5)} {...WOOD} strokeWidth="1.5" />
      <polygon points={circle(0.33)} fill="#d4a774" />
      <polyline
        points={spiral}
        fill="none"
        stroke="#8b5e34"
        strokeWidth="1.2"
      />
      <polygon points={circle(0.08)} fill="#2a1d14" />
      <circle cx="13" cy="19" r="2.6" fill={MARBLE} />
    </Icon>
  );
}

/** The cup seesaw side-on, tipped with a marble waiting in the low cup */
function SeesawIcon() {
  return (
    <Icon>
      <rect x="9" y="27" width="22" height="9" rx="1" {...WOOD} />
      <rect x="18" y="20" width="4" height="8" fill="#d9a86c" />
      <path
        d="M5 26 L35 15"
        stroke="#b9834d"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path d="M3 25 L5 19 L11 19 L12 23" fill="#b9834d" />
      <path d="M28 18 L29 11 L35 10 L36 15" fill="#b9834d" />
      <circle cx="8" cy="18" r="3" fill={MARBLE} />
    </Icon>
  );
}

/** Isometric projection of a point on a piece's top face */
function project(x: number, y: number): string {
  const right = ((x - y) / Math.SQRT2) * SCALE;
  const down = ((x + y) / Math.sqrt(6)) * SCALE;
  return `${(SIZE / 2 + right).toFixed(2)},${(SIZE / 2 + down).toFixed(2)}`;
}

/** An isometric circle of radius r on the top face */
function circle(r: number, centre: Point = { x: 0, y: 0 }): string {
  return Array.from({ length: 24 }, (_, i) => {
    const angle = (i / 24) * Math.PI * 2;
    return project(
      centre.x + r * Math.cos(angle),
      centre.y + r * Math.sin(angle),
    );
  }).join(" ");
}

/** Points along a quarter circle of radius 0.5 round a corner of the face */
function arcPoints(corner: Point): Point[] {
  const sx = Math.sign(corner.x);
  const sy = Math.sign(corner.y);
  // From the end on the corner's x edge round to the end on its y edge
  const start = Math.atan2(-sy, 0);
  const end = Math.atan2(0, -sx);
  let sweep = end - start;
  if (sweep > Math.PI) sweep -= 2 * Math.PI;
  if (sweep < -Math.PI) sweep += 2 * Math.PI;
  return Array.from({ length: 9 }, (_, i) => {
    const angle = start + (sweep * i) / 8;
    return {
      x: corner.x + 0.5 * Math.cos(angle),
      y: corner.y + 0.5 * Math.sin(angle),
    };
  });
}
