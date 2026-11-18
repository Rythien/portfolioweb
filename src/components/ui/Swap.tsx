import React from "react";

/**
 * A button or link label as two stacked copies that swap through a clip
 * on hover and keyboard focus (CSS: .swap in globals.css). The second
 * copy is decorative: screen readers and copy-paste see the label once.
 */
export default function Swap({ children }: { children: React.ReactNode }) {
  return (
    <span className="swap">
      <span>{children}</span>
      <span aria-hidden="true" className="select-none">
        {children}
      </span>
    </span>
  );
}
