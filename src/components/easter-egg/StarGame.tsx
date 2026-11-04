"use client";

import React, { useState, useEffect, useRef } from "react";
import { useStars } from "@/contexts/StarContext";

export default function StarGame() {
  const { isGameUnlocked } = useStars();
  const [isOpen, setIsOpen] = useState(false);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(20);
  const [isPlaying, setIsPlaying] = useState(false);
  const [targetPos, setTargetPos] = useState({ x: 50, y: 50 });
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("searon_stargame_high");
      if (saved) {
        queueMicrotask(() => {
          setHighScore(parseInt(saved, 10));
        });
      }
    } catch {}
  }, []);

  const spawnTarget = () => {
    const x = Math.floor(Math.random() * 80) + 10;
    const y = Math.floor(Math.random() * 70) + 15;
    setTargetPos({ x, y });
  };

  const startGame = () => {
    setScore(0);
    setTimeLeft(20);
    setIsPlaying(true);
    spawnTarget();

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setIsPlaying(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleHit = () => {
    if (!isPlaying) return;
    const nextScore = score + 1;
    setScore(nextScore);
    if (nextScore > highScore) {
      setHighScore(nextScore);
      try {
        localStorage.setItem("searon_stargame_high", nextScore.toString());
      } catch {}
    }
    spawnTarget();
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  if (!isGameUnlocked) return null;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 left-6 z-40 bg-[#050505] border border-white/20 text-[#edebe6] px-3 py-1.5 font-mono text-label uppercase tracking-widest hover:border-white transition-colors"
      >
        ✦ Play Star Reflex (Unlocked)
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[1000] bg-[#050505]/95 backdrop-blur-md flex items-center justify-center p-6"
        >
          <div className="relative w-full max-w-lg border border-white/20 bg-[#050505] p-6 sm:p-8 flex flex-col gap-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="font-mono text-label uppercase tracking-widest text-[#edebe6]">
                  Reflex Calibrator · 20s
                </h3>
                <p className="font-mono text-label text-[#edebe6]/75 uppercase mt-0.5 tabular-nums">
                  High Score: {highScore.toString().padStart(2, "0")}
                </p>
              </div>
              <button
                onClick={() => {
                  setIsOpen(false);
                  setIsPlaying(false);
                  if (timerRef.current) clearInterval(timerRef.current);
                }}
                className="font-mono text-xs text-[#edebe6]/70 hover:text-white"
              >
                [ESC ✕]
              </button>
            </div>

            <div className="relative h-64 border border-white/10 overflow-hidden bg-black/40">
              {isPlaying ? (
                <button
                  onClick={handleHit}
                  style={{ top: `${targetPos.y}%`, left: `${targetPos.x}%` }}
                  className="absolute w-8 h-8 -translate-x-1/2 -translate-y-1/2 bg-[#edebe6] text-[#050505] font-mono text-xs font-bold rounded-sm flex items-center justify-center transition-transform active:scale-90"
                >
                  ✦
                </button>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <div className="font-mono text-sm uppercase tracking-wider text-[#edebe6]">
                    {timeLeft === 0 ? `Final Score: ${score}` : "Ready to calibrate?"}
                  </div>
                  <button
                    onClick={startGame}
                    className="font-mono text-xs uppercase tracking-widest px-4 py-2 bg-[#edebe6] text-[#050505] font-semibold"
                  >
                    {timeLeft === 0 ? "Play Again" : "Start"}
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between font-mono text-xs uppercase tracking-widest text-[#edebe6]/70">
              <span>Time: {timeLeft.toString().padStart(2, "0")}s</span>
              <span>Score: {score.toString().padStart(2, "0")}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
