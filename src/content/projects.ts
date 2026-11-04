import { z } from "zod";

export const ProjectSchema = z.object({
  slug: z.string(),
  title: z.string(),
  subtitle: z.string(),
  year: z.string(),
  type: z.string(),
  featured: z.boolean(),
  order: z.number(),
  placeholder: z.boolean().default(true),
  summary: z.string(),
  overview: z.string(),
  mainFeatures: z.array(z.string()),
  technicalChallenges: z.array(z.string()),
  stack: z.object({
    frontend: z.array(z.string()),
    backend: z.array(z.string()).optional(),
    tools: z.array(z.string()).optional(),
  }),
  tags: z.array(z.string()),
  links: z
    .object({
      live: z.string().optional(),
      repo: z.string().optional(),
    })
    .optional(),
  images: z.array(
    z.object({
      src: z.string(),
      alt: z.string(),
      caption: z.string(),
    })
  ),
  ogImage: z.string(),
});

export type Project = z.infer<typeof ProjectSchema>;

export const projects: Project[] = [
  {
    slug: "ecommerce-capstone",
    title: "E-commerce website (capstone)",
    subtitle: "Final-year university capstone online store",
    year: "2025 [CONFIRM YEAR]",
    type: "Web design",
    featured: true,
    order: 1,
    placeholder: true,
    summary:
      "A complete e-commerce website designed and built from scratch as a final-year BICT capstone project at Asia e University.",
    overview:
      "I designed and built a complete online store as my final-year university project, from planning the pages to the working site. It covers product listing, product pages, cart, checkout, user accounts, and an administration dashboard.",
    mainFeatures: [
      "Designed the layout and the shopping flow",
      "Built the site with [TECH YOU USED]",
      "[Anything you are proud of: speed, mobile layout, a feature, a grade]",
    ],
    technicalChallenges: [
      "Handling state synchronization across cart and checkout flows",
      "Maintaining responsive layouts across mobile and desktop viewports",
      "[CONFIRM specific technical challenge overcome]",
    ],
    stack: {
      frontend: ["React", "Next.js", "Tailwind CSS", "TypeScript"],
      backend: ["[CONFIRM BACKEND / DB, e.g. Node.js, PostgreSQL]"],
      tools: ["Figma", "Git"],
    },
    tags: ["#webdesign", "#ecommerce", "#react", "#capstone"],
    links: {
      repo: "https://github.com/searonmaharjan/[REPO]",
      live: "https://[LIVE-URL-IF-ANY]",
    },
    images: [
      {
        src: "/opengraph-image",
        alt: "E-commerce capstone website preview",
        caption: "Overview of the storefront and checkout architecture",
      },
      {
        src: "/opengraph-image",
        alt: "Shopping flow wireframes",
        caption: "Mobile and desktop responsive cart interface",
      },
    ],
    ogImage: "/opengraph-image",
  },
  {
    slug: "project-two",
    title: "[PROJECT TWO]",
    subtitle: "Mobile application",
    year: "[YEAR]",
    type: "App design",
    featured: true,
    order: 2,
    placeholder: true,
    summary:
      "Mobile app screens and user journeys designed for high usability and intuitive navigation.",
    overview:
      "[OVERVIEW FOR PROJECT TWO: Describe the app, its audience, and the problem it solves.]",
    mainFeatures: [
      "User flows and wireframes",
      "Interactive clickable prototypes",
      "Platform-native iOS and Android conventions",
    ],
    technicalChallenges: [
      "[Technical or UX challenge 1]",
      "[Technical or UX challenge 2]",
    ],
    stack: {
      frontend: ["React Native", "TypeScript"],
      tools: ["Figma"],
    },
    tags: ["#appdesign", "#mobile", "#uiux"],
    images: [
      {
        src: "/opengraph-image",
        alt: "Project two app screens",
        caption: "Key app screens and navigation structure",
      },
    ],
    ogImage: "/opengraph-image",
  },
  {
    slug: "project-three",
    title: "[PROJECT THREE]",
    subtitle: "3D product visuals and renders",
    year: "[YEAR]",
    type: "3D / Blender",
    featured: true,
    order: 3,
    placeholder: true,
    summary:
      "3D models and renders created in Blender for product visualization and digital interfaces.",
    overview:
      "[OVERVIEW FOR PROJECT THREE: Describe the 3D models, textures, lighting, and renders created in Blender.]",
    mainFeatures: [
      "Precision 3D modeling",
      "Realistic materials and studio lighting",
      "Optimized assets for web and interface use",
    ],
    technicalChallenges: [
      "Balancing polygon density and real-time render performance",
      "[Challenge 2]",
    ],
    stack: {
      frontend: ["Blender", "WebGL"],
      tools: ["Blender"],
    },
    tags: ["#3d", "#blender", "#rendering"],
    images: [
      {
        src: "/opengraph-image",
        alt: "Project three 3D render preview",
        caption: "High-resolution studio render produced in Blender",
      },
    ],
    ogImage: "/opengraph-image",
  },
];

// Validate all projects at build time
export function getProjects(): Project[] {
  return projects.map((p) => ProjectSchema.parse(p));
}

export function getFeaturedProjects(): Project[] {
  return getProjects().filter((p) => p.featured);
}

export function getProjectBySlug(slug: string): Project | undefined {
  return getProjects().find((p) => p.slug === slug);
}
