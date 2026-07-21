"use client";

// What the tools surface: a generated image, an embedded player, a link
// card. One panel, top-right, dismissible — the entity stays the center.

import { useLeviathan } from "@/lib/store";

// Deliberately tiny markdown rendering — headings, bullets, paragraphs.
// Reports are prose; anything fancier can wait for a real renderer.
function ReportBody({ markdown }: { markdown: string }) {
  const blocks = markdown.split(/\n{2,}/);
  return (
    <div className="space-y-3">
      {blocks.map((block, i) => {
        const heading = block.match(/^#{1,4}\s+(.*)/);
        if (heading) {
          return (
            <p
              key={i}
              className="pt-1 font-data text-[10px] uppercase tracking-[0.3em] text-lumen/60"
            >
              {heading[1].replace(/#+\s*/g, "")}
            </p>
          );
        }
        if (/^\s*[-*]\s+/m.test(block)) {
          return (
            <ul key={i} className="space-y-1 pl-4">
              {block
                .split("\n")
                .filter((l) => l.trim())
                .map((line, j) => (
                  <li
                    key={j}
                    className="list-disc font-data text-[12px] leading-5 text-foam/70 marker:text-lumen/40"
                  >
                    {line.replace(/^\s*[-*]\s+/, "").replace(/\*\*/g, "")}
                  </li>
                ))}
            </ul>
          );
        }
        return (
          <p key={i} className="font-data text-[12px] leading-5 text-foam/70">
            {block.replace(/\*\*/g, "").replace(/^#+\s*/g, "")}
          </p>
        );
      })}
    </div>
  );
}

export default function MediaLayer({
  onDismiss,
  getLiveStream,
}: {
  onDismiss?: (kind: string) => void;
  getLiveStream?: () => MediaStream | null;
}) {
  const media = useLeviathan((s) => s.media);
  const setMedia = useLeviathan((s) => s.setMedia);

  if (!media) return null;

  const dismiss = () => {
    onDismiss?.(media.kind);
    setMedia(null);
  };

  const wide = media.kind === "report" || media.kind === "live";

  return (
    <div
      className={`glass-panel panel-enter absolute left-1/2 top-1/2 z-40 -translate-x-1/2 -translate-y-1/2 overflow-hidden ${
        wide ? "w-[30rem] max-w-[92vw]" : "w-80 max-w-[85vw]"
      }`}
    >
      <div className="flex items-center justify-between px-3 py-2">
        <p className="truncate font-data text-[10px] uppercase tracking-[0.25em] text-foam/40">
          {media.kind === "image" && "condensed image"}
          {media.kind === "music" && "now playing"}
          {media.kind === "link" && "surfaced link"}
          {media.kind === "report" && "surfaced report"}
          {media.kind === "invite" && "device link — send this"}
          {media.kind === "live" && "linked device — live"}
        </p>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="font-data text-[11px] text-foam/40 transition-colors hover:text-lumen focus-visible:text-lumen"
        >
          ✕
        </button>
      </div>

      {media.kind === "image" && (
        <a href={media.url} target="_blank" rel="noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={media.url}
            alt={media.title}
            className="block w-full"
            loading="eager"
          />
          <p className="px-3 py-2 font-voice text-sm italic leading-snug text-foam/70">
            {media.title}
          </p>
        </a>
      )}

      {media.kind === "music" && (
        <div>
          <iframe
            className="aspect-video w-full"
            src={`https://www.youtube.com/embed/${media.videoId}?autoplay=1`}
            title={media.title}
            allow="autoplay; encrypted-media"
            allowFullScreen
          />
          <a
            href={media.url}
            target="_blank"
            rel="noreferrer"
            className="block px-3 py-2 font-data text-[11px] text-foam/50 transition-colors hover:text-lumen"
          >
            {media.title}
          </a>
        </div>
      )}

      {media.kind === "report" && (
        <div className="max-h-[65vh] overflow-y-auto px-4 pb-4">
          <p className="mb-2 font-voice text-lg italic leading-snug text-foam">
            {media.title}
          </p>
          <ReportBody markdown={media.markdown} />
        </div>
      )}

      {media.kind === "invite" && (
        <div className="px-3 pb-3">
          <p className="mb-2 font-voice text-sm italic leading-snug text-foam/70">
            Open on the device you want to link · it asks for their{" "}
            {media.purpose} · stays valid this session · they can stop anytime
          </p>
          <p className="break-all font-data text-[11px] text-lumen/70">
            {media.url}
          </p>
          <button
            onClick={() => navigator.clipboard?.writeText(media.url)}
            className="mt-2 border border-lumen/30 px-3 py-1 font-data text-[11px] tracking-wider text-lumen transition-colors hover:bg-lumen/10"
          >
            copy link
          </button>
        </div>
      )}

      {media.kind === "live" && (
        <video
          autoPlay
          playsInline
          className="block w-full bg-black/60"
          ref={(el) => {
            const s = getLiveStream?.();
            if (el && s && el.srcObject !== s) el.srcObject = s;
          }}
        />
      )}

      {media.kind === "link" && (
        <a
          href={media.url}
          target="_blank"
          rel="noreferrer"
          className="block px-3 pb-3"
        >
          {media.reason && (
            <p className="mb-1 font-voice text-sm italic text-foam/70">
              {media.reason}
            </p>
          )}
          <p className="break-all font-data text-[11px] text-lumen/70 underline decoration-lumen/30 underline-offset-4 transition-colors hover:text-lumen">
            {media.url}
          </p>
        </a>
      )}
    </div>
  );
}
