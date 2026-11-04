import LenisProvider from "@/components/common/LenisProvider";
import Header from "@/components/common/Header";
import Preloader from "@/components/common/Preloader";

import Hero from "@/components/sections/Hero";
import About from "@/components/sections/About";
import Disciplines from "@/components/sections/Disciplines";
import Works from "@/components/sections/Works";
import DreamTeaser from "@/components/sections/DreamTeaser";
import Recognition from "@/components/sections/Recognition";
import Contact from "@/components/sections/Contact";
import Footer from "@/components/sections/Footer";

export default function Home() {
  return (
    <LenisProvider>
      <Preloader />
      <a
        href="#works"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[200] focus:px-4 focus:py-2 focus:bg-[#f2efe9] focus:text-[#08080a] font-mono text-xs uppercase tracking-widest outline-none border border-[#f2efe9]"
      >
        Skip to main content
      </a>
      <Header />
      <main id="main-content" className="relative block w-full bg-[#08080a] text-[#f2efe9]">
        <Hero />
        <About />
        <Disciplines />
        <Works />
        <DreamTeaser />
        <Recognition />
        <Contact />
      </main>
      <Footer />
    </LenisProvider>
  );
}
