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
