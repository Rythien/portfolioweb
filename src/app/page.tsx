import LenisProvider from "@/components/common/LenisProvider";
import Header from "@/components/common/Header";
import Preloader from "@/components/common/Preloader";
import ModePill from "@/components/chrome/ModePill";
import ArchiveSlot from "@/components/archive/ArchiveSlot";
import SectionRail from "@/components/chrome/SectionRail";
import SoundLayer from "@/components/chrome/SoundLayer";
import TransitionLayer from "@/components/chrome/TransitionLayer";
import SceneLoader from "@/components/scene/SceneLoader";

import Hero from "@/components/sections/Hero";
import About from "@/components/sections/About";
import Disciplines from "@/components/sections/Disciplines";
import Works from "@/components/sections/Works";
import Contact from "@/components/sections/Contact";
import Footer from "@/components/sections/Footer";

// Title, description and card come from the root layout
export const metadata = { alternates: { canonical: "/" } };

export default function Home() {
  return (
    <LenisProvider>
      <Preloader />
      <a
        href="#works"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[200] focus:px-4 focus:py-2 focus:bg-surface focus:text-ink font-mono text-sm uppercase tracking-widest border border-rule"
      >
        Skip to main content
      </a>
      <Header modeControl />
      <SectionRail />
      <SceneLoader />
      <main id="main-content" className="relative z-[1] block w-full">
        <Hero />
        <About />
        <Disciplines />
        <Works />
        <Contact />
      </main>
      <Footer />
      <ModePill />
      <ArchiveSlot />
      <SoundLayer />
      <TransitionLayer />
    </LenisProvider>
  );
}
