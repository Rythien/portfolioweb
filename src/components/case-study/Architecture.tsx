import React from "react";

/*
 * One small architecture diagram per case study, as inline SVG in the
 * site's own terms: ink strokes on paper, mono uppercase labels, a dashed
 * outline for anything that exists but is not wired in. Drawn at 640 wide
 * so labels stay at 14px where the column is that wide; narrower screens
 * scroll it sideways rather than shrinking the type.
 */

const W = 640;

function Box({
  x,
  y,
  w,
  h = 56,
  title,
  note,
  dashed = false,
}: {
  x: number;
  y: number;
  w: number;
  h?: number;
  title: string;
  note?: string;
  dashed?: boolean;
}) {
  return (
    <g>
      <rect
        x={x + 0.5}
        y={y + 0.5}
        width={w}
        height={h}
        fill="none"
        stroke="currentColor"
        strokeOpacity={dashed ? 0.45 : 0.7}
        strokeDasharray={dashed ? "4 4" : undefined}
      />
      <text x={x + 12} y={y + (note || h > 56 ? 23 : h / 2 + 5)} className="fill-current" fontSize={14} fontWeight={500} letterSpacing="0.06em">
        {title.toUpperCase()}
      </text>
      {note && (
        <text x={x + 12} y={y + 43} className="fill-current" fillOpacity={0.7} fontSize={14}>
          {note}
        </text>
      )}
    </g>
  );
}

/** A straight connector with an open arrowhead at (x2, y2). */
function Arrow({ x1, y1, x2, y2, dashed = false }: { x1: number; y1: number; x2: number; y2: number; dashed?: boolean }) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const head = (s: number) => `${x2 - 8 * Math.cos(a + s)},${y2 - 8 * Math.sin(a + s)}`;
  return (
    <g stroke="currentColor" strokeOpacity={dashed ? 0.45 : 0.7} fill="none">
      <line x1={x1} y1={y1} x2={x2} y2={y2} strokeDasharray={dashed ? "4 4" : undefined} />
      <polyline points={`${head(0.45)} ${x2},${y2} ${head(-0.45)}`} />
    </g>
  );
}

function Label({ x, y, children, anchor = "start" }: { x: number; y: number; children: string; anchor?: "start" | "middle" | "end" }) {
  return (
    <text x={x} y={y} textAnchor={anchor} className="fill-current" fillOpacity={0.7} fontSize={14}>
      {children}
    </text>
  );
}

function Frame({ h, title, desc, children }: { h: number; title: string; desc: string; children: React.ReactNode }) {
  const id = title.replace(/\W+/g, "-").toLowerCase();
  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <svg
        viewBox={`0 0 ${W} ${h}`}
        width={W}
        className="min-w-[560px] w-full h-auto text-ink font-mono"
        role="img"
        aria-labelledby={`${id}-t ${id}-d`}
      >
        <title id={`${id}-t`}>{title}</title>
        <desc id={`${id}-d`}>{desc}</desc>
        {children}
      </svg>
    </div>
  );
}

function Nova() {
  return (
    <Frame
      h={330}
      title="Nova Delivers architecture"
      desc="Customers use the storefront server on port 3000 and staff use the operations portal server on port 3001. A supervisor script, start.js, starts both. Both servers read and write one SQLite database file through Node's built-in node:sqlite."
    >
      <Box x={20} y={10} w={270} title="Customer browser" note="menu, cart, OTP checkout" />
      <Box x={350} y={10} w={270} title="Staff browser" note="order board" />
      <Arrow x1={155} y1={67} x2={155} y2={119} />
      <Arrow x1={485} y1={67} x2={485} y2={119} />
      <rect x={10.5} y={108.5} width={620} height={100} fill="none" stroke="currentColor" strokeOpacity={0.35} strokeDasharray="2 4" />
      <Box x={20} y={120} w={270} title="server.js  :3000" note="storefront + API" />
      <Box x={350} y={120} w={270} title="admin-server.js  :3001" note="portal + API" />
      <Label x={320} y={200} anchor="middle">start.js starts both</Label>
      <Arrow x1={155} y1={209} x2={255} y2={261} />
      <Arrow x1={485} y1={209} x2={385} y2={261} />
      <Box x={170} y={262} w={300} title="nova.db" note="one SQLite file, node:sqlite" />
    </Frame>
  );
}

function Alveronium() {
  return (
    <Frame
      h={300}
      title="Alveronium Studio architecture"
      desc="Page scroll gives a progress value. The rail turns it into a target position between six stations. Each frame the one camera eases toward that target, and it renders one shared WebGL stage. Separately, 3D objects are placed on HTML layout boxes, which relies on the camera never tilting."
    >
      <Box x={10} y={20} w={140} title="Page scroll" note="progress 0-1" />
      <Arrow x1={151} y1={48} x2={179} y2={48} />
      <Box x={180} y={20} w={140} title="Rail" note="target only" />
      <Arrow x1={321} y1={48} x2={349} y2={48} />
      <Box x={350} y={20} w={130} title="Camera" note="damped" />
      <Arrow x1={481} y1={48} x2={509} y2={48} />
      <Box x={510} y={20} w={120} h={160} title="One stage" />
      <Label x={522} y={88}>6 stations</Label>
      <Label x={522} y={112}>hero</Label>
      <Label x={522} y={136}>...</Label>
      <Label x={522} y={160}>contact</Label>
      <Box x={10} y={200} w={200} title="HTML layout" note="section boxes" />
      <Arrow x1={211} y1={228} x2={259} y2={228} />
      <Box x={260} y={200} w={220} title="DOM-tracked 3D" note="objects sit on boxes" />
      <Arrow x1={481} y1={228} x2={569} y2={181} />
      <Arrow x1={415} y1={199} x2={415} y2={77} dashed />
      <Label x={403} y={140} anchor="end">needs a camera</Label>
      <Label x={403} y={160} anchor="end">that never tilts</Label>
    </Frame>
  );
}

function CareOps() {
  return (
    <Frame
      h={340}
      title="Care Ops architecture"
      desc="Support worker screens and admin and coordinator screens sit behind role-checked routes. The roster screens use a roster engine that validates and costs each shift. Every screen talks to one typed API client. Behind it is a mock backend stored in IndexedDB and seeded on first run. A Supabase schema with row-level security exists alongside but is not connected yet."
    >
      <Box x={10} y={10} w={250} title="Support worker" note="shifts, clock-in, notes" />
      <Box x={380} y={10} w={250} title="Admin, coordinator" note="roster, people, reports" />
      <Label x={320} y={44} anchor="middle">role-checked</Label>
      <Label x={320} y={62} anchor="middle">routes</Label>
      <Box x={380} y={110} w={250} title="Roster engine" note="validate + cost" />
      <Arrow x1={505} y1={67} x2={505} y2={109} />
      <Arrow x1={135} y1={67} x2={240} y2={181} />
      <Arrow x1={440} y1={167} x2={400} y2={181} />
      <Arrow x1={385} y1={67} x2={345} y2={181} />
      <Box x={170} y={182} w={300} title="Typed API client" note="the only door to data" />
      <Arrow x1={260} y1={239} x2={170} y2={271} />
      <Arrow x1={380} y1={239} x2={470} y2={271} dashed />
      <Box x={10} y={272} w={280} title="Mock backend" note="IndexedDB, seeded" />
      <Box x={350} y={272} w={280} title="Supabase" note="schema + RLS, not wired" dashed />
    </Frame>
  );
}

const DIAGRAMS: Record<string, () => React.ReactElement> = {
  "nova-delivers": Nova,
  alveronium: Alveronium,
  "care-ops": CareOps,
};

export function hasArchitecture(slug: string) {
  return slug in DIAGRAMS;
}

export default function Architecture({ slug }: { slug: string }) {
  const Diagram = DIAGRAMS[slug];
  return Diagram ? <Diagram /> : null;
}
