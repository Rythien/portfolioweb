import ProjectVideo from "@/components/ui/ProjectVideo";
import type { PhoneClip } from "@/content/projects";

/*
 * Portrait recordings of a phone-first app, each in a plain device frame
 * on a flat backdrop. They are never letterboxed into a 16:10 box: the
 * frame takes the clip's own 390:844 shape.
 */
export default function PhoneClips({ clips }: { clips: PhoneClip[] }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="bg-ink/[0.04] border border-rule rounded-sm px-6 py-10 sm:py-12 grid grid-cols-1 sm:grid-cols-2 gap-10 sm:gap-8 justify-items-center">
        {clips.map((clip, i) => (
          <figure key={clip.src} className="flex flex-col items-center gap-4 w-full max-w-[15rem]">
            {/* The device: a dark bezel with rounded corners, nothing else */}
            <div className="w-full rounded-[2.25rem] bg-[#15171c] p-[0.55rem] shadow-[0_1px_0_rgba(255,255,255,0.08)_inset]">
              <div className="overflow-hidden rounded-[1.75rem]">
                <ProjectVideo
                  variant="loop"
                  src={clip.src}
                  label={clip.label}
                  sizes="15rem"
                  aspect="aspect-[390/844]"
                />
              </div>
            </div>
            <figcaption className="text-center font-[family-name:var(--font-sans)] text-small text-ink/80 leading-relaxed [text-wrap:pretty]">
              <span className="font-mono text-label text-ink tabular-nums mr-2">
                Phone {String.fromCharCode(97 + i)}.
              </span>
              {clip.caption}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
