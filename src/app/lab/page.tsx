"use client";

import dynamic from "next/dynamic";

const LabCanvas = dynamic(() => import("@/components/scene/LabCanvas"), {
  ssr: false,
});

export default function LabPage() {
  return <LabCanvas />;
}
