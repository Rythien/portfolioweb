import LenisProvider from "@/components/common/LenisProvider";
import Header from "@/components/common/Header";
import Preloader from "@/components/common/Preloader";
import ModePill from "@/components/chrome/ModePill";
import SectionRail from "@/components/chrome/SectionRail";
import SoundLayer from "@/components/chrome/SoundLayer";
import TransitionLayer from "@/components/chrome/TransitionLayer";
import SceneLoader from "@/components/scene/SceneLoader";

import Hero from "@/components/sections/Hero";
import About from "@/components/sections/About";
import Disciplines from "@/components/sections/Disciplines";
import Works from "@/components/sections/Works";
import Recognition from "@/components/sections/Recognition";
import Contact from "@/components/sections/Contact";
import Footer from "@/components/sections/Footer";

export default function Home() {
  return (
    <LenisProvider>
      <Preloader />
      <a
        href="#works"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[200] focus:px-4 focus:py-2 focus:bg-surface focus:text-ink font-mono text-xs uppercase tracking-widest outline-none border border-rule"
      >
        Skip to main content
      </a>
      <Header />
      <SectionRail />
      <SceneLoader />
      <main id="main-content" className="relative z-[1] block w-full">
        <Hero />
        <About />
        <Disciplines />
        <Works />
        <Recognition />
        <Contact />
      </main>
      <Footer />
      <ModePill />
      <SoundLayer />
      <TransitionLayer />
    </LenisProvider>
  );
}
