"use client";

import dynamic from "next/dynamic";
import CircleReveal from "@/components/transition/CircleReveal";

const DreamCanvas = dynamic(
  () => import("@/components/canvas/DreamCanvas"),
  { ssr: false }
);

const ShaderTransition = dynamic(
  () => import("@/components/transition/ShaderTransition"),
  { ssr: false }
);

export default function TransitionLayer() {
  return (
    <>
      <DreamCanvas />
      <ShaderTransition />
      <CircleReveal />
    </>
  );
}
