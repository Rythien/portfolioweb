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
  /** What the author would do differently now. */
  differently: string[];
  /** Optional outcome: results, reception, where it is used. */
  outcome?: string[];
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
  placeholder?: boolean;
  link: string;
  /** Panel and case-study hero. */
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

/** A still from the screen recording: public/projects/<slug>/still-<name>.webp. */
function still(slug: string, name: string, caption: string): ProjectImage {
  return { src: `/projects/${slug}/still-${name}.webp`, alt: caption.replace(/\.$/, ""), caption };
}

export const projects: Project[] = [
  {
    slug: "nova-delivers",
    counter: "01 / 03",
    title: "Nova Delivers",
    titleAccent: "Delivers",
    subtitle: "A food delivery storefront and its operations portal",
    category: "Web Application / Full-Stack",
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
    cover: cover("alveronium", "Alveronium Studio", "ice chips refracting the Alveronium Studio title"),
    images: [
      still("alveronium", "hero", "The hero: a title block, the 3D specimen and its data sheet."),
      still("alveronium", "statement", "The statement, set beside a particle structure on the shared stage."),
      still("alveronium", "services", "Services: hovering a row redraws the instrument panel."),
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
    subtitle: "Rostering and shift operations for disability support",
    category: "Web Application / Operations",
    type: "App design",
    year: "2026",
    roles: ["Design", "Frontend", "Planning"],
    description:
      "A role-aware operations app for disability support, built with Saurav. Admins roster support workers by dragging them onto a participant's day, and each shift is checked for clashes and qualifications and costed as it drops; support workers see their next shift, slide to clock in and file care notes. Names and details shown are placeholders.",
    summary:
      "Role-aware rostering, clock-in and care notes for disability support, built with Saurav.",
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
    cover: cover("care-ops", "Care Ops", "ice chips refracting the Care Ops title"),
    images: [
      still("care-ops", "login", "Role-aware sign-in: magic link for support workers, password for admins."),
      still("care-ops", "dashboard", "The admin console: who is on shift, unfilled shifts and live shift cards."),
      still("care-ops", "roster", "Rostering: a support worker dropped onto a participant's day."),
      still("care-ops", "participants", "Participants: support needs, plan type and budget used against total."),
      still("care-ops", "reports", "Reports: staff hours split into ordinary, overtime and penalty rates."),
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
