"use client";

import dynamic from "next/dynamic";

const SceneRoot = dynamic(() => import("@/components/scene/SceneRoot"), {
  ssr: false,
});

export default function SceneLoader() {
  return <SceneRoot />;
}
