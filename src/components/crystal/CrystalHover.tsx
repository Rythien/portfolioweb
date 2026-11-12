"use client";

import { useRef, useEffect, useCallback } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { getCrystalPose } from "@/hooks/useCrystalPose";
import { useFractureStore } from "@/store/useFractureStore";

const HOVER_RADIUS = 1.6;
const HYSTERESIS_IN = 0.85;
const HYSTERESIS_OUT = 1.15;

const _worldPos = new THREE.Vector3();
const _ndc = new THREE.Vector3();

export default function CrystalHover() {
  const { camera, size } = useThree();
  const hovering = useRef(false);
  const mouseScreen = useRef({ x: -999, y: -999 });
  const isTouchRef = useRef(false);
  const touchToggleRef = useRef(false);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouseScreen.current.x = e.clientX;
      mouseScreen.current.y = e.clientY;
      isTouchRef.current = false;
    };
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        mouseScreen.current.x = e.touches[0].clientX;
        mouseScreen.current.y = e.touches[0].clientY;
        isTouchRef.current = true;
      }
    };
    const onTouchEnd = () => {
      if (isTouchRef.current && hovering.current) {
        touchToggleRef.current = !touchToggleRef.current;
        useFractureStore.setState({ hoverBreak: touchToggleRef.current });
      }
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  useFrame(() => {
    if (isTouchRef.current) return;

    const pose = getCrystalPose();
    _worldPos.set(pose.x, pose.y, pose.z);
    _ndc.copy(_worldPos).project(camera);

    const screenX = (_ndc.x * 0.5 + 0.5) * size.width;
    const screenY = (-_ndc.y * 0.5 + 0.5) * size.height;

    const radiusWorld = HOVER_RADIUS * pose.scale;
    const edgeWorld = _worldPos.clone();
    edgeWorld.x += radiusWorld;
    const edgeNdc = edgeWorld.project(camera);
    const edgeScreenX = (edgeNdc.x * 0.5 + 0.5) * size.width;
    const radiusPx = Math.abs(edgeScreenX - screenX);

    const dx = mouseScreen.current.x - screenX;
    const dy = mouseScreen.current.y - screenY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const wasHovering = hovering.current;
    if (!wasHovering && dist < radiusPx * HYSTERESIS_IN) {
      hovering.current = true;
    } else if (wasHovering && dist > radiusPx * HYSTERESIS_OUT) {
      hovering.current = false;
    }

    if (hovering.current !== wasHovering) {
      useFractureStore.setState({
        hoverBreak: hovering.current,
        cursorLabel: hovering.current ? "BREAK" : "",
      });
    }
  });

  return null;
}
