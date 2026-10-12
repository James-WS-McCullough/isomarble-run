import { DIRECTION_VECTORS } from "@/lib/directions";
import { routeBetween } from "@/lib/paths";
import { type PieceKind, piecePorts } from "@/lib/pieces";

const SIZE = 40;
const SCALE = 27;

/** Isometric projection of a point on a piece's top face */
function project(x: number, y: number): string {
  const right = ((x - y) / Math.SQRT2) * SCALE;
  const down = ((x + y) / Math.sqrt(6)) * SCALE;
  return `${(SIZE / 2 + right).toFixed(2)},${(SIZE / 2 + down).toFixed(2)}`;
}

/**
 * The top face of a piece as it looks on the board, groove included
 */
export function PieceIcon({
  kind,
  rotation,
}: {
  kind: PieceKind;
  rotation: number;
}) {
  const ports = piecePorts(kind, rotation);
  const grooves: { x: number; y: number }[][] =
    kind === "curve"
      ? [routeBetween(ports[0], ports[1]).points]
      : ports.map((port) => {
          const v = DIRECTION_VECTORS[port];
          return [
            { x: 0, y: 0 },
            { x: v.x / 2, y: v.y / 2 },
          ];
        });

  const face = [
    project(-0.5, -0.5),
    project(0.5, -0.5),
    project(0.5, 0.5),
    project(-0.5, 0.5),
  ];

  if (
    kind === "tube" ||
    kind === "outlet" ||
    kind === "funnel" ||
    kind === "fan"
  ) {
    return <SpecialIcon kind={kind} rotation={rotation} />;
  }
  if (kind === "seesaw") {
    return (
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        aria-hidden="true"
      >
        <rect
          x="9"
          y="27"
          width="22"
          height="9"
          rx="1"
          fill="#e2bc8a"
          stroke="#8b5e34"
        />
        <rect x="18" y="20" width="4" height="8" fill="#d9a86c" />
        <path
          d="M5 26 L35 15"
          stroke="#b9834d"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path d="M3 25 L5 19 L11 19 L12 23" fill="#b9834d" />
        <path d="M28 18 L29 11 L35 10 L36 15" fill="#b9834d" />
        <circle cx="8" cy="18" r="3" fill="#4f9fd1" />
      </svg>
    );
  }

  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      aria-hidden="true"
    >
      <polygon
        points={face.join(" ")}
        fill="#e2bc8a"
        stroke="#8b5e34"
        strokeWidth="1"
      />
      {kind === "catcher" && (
        <polygon
          points={Array.from({ length: 24 }, (_, i) => {
            const angle = (i / 24) * Math.PI * 2;
            return project(0.42 * Math.cos(angle), 0.42 * Math.sin(angle));
          }).join(" ")}
          fill="#a2774c"
        />
      )}
      {grooves.map((points) => (
        <polyline
          key={points.map((p) => `${p.x},${p.y}`).join(" ")}
          points={points.map((p) => project(p.x, p.y)).join(" ")}
          fill="none"
          stroke="#a2774c"
          strokeWidth="6"
        />
      ))}
    </svg>
  );
}

/** Side-on icons for tubes and fans */
function SpecialIcon({
  kind,
  rotation,
}: {
  kind: "tube" | "outlet" | "funnel" | "fan";
  rotation: number;
}) {
  // Which way the spout or intake points on screen: right for +x and -y
  const ports = piecePorts(kind, rotation);
  const right = ports[0] === "+x" || ports[0] === "-y";
  const glass = { fill: "#dff1fb", fillOpacity: 0.35, stroke: "#9fc6dc" };
  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      aria-hidden="true"
    >
      {kind === "fan" ? (
        <>
          <rect
            x="10"
            y="14"
            width="20"
            height="20"
            rx="2"
            fill="#e2bc8a"
            stroke="#8b5e34"
          />
          <ellipse cx="20" cy="14" rx="9" ry="3" fill="#2a1d14" />
          <path
            d="M14 13 L26 15 M14 15 L26 13"
            stroke="#c9c2b8"
            strokeWidth="1.5"
          />
          <path
            d="M20 10 L20 3 M17 6 L20 3 L23 6"
            stroke="#7dd3fc"
            strokeWidth="1.5"
            fill="none"
          />
          <circle cx={right ? 30 : 10} cy="17" r="3" fill="#2a1d14" />
        </>
      ) : kind === "funnel" ? (
        // Upside down, it's flipped and the marble goes up through it
        <g transform={rotation % 2 === 1 ? "matrix(1 0 0 -1 0 40)" : undefined}>
          <path d="M5 5 L35 5 L27 18 L13 18 Z" {...glass} />
          <rect x="13" y="17" width="14" height="19" rx="2" {...glass} />
          <rect x="4" y="3" width="32" height="3" rx="1" fill="#c99c66" />
          <rect x="11" y="33" width="18" height="3" rx="1" fill="#c99c66" />
          <circle cx="13" cy="9" r="4" fill="#4f9fd1" />
          <path
            d="M20 22 L20 29 M17 26 L20 29 L23 26"
            stroke="#7dd3fc"
            strokeWidth="1.5"
            fill="none"
          />
        </g>
      ) : (
        <>
          <rect x="13" y="4" width="14" height="32" rx="3" {...glass} />
          <rect x="11" y="33" width="18" height="3" rx="1" fill="#c99c66" />
          {kind === "tube" && (
            <rect x="11" y="4" width="18" height="3" rx="1" fill="#c99c66" />
          )}
          {kind === "outlet" && (
            <rect
              x={right ? 26 : 2}
              y="5"
              width="12"
              height="9"
              rx="2"
              {...glass}
            />
          )}
          <circle cx="20" cy="22" r="4" fill="#4f9fd1" />
        </>
      )}
    </svg>
  );
}
