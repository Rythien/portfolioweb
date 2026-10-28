import LenisProvider from "@/components/common/LenisProvider";
import CustomCursor from "@/components/common/CustomCursor";
import Header from "@/components/common/Header";
import Preloader from "@/components/common/Preloader";
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
      <Preloader />
      <CustomCursor />
      <Header />
      <main className="relative flex flex-col w-full bg-[var(--bg-void)]">
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
