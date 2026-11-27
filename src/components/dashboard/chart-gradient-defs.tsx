import {
  GRADIENT_HEX_COLORS,
  GRADIENT_KINDS,
  GRADIENT_TOKENS,
  gradientId,
  type GradientKind,
} from "@/lib/chart-gradient";

// How much white is mixed into the light end of each gradient.
const LIGHT_MIX = 40;

function Stops({ kind, color }: { kind: GradientKind; color: string }) {
  const light = `color-mix(in srgb, ${color}, white ${LIGHT_MIX}%)`;
  // The plain colour is also given as the attribute, so a browser that cannot
  // read color-mix() still draws the flat colour rather than black.
  const stop = (offset: string, value: string) => <stop offset={offset} stopColor={color} style={{ stopColor: value }} />;
  // dark -> light for h; light (top) -> colour (foot) for v; light -> colour for d
  return kind === "h" ? (
    <>
      {stop("0%", color)}
      {stop("100%", light)}
    </>
  ) : (
    <>
      {stop("0%", light)}
      {stop("100%", color)}
    </>
  );
}

function direction(kind: GradientKind) {
  if (kind === "h") return { x1: "0", y1: "0", x2: "1", y2: "0" };
  if (kind === "v") return { x1: "0", y1: "0", x2: "0", y2: "1" };
  return { x1: "0", y1: "0", x2: "1", y2: "1" };
}

// Rendered once per page. It must not be display:none (browsers then ignore the
// gradients), so it is just collapsed to nothing.
export function ChartGradientDefs() {
  const entries = [
    ...GRADIENT_TOKENS.map((name) => ({ name, color: `var(--${name})` })),
    ...GRADIENT_HEX_COLORS.map((hex) => ({ name: hex.slice(1), color: hex })),
  ];
  return (
    <svg aria-hidden="true" width="0" height="0" className="pointer-events-none absolute" focusable="false">
      <defs>
        {entries.flatMap(({ name, color }) =>
          GRADIENT_KINDS.map((kind) => (
            <linearGradient key={`${kind}-${name}`} id={gradientId(kind, name)} {...direction(kind)}>
              <Stops kind={kind} color={color} />
            </linearGradient>
          )),
        )}
      </defs>
    </svg>
  );
}
