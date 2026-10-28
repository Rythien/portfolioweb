import LenisProvider from "@/components/common/LenisProvider";
import Header from "@/components/common/Header";
import Hero from "@/components/sections/Hero";

export default function Home() {
  return (
    <LenisProvider>
      <Header />
      <main className="relative flex flex-col w-full bg-[#0b0b0b]">
        <Hero />
      </main>
    </LenisProvider>
  );
}
