/** A short excerpt from a private repository, shown in a case study. */
export interface Excerpt {
  /** Path within the project, shown above the code. */
  file: string;
  /** File in src/content/excerpts/, copied verbatim; "// …" marks a cut. */
  source: string;
  /** One sentence on why it is written this way. */
  why: string;
}

export interface ProjectImage {
  /** WAKE variant. */
  src: string;
  /** DREAM variant, crossfaded in by the --dream flood value. */
  dreamSrc?: string;
  alt: string;
  caption?: string;
}

/** A decision made on the project, and why. */
export interface CaseDecision {
  title: string;
  /** Paragraphs: what was chosen, the alternative, the reasoning. */
  body: string[];
}

/**
 * The written case study (600-900 words). Every field is the author's own
 * account; nothing here is filled in by guesswork. A project without one
 * falls back to its overview, features and challenges.
 */
export interface CaseStudy {
  /** Paragraphs. */
  problem: string[];
  /** Who did what: team, the author's part, timeline. */
  role: string[];
  approach: string[];
  /** Two or three. */
  decisions: CaseDecision[];
  /** What the author would do differently now, if they have said. */
  differently?: string[];
  /** Optional outcome: results, reception, where it is used. */
  outcome?: string[];
  /** Two or three short excerpts (src/content/excerpts), each approved by the author. */
  excerpts?: Excerpt[];
}

export interface Project {
  slug: string;
  counter: string;
  title: string;
  /** The one word of the title set in Newsreader italic lowercase. */
  titleAccent?: string;
  subtitle?: string;
  category: string;
  type?: string;
  year: string;
  roles: string[];
  description: string;
  dreamDescription?: string;
  summary?: string;
  overview?: string;
  mainFeatures?: string[];
  technicalChallenges?: string[];
  caseStudy?: CaseStudy;
  /** Shown on the panel and under the walkthrough when the recording shows
   * seeded figures that could be read as results. */
  dataNote?: string;
  placeholder?: boolean;
  link: string;
  /** Screen recordings: the panel loop and the captioned walkthrough. */
  video: {
    /** Path without extension (scripts/capture writes .webm, .mp4, -poster.webp). */
    preview: string;
    walkthrough: string;
    /** What each clip shows, for screen readers. */
    previewLabel: string;
    walkthroughLabel: string;
  };
  /** Generated concept art: index cards, the Archive, Open Graph. */
  cover: ProjectImage;
  /** Case-study gallery. */
  images: ProjectImage[];
  aspectRatio?: string;
  ogImage?: string;
  stack: {
    frontend: string[];
    backend?: string[];
    tools?: string[];
  };
  tags: string[];
}

/*
 * The three projects are private builds that are not hosted anywhere and
 * have no public repository. The cover is generated concept artwork
 * (npm run gen:covers -- --kinds cover) and is labelled as such; the
 * gallery is stills from screen recordings of each project running
 * locally (scripts/capture).
 */

/** Generated cover, WAKE and DREAM variants. */
function cover(slug: string, title: string, shows: string): ProjectImage {
  return {
    src: `/projects/${slug}/cover.webp`,
    dreamSrc: `/projects/${slug}/cover-dream.webp`,
    alt: `Concept artwork for ${title}: ${shows}`,
    caption: `Concept artwork: ${shows}.`,
  };
}

/** The recordings in public/projects/<slug>/ (scripts/capture). */
function video(slug: string, previewLabel: string, walkthroughLabel: string) {
  return {
    preview: `/projects/${slug}/preview`,
    walkthrough: `/projects/${slug}/walkthrough`,
    previewLabel,
    walkthroughLabel,
  };
}

/** A still from the screen recording: public/projects/<slug>/still-<name>.webp. */
function still(slug: string, name: string, caption: string): ProjectImage {
  return { src: `/projects/${slug}/still-${name}.webp`, alt: caption.replace(/\.$/, ""), caption };
}

/*
 * Case studies: written from what the author confirmed (why each was
 * built, who did what, how long it took) and from the projects' own code
 * and READMEs. Nothing is estimated or assumed. "What I'd do differently"
 * is left out until the author says it.
 */

const NOVA_CASE: CaseStudy = {
  problem: [
    "Nova Delivers already had a website, and it was slow and full of bugs. I rebuilt it from scratch as a self-initiated project, rather than patching the old one.",
    "The rebuild has two audiences with different jobs. Customers in Kathmandu need to find something among 164 dishes, build a cart and check out. The kitchen needs to see every order as it arrives and move it along until it reaches the door. So the project is two things: a storefront, and an operations portal that runs the day's orders.",
  ],
  role: [
    "Solo, over about a month in 2026: the design, the frontend, the backend and the database. The only code I did not write is the animation libraries.",
  ],
  approach: [
    "The whole system runs on Node.js and nothing else. Two small servers share one SQLite file through Node's built-in node:sqlite module: the customer site and its API on one port, the operations portal and its API on another, both started together by a short supervisor script. GSAP, ScrollTrigger, Flip and Lenis are vendored as plain files, and Lenis is driven only by GSAP's ticker, so scrolling and animation run on one clock.",
    "The storefront is hand-written HTML, CSS and JavaScript across seven pages. The menu holds 164 dishes in twelve categories, filtered and searched in place without a page load, and the cart follows the visitor from page to page. Checkout validates a ten-digit Nepali phone number and asks for a four-digit code. The code is stored in SQLite with a five-minute expiry and deleted once used. The OTP is simulated: there is no SMS gateway, so the code comes back in the response and the whole flow can be tried end to end. A delivery address can carry a GPS pin taken from the browser's location.",
    "The portal is a live board: order counts by status, revenue, and a card per order with the customer, the address, the dishes and the total. Staff accept an order, mark it cooking, out for delivery and delivered, or cancel it. Search covers the order number, the customer's name and phone, and the area, and any order can be printed as a kitchen ticket. A Simulate Order button drops a test order onto the board, so the portal can be exercised without going through checkout.",
    "Around the menu sit an about page for the central kitchen, a delivery-charges page that sets out the tiered coverage and pricing, and privacy and terms pages, all sharing one design system of tokens, glass surfaces and spring-based interactions.",
  ],
  decisions: [
    {
      title: "Nothing to install but Node",
      body: [
        "The servers are built on Node's standard library alone: node:http for routing, node:fs for static files, node:sqlite for data. The project starts with node start.js on Node 22 or later, with no npm install and no dependency tree behind it.",
        "The price is that routing and request parsing are written by hand. Across nine API endpoints, that is a small amount of code.",
      ],
    },
    {
      title: "Two servers, one database",
      body: [
        "The operations portal is not a page of the storefront. It is its own server on its own port with its own API, started alongside the customer site by the supervisor script.",
        "Both servers open the same SQLite file. An order placed on the storefront is on the board the next time it loads, with no queue, webhook or sync step between the two halves.",
      ],
    },
    {
      title: "The burger anatomy as 120 bitmaps",
      body: [
        "The scroll-driven burger is a sequence of 120 WebP frames drawn to a canvas rather than a video, so the scroll position maps straight to a frame in either direction.",
        "Loading is ordered for that. The first frame is fetched and drawn before anything else, so the canvas is never empty. The other 119 are decoded with createImageBitmap in batches of eight, off the main thread, while the page stays scrollable.",
      ],
    },
  ],
  excerpts: [
    {
      file: "js/exploded-view.js",
      source: "nova-delivers-1.txt",
      why: "The first frame is decoded and drawn before anything else, so the canvas is never empty. The other 119 frames are decoded off the main thread in batches of 8, which keeps scrolling smooth while they load.",
    },
    {
      file: "admin-server.js",
      source: "nova-delivers-2.txt",
      why: "Search text never goes into the SQL string itself. It's passed as a separate value, so whatever someone types in the search box can't change the query.",
    },
  ],
};

const ALVERONIUM_CASE: CaseStudy = {
  problem: [
    "Alveronium Studio is a start-up Saurav and I are trying to get off the ground, and this is its website.",
    "The idea is to draw the studio like a technical sheet: a title block, dimension lines, a data sheet, a specimen drawn to scale. And the 3D shouldn't start and stop at each section. It should carry on through the whole page.",
  ],
  role: [
    "Built with Saurav over two to three weeks in 2026. I did the design, the frontend and the planning, and some of the backend; Saurav worked mainly on the backend and on penetration testing.",
  ],
  approach: [
    "Next.js 16 with the App Router and React 19, TypeScript throughout, Tailwind 4 for layout. The 3D is React Three Fiber over three.js, with drei and postprocessing; Lenis smooths the scroll and Framer Motion handles interface motion.",
    "The page opens on a hero with a hexagonal 3D specimen, drawn with dimension lines and a data sheet beside it. The statement is set against a particle structure. In services, an instrument panel redraws for each discipline as its row scrolls past the middle of the screen. The process runs through five stages, each with its own line drawing. Contact closes on a dotted-land globe, drawn on a 2D canvas in orthographic projection and turned to the studio's city, with its local time beside it. The globe sways slowly in longitude, and holds still for visitors who ask for reduced motion.",
    "Phones get their own components rather than a squeezed desktop layout: a mobile hero and specimen, an accordion for the services, swipeable process cards, a navigation dock and a mobile contact globe. The preloader plays once per session.",
    "The interface chrome keeps the drawing conceit going: a numbered section index across the top, a sheet counter and a scroll readout in the corners, a reticle cursor and a fine grain over everything.",
  ],
  decisions: [
    {
      title: "One stage, one camera",
      body: [
        "Instead of a canvas per section, the whole page shares one WebGL stage. Each section owns a station in a single 3D world, and scrolling flies one camera between them along a rail.",
        "The stations are spaced deliberately wide: the travel between them is what gives the scroll something to do. Because it is one world, the 3D carries on from one section into the next instead of restarting. At the end the rail turns back toward the viewer, so the descent closes at contact instead of receding forever.",
      ],
    },
    {
      title: "Damped, not scrubbed",
      body: [
        "The camera is not pinned to the scroll value. The rail only works out where the camera should be; each frame, the camera eases toward that point with a frame-rate-independent damp, and the frame time is capped so returning to the tab doesn't make it jump.",
        "A fast, flung scroll arrives with some weight instead of teleporting, and the camera keeps moving for a beat after the page stops. In the hero, a dolly rides on top of the rail, so the specimen pulls away as you begin to scroll.",
      ],
    },
    {
      title: "A camera that never tilts",
      body: [
        "Some 3D objects are placed to sit exactly on HTML boxes, and that placement assumes a camera looking straight down its axis. Aiming the damped camera at the rail's target tilted it during every ease, and the specimen drifted off its box whenever the page moved.",
        "So the camera looks straight down from wherever it actually is, never at the target, and the 3D stays locked to the layout.",
      ],
    },
  ],
  excerpts: [
    {
      file: "components/canvas/stations.ts",
      source: "alveronium-1.txt",
      why: "This only works out where the camera should be. The smooth movement is applied separately, and the scratch vectors are allocated once, so nothing is allocated on every frame.",
    },
    {
      file: "components/canvas/Stage.tsx",
      source: "alveronium-2.txt",
      why: "The camera eases toward its target at the same rate on any frame rate, so a fast scroll arrives with some weight instead of jumping. Capping the frame time stops a jump when you return to the tab.",
    },
  ],
};

const CARE_OPS_CASE: CaseStudy = {
  problem: [
    "Care Ops is an app for NDIS disability-support providers. A provider runs on shifts: who is with which participant, when, whether they are qualified for that person's needs, and what each shift costs.",
    "Coordinators plan and pay for that week; support workers live it, one visit at a time. Care Ops puts both sides in one app, each with its own view.",
  ],
  role: [
    "Built with Saurav over two to three weeks in 2026. I did the design, the frontend and the planning, and some of the backend; Saurav worked mainly on the backend and on penetration testing.",
    "The names, addresses and branding in the recordings are placeholders.",
  ],
  approach: [
    "React 19 and TypeScript on Vite, React Router for role-aware routes, Tailwind 4, GSAP for motion including the roster's drag and drop, and date-fns for the calendar.",
    "Sign-in is split by role. Support workers ask for a magic link and a six-digit code; admins and coordinators use a password. Routes check the role, and a support worker who lands on an admin page is sent back to their shifts with a message saying why.",
    "Coordinators get live shifts, a weekly roster (with daily and fortnightly views, times snapped to 15 minutes, draft, published and archived states, and tools to copy last week or save a week as a template), participants with their plan type and budget used, staff, timesheets, and reports that split hours into ordinary, overtime and penalty rates, exportable as CSV or PDF. Support workers get their next shift, a slide to clock in that records the device's GPS position, the shift with its checklist, a ten-section care-note form and an incident report.",
    "Every screen talks to one typed API client. Behind it today is a mock backend that persists to IndexedDB in the browser and seeds itself on first run. A Postgres schema of fourteen tables, row-level security policies and seed data for Supabase sit alongside it; the app is not connected to them yet. The roster engine and the API's role checks each have their own test script, and the app installs as a web app that opens on the worker's shifts.",
  ],
  decisions: [
    {
      title: "Validate on drop, never refuse",
      body: [
        "Dragging a worker onto a participant's day runs the shift through the roster engine before anything is saved. It checks double booking, weekly hours past 38, breaks, stated availability and qualifications: a participant who needs a hoist needs a worker with manual-handling certification, and medication support needs a medication qualification. Each conflict is graded hard or soft.",
        "A clean drop creates the shift at once. A conflicting one is not refused: it opens the shift form already filled in, with the warning, so the coordinator can fix the clash or override it knowingly.",
      ],
    },
    {
      title: "Cost the shift as it lands",
      body: [
        "The same engine prices every shift on drop: the NDIS billing rate against the worker's award cost under SCHADS, with weekend, evening, night, public holiday, overtime and sleepover rates applied.",
        "Auto-fill uses the same rules, assigning unfilled shifts to the qualified worker with the fewest hours, so a filled roster and a hand-built one are checked and costed the same way.",
      ],
    },
    {
      title: "Screens that only know the contract",
      body: [
        "The screens depend on the API client's interface, never on where the data lives. That is why the whole app runs end to end in the browser with no server today.",
        "It also means the mock behind the client can be replaced by the real backend without touching a screen.",
      ],
    },
  ],
  excerpts: [
    {
      file: "pages/RosterPage.tsx",
      source: "care-ops-1.txt",
      why: "A drop is never silently refused. A clean shift is created at once, and a conflicting one opens the shift form already filled in, so the coordinator can fix it or override it.",
    },
    {
      file: "utils/rosterEngine.ts",
      source: "care-ops-2.txt",
      why: "A missing safety qualification counts as a hard conflict, unlike overtime, which only warns. The message names both the participant and the worker, so the coordinator knows exactly what to fix.",
    },
    {
      file: "components/worker/SlideToClockIn.tsx",
      source: "care-ops-3.txt",
      why: "Clocking in is a slide, not a tap, so a phone in a pocket can't start a shift. It completes at 75% so it doesn't demand a perfect swipe.",
    },
  ],
};

export const projects: Project[] = [
  {
    slug: "nova-delivers",
    counter: "01 / 03",
    title: "Nova Delivers",
    titleAccent: "Delivers",
    subtitle: "A food delivery storefront and its operations portal",
    category: "Full-Stack Web App",
    type: "Web app",
    year: "2026",
    roles: ["Design", "Frontend", "Backend & Database"],
    description:
      "A food delivery storefront for Kathmandu and a separate operations portal, built solo on plain Node.js and its built-in SQLite, with no npm dependencies. A 164-dish menu with live filtering and search, a cart with a simulated phone OTP at checkout, and a 120-frame scroll-scrubbed canvas; staff move each order from pending to delivered in the portal.",
    summary:
      "A food delivery storefront and operations portal on plain Node.js and SQLite, built solo.",
    overview:
      "Two Node.js servers share one SQLite database: the customer site on one port, the operations portal on another. Customers browse a 164-dish menu, filter and search it, build a cart and confirm a simulated phone OTP at checkout. Staff see every order arrive in the portal and move it from pending to cooking, out for delivery and delivered.",
    mainFeatures: [
      "Customer site and operations portal as two servers over one SQLite database",
      "164-dish menu across categories, filtered and searched without a page load",
      "Cart and checkout with a simulated phone OTP, codes stored with an expiry",
      "Scroll-scrubbed 120-frame burger ‘anatomy’ drawn to a canvas",
      "Order board: pending, cooking, out for delivery, delivered",
    ],
    dreamDescription:
      "A kitchen that never sleeps: a menu you scroll through like a film, and every order walking its way from the pass to the door.",
    link: "/project/nova-delivers",
    caseStudy: NOVA_CASE,
    video: video(
      "nova-delivers",
      "Screen recording of Nova Delivers in five cuts: the video hero, the burger anatomy mid-scrub, the menu filtered to momo, the cart drawer, then an order accepted in the operations portal.",
      "Captioned walkthrough of Nova Delivers: the hero, the scroll-scrubbed anatomy, filtering and searching the menu, the cart drawer, then the operations portal accepting an order.",
    ),
    cover: cover("nova-delivers", "Nova Delivers", "ice chips refracting the Nova Delivers title"),
    images: [
      still("nova-delivers", "hero", "The customer site opens on a full-bleed video hero."),
      still("nova-delivers", "anatomy", "Scrolling scrubs a 120-frame burger anatomy drawn to a canvas."),
      still("nova-delivers", "menu", "The menu: category filters and search across 164 dishes."),
      still("nova-delivers", "cart", "The cart drawer: add-ons, a rider tip and a promo code field."),
      still("nova-delivers", "admin", "The operations portal: order counts, revenue and the order board. Customer details are masked."),
    ],
    aspectRatio: "aspect-[16/10]",
    stack: {
      frontend: ["HTML", "CSS", "JavaScript", "GSAP", "Lenis"],
      backend: ["Node.js", "SQLite"],
    },
    tags: ["#fullstack", "#node", "#sqlite", "#gsap"],
  },
  {
    slug: "alveronium",
    counter: "02 / 03",
    title: "Alveronium Studio",
    titleAccent: "Studio",
    subtitle: "A studio website on a single real-time 3D stage",
    category: "Web Design / WebGL",
    type: "Web design",
    year: "2026",
    roles: ["Design", "Frontend & WebGL", "Planning"],
    description:
      "The website for Alveronium Studio, built with Saurav. One page drawn as a technical sheet over a single WebGL stage whose camera rides a rail, one station per section: a 3D specimen in the hero, a particle structure behind the statement, a services instrument panel and a dotted-land globe at the close.",
    summary:
      "A studio website drawn as a technical sheet over one shared WebGL stage, built with Saurav.",
    overview:
      "A single-page site for Alveronium Studio. Six sections share one WebGL canvas; the camera moves along a rail with a station per section, so the 3D work continues from one section into the next instead of restarting. Built with Saurav: design, frontend and planning were mine.",
    mainFeatures: [
      "One shared WebGL stage with a camera rail, one station per section",
      "A real-time 3D specimen in the hero, drawn with dimension lines",
      "Services rows that drive a live instrument panel",
      "A dotted-land globe at the close, turned to the studio's city",
      "Separate mobile layouts for every section",
    ],
    dreamDescription:
      "A blueprint that breathes: one stage, one camera, and a specimen drawn to scale as you pass it.",
    link: "/project/alveronium",
    caseStudy: ALVERONIUM_CASE,
    video: video(
      "alveronium",
      "Screen recording of Alveronium Studio in five cuts: the 3D specimen in the hero, the camera moving into the statement, the services instrument panel changing as the rows scroll past, the process stages, then the contact globe.",
      "Captioned walkthrough of Alveronium Studio: the hero specimen, the particle statement, the services instrument panel, the process stages and the globe at the close.",
    ),
    cover: cover("alveronium", "Alveronium Studio", "ice chips refracting the Alveronium Studio title"),
    images: [
      still("alveronium", "hero", "The hero: a title block, the 3D specimen and its data sheet."),
      still("alveronium", "statement", "The statement, set beside a particle structure on the shared stage."),
      still("alveronium", "services", "Services: the instrument panel redraws for the row at the middle of the screen."),
      still("alveronium", "process", "Process: five stages, each with its own line drawing."),
      still("alveronium", "contact", "Contact closes on a dotted-land globe."),
    ],
    aspectRatio: "aspect-[16/10]",
    stack: {
      frontend: ["Next.js", "React", "TypeScript", "Three.js", "React Three Fiber", "Framer Motion", "Lenis", "Tailwind CSS"],
    },
    tags: ["#webgl", "#r3f", "#nextjs", "#studio"],
  },
  {
    slug: "care-ops",
    counter: "03 / 03",
    title: "Care Ops",
    titleAccent: "Ops",
    subtitle: "Rostering, clock-in and care notes for NDIS disability support",
    category: "Operations Web App",
    type: "App design",
    year: "2026",
    roles: ["Design", "Frontend", "Planning"],
    description:
      "A role-aware operations app for NDIS disability-support providers, built with Saurav. Admins roster support workers by dragging them onto a participant's day, and each shift is checked for clashes and qualifications and costed as it drops; support workers see their next shift, slide to clock in and file care notes. Names and details shown are placeholders.",
    summary:
      "Role-aware rostering, clock-in and care notes for NDIS disability support, built with Saurav.",
    overview:
      "One app with two faces. Admins and coordinators sign in with a password and see live shifts, a weekly roster, participants, staff, timesheets and reports. Support workers sign in with a magic link and see their next shift, clock in and write care notes. The data layer is a mock API over IndexedDB, with a database schema and access policies drawn up alongside it.",
    mainFeatures: [
      "Role-aware sign-in: magic link for support workers, password for admins",
      "Drag-and-drop rostering, validated and costed on drop",
      "Participants with support needs, plan type and budget used",
      "Support worker home: next shift and slide to clock in",
      "Shift details with visit verification, checklist and care notes",
    ],
    dreamDescription:
      "A week of care laid out like a loom: each shift a thread, checked and costed the moment it lands.",
    link: "/project/care-ops",
    caseStudy: CARE_OPS_CASE,
    dataNote: "Seeded demo data, not results",
    video: video(
      "care-ops",
      "Screen recording of Care Ops in five cuts: the admin console, a support worker dragged onto a participant's day and the clash it raises, participants, a support worker sliding to clock in, then the shift details.",
      "Captioned walkthrough of Care Ops: signing in as an admin, the admin console, rostering by drag and drop, participants, then the support worker's view and slide to clock in.",
    ),
    cover: cover("care-ops", "Care Ops", "ice chips refracting the Care Ops title"),
    images: [
      still("care-ops", "login", "Role-aware sign-in: magic link for support workers, password for admins."),
      still("care-ops", "dashboard", "The admin console: who is on shift, unfilled shifts and live shift cards."),
      still("care-ops", "roster", "Rostering: a support worker dropped onto a participant's day."),
      still("care-ops", "participants", "Participants: support needs, plan type and budget used against total."),
      still("care-ops", "reports", "Reports: staff hours split into ordinary, overtime and penalty rates. Every figure here is seeded demo data, not a result."),
      still("care-ops", "worker", "The support worker's home: the next shift and slide to clock in."),
    ],
    aspectRatio: "aspect-[16/10]",
    stack: {
      frontend: ["React", "TypeScript", "Vite", "React Router", "Tailwind CSS", "GSAP"],
      backend: ["Mock API over IndexedDB", "Supabase schema & RLS policies"],
    },
    tags: ["#react", "#operations", "#rostering", "#roles"],
  },
];

export function getProjects(): Project[] {
  return projects;
}

export function getFeaturedProjects(): Project[] {
  return projects;
}

export function getProjectBySlug(slug: string): Project | undefined {
  return projects.find((p) => p.slug === slug);
}
