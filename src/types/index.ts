export interface FocusArea {
  number: string;
  title: string;
  tagline: string;
  description: string;
  tech: string[];
}

export interface SkillCategory {
  category: string;
  count: string;
  items: string[];
}

export interface ExperienceItem {
  id: string;
  role: string;
  company: string;
  location: string;
  period: string;
  summary: string;
  results: string[];
  stack: string[];
}

export interface EducationItem {
  degree: string;
  institution: string;
  location: string;
  period: string;
  details: string;
}

export interface ProjectItem {
  id: string;
  title: string;
  client: string;
  year: string;
  category: string;
  oneLiner: string;
  description: string;
  role: string;
  stack: string[];
  metrics: string;
  link: string;
  github?: string;
  accentColor?: string;
  image: string;
  highlights: string[];
}

export interface LabExperiment {
  id: string;
  number: string;
  title: string;
  description: string;
  type: "glsl" | "particles" | "physics";
  tag: string;
}

export interface MetricItem {
  number: string;
  label: string;
  subtext: string;
}
