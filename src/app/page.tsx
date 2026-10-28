import LenisProvider from "@/components/common/LenisProvider";
import Header from "@/components/common/Header";
import Hero from "@/components/sections/Hero";
import About from "@/components/sections/About";
import Journey from "@/components/sections/Journey";
import Skills from "@/components/sections/Skills";
import Experience from "@/components/sections/Experience";
import Impact from "@/components/sections/Impact";
import Projects from "@/components/sections/Projects";
import Lab from "@/components/sections/Lab";
import Colophon from "@/components/sections/Colophon";
import Contact from "@/components/sections/Contact";
import Footer from "@/components/sections/Footer";

export default function Home() {
  return (
    <LenisProvider>
      <a
        href="#hero"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[200] focus:px-4 focus:py-2 focus:bg-white focus:text-black font-mono text-xs uppercase tracking-widest outline-none border border-white"
      >
        Skip to main content
      </a>
      <Header />
      <main className="relative flex flex-col w-full bg-[#050505]">
        <Hero />
        <About />
        <Journey />
        <Skills />
        <Experience />
        <Impact />
        <Projects />
        <Lab />
        <Colophon />
        <Contact />
      </main>
      <Footer />
    </LenisProvider>
  );
}
