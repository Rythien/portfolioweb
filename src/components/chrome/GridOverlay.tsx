"use client";

export default function GridOverlay() {
  return (
    <div
      className="grid-overlay"
      aria-hidden="true"
    >
      {Array.from({ length: 12 }, (_, i) => (
        <span key={i} />
      ))}
    </div>
  );
}
