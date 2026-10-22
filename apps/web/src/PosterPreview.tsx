import { hasCustomTextOverlay, previewImageUrl } from "./posters";

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

function previewLabel(name: string, size: string, frame: string, customText: string | undefined): string {
  const frameName = frame === "none" ? "no frame" : frame;
  const text = (customText ?? "").trim();
  const base = `${name}, ${size}, ${frameName}`;
  return text.length > 0 ? `${base}, custom text ${text}` : base;
}

export function PosterPreview({ sku, name, size, frame, fill = false, customText }: PosterPreviewProps) {
  const frameClass = FRAME_CLASS[frame] ?? "frame-none";
  const sizeClass = SIZE_CLASS[size] ?? "size-A3";
  const overlay = hasCustomTextOverlay(sku, customText);
  const shownText = (customText ?? "").trim();
  const overlayClass = sku === "PM-NAMESTARS" ? "poster-custom poster-custom-name" : "poster-custom poster-custom-caption";

  return (
    <div className="poster-stage">
      <div className={`poster ${sizeClass} ${frameClass}${fill ? " fill" : ""}`}>
        <img className="poster-art" src={previewImageUrl(sku, customText)} alt={previewLabel(name, size, frame, customText)} />
        {overlay ? <p className={overlayClass}>{shownText}</p> : null}
      </div>
    </div>
  );
}
