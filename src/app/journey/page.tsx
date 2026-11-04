"use client";

import React from "react";
import Journey from "@/components/sections/Journey";
import Header from "@/components/common/Header";
import LenisProvider from "@/components/common/LenisProvider";

export default function JourneyPreviewPage() {
  return (
    <LenisProvider>
      <div className="bg-[#050505] min-h-screen text-[#edebe6] flex flex-col justify-center">
        <Header />
        <main className="pt-20">
          <Journey />
        </main>
      </div>
    </LenisProvider>
  );
}
