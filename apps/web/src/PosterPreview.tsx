import type { ReactNode } from "react";

type PosterPreviewProps = {
  sku: string;
  name: string;
  size: string;
  frame: string;
  /** Fill the card. Product pages omit this so size can scale the sheet. */
  fill?: boolean;
  customText?: string;
};

const FRAME_CLASS: Record<string, string> = {
  none: "frame-none",
  "black-oak": "frame-black-oak",
  "white-ash": "frame-white-ash",
};

const SIZE_CLASS: Record<string, string> = {
  A3: "size-A3",
  A2: "size-A2",
  A1: "size-A1",
};

function Sheet({ sky, children }: { sky: string; children: ReactNode }) {
  return (
    <svg viewBox="0 0 210 297" aria-hidden="true">
      <rect width="210" height="297" fill={sky} />
      {children}
    </svg>
  );
}

function Stars({ points }: { points: readonly (readonly [number, number, number])[] }) {
  return (
    <>
      {points.map(([cx, cy, radius]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={radius} fill="#f6f1e7" />
      ))}
    </>
  );
}

function PosterArt({ sku }: { sku: string }) {
  switch (sku) {
    case "PM-PERSEID":
      return (
        <Sheet sky="#1b2740">
          <Stars
            points={[
              [28, 36, 1.2],
              [70, 24, 1.6],
              [120, 48, 1],
              [168, 30, 1.4],
              [46, 90, 1.1],
              [150, 100, 1.3],
              [96, 140, 1.5],
              [180, 160, 1],
            ]}
          />
          <line x1="40" y1="70" x2="96" y2="108" stroke="#f3efe6" strokeWidth="1.4" />
          <line x1="130" y1="60" x2="168" y2="84" stroke="#f3efe6" strokeWidth="1.1" />
          <line x1="70" y1="150" x2="118" y2="176" stroke="#d7deee" strokeWidth="1" />
        </Sheet>
      );
    case "PM-LEONID":
      return (
        <Sheet sky="#2a211c">
          <Stars
            points={[
              [24, 40, 1],
              [60, 28, 1.2],
              [100, 50, 1],
              [150, 36, 1.3],
              [186, 70, 1],
              [40, 110, 1.1],
              [120, 130, 1.2],
            ]}
          />
          <line x1="20" y1="48" x2="70" y2="78" stroke="#f4efe6" strokeWidth="1.2" />
          <line x1="80" y1="36" x2="130" y2="64" stroke="#f4efe6" strokeWidth="1" />
          <line x1="140" y1="58" x2="190" y2="86" stroke="#f4efe6" strokeWidth="1.1" />
          <line x1="36" y1="120" x2="88" y2="148" stroke="#e7d7c4" strokeWidth="1" />
          <line x1="110" y1="150" x2="160" y2="176" stroke="#e7d7c4" strokeWidth="1" />
          <line x1="54" y1="190" x2="100" y2="214" stroke="#f4efe6" strokeWidth="0.9" />
        </Sheet>
      );
    case "PM-HALLEY":
      return (
        <Sheet sky="#1a2e2a">
          <Stars
            points={[
              [30, 40, 1],
              [78, 26, 1.2],
              [160, 48, 1],
              [48, 150, 1.1],
              [170, 180, 1.2],
              [100, 230, 1],
            ]}
          />
          <path d="M36 210 C80 170 120 120 168 78" fill="none" stroke="#d5ebe4" strokeWidth="10" strokeLinecap="round" opacity="0.35" />
          <path d="M48 206 C90 168 124 122 164 84" fill="none" stroke="#f4f7f4" strokeWidth="2" strokeLinecap="round" />
          <circle cx="168" cy="78" r="7" fill="#f7f4ee" />
        </Sheet>
      );
    case "PM-STARMAP":
      return (
        <Sheet sky="#172033">
          <circle cx="105" cy="132" r="78" fill="none" stroke="#d5dced" strokeWidth="0.8" />
          <circle cx="105" cy="132" r="52" fill="none" stroke="#d5dced" strokeWidth="0.6" />
          <circle cx="105" cy="132" r="26" fill="none" stroke="#d5dced" strokeWidth="0.6" />
          <line x1="105" y1="46" x2="105" y2="218" stroke="#d5dced" strokeWidth="0.5" />
          <line x1="24" y1="132" x2="186" y2="132" stroke="#d5dced" strokeWidth="0.5" />
          <Stars
            points={[
              [105, 80, 1.8],
              [70, 118, 1.4],
              [138, 108, 1.5],
              [90, 156, 1.2],
              [146, 160, 1.6],
              [118, 132, 1.1],
            ]}
          />
        </Sheet>
      );
    case "PM-NAMESTARS":
      return (
        <Sheet sky="#241c30">
          <polyline
            points="48,78 86,110 124,74 168,118 132,168 78,150"
            fill="none"
            stroke="#e4d7f0"
            strokeWidth="1"
          />
          <Stars
            points={[
              [48, 78, 2.2],
              [86, 110, 1.8],
              [124, 74, 2],
              [168, 118, 1.7],
              [132, 168, 2.1],
              [78, 150, 1.6],
              [30, 40, 1],
              [180, 48, 1],
              [40, 210, 1],
            ]}
          />
        </Sheet>
      );
    case "PM-NEBULA-LE":
      return (
        <Sheet sky="#241428">
          <ellipse cx="92" cy="130" rx="58" ry="36" fill="#c45b78" opacity="0.55" />
          <ellipse cx="128" cy="150" rx="46" ry="28" fill="#6d7fd6" opacity="0.5" />
          <ellipse cx="108" cy="126" rx="22" ry="14" fill="#f3e4ea" opacity="0.8" />
          <Stars
            points={[
              [36, 40, 1.1],
              [170, 36, 1.2],
              [48, 220, 1],
              [176, 200, 1.3],
              [20, 120, 1],
            ]}
          />
        </Sheet>
      );
    default:
      return (
        <Sheet sky="#f7f1e8">
          <rect x="28" y="36" width="154" height="200" fill="none" stroke="#c9bfb2" strokeWidth="1" />
        </Sheet>
      );
  }
}

function previewLabel(name: string, size: string, frame: string, customText: string | undefined): string {
  const frameName = frame === "none" ? "no frame" : frame;
  const text = customText ?? "";
  const base = `${name}, ${size}, ${frameName}`;
  return text.length > 0 ? `${base}, custom text ${text}` : base;
}

export function PosterPreview({ sku, name, size, frame, fill = false, customText }: PosterPreviewProps) {
  const frameClass = FRAME_CLASS[frame] ?? "frame-none";
  const sizeClass = SIZE_CLASS[size] ?? "size-A3";
  const ink =
    sku === "PM-PERSEID" ||
    sku === "PM-LEONID" ||
    sku === "PM-HALLEY" ||
    sku === "PM-STARMAP" ||
    sku === "PM-NAMESTARS" ||
    sku === "PM-NEBULA-LE"
      ? "ink-light"
      : "ink-dark";
  const shownText = customText ?? "";

  return (
    <div className="poster-stage" role="img" aria-label={previewLabel(name, size, frame, customText)}>
      <div className={`poster ${sizeClass} ${frameClass} ${ink}${fill ? " fill" : ""}`}>
        <PosterArt sku={sku} />
        {shownText.length > 0 ? <p className="poster-custom">{shownText}</p> : null}
      </div>
    </div>
  );
}
