"use client";

import { useRef, useState } from "react";


export function DragScroller({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; scrollLeft: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  
  const moved = useRef(false);

  return (
    <div
      ref={ref}
      className={`${className} ${dragging ? "cursor-grabbing select-none" : "cursor-grab"}`}
      onPointerDown={(e) => {
        if (e.pointerType !== "mouse" || e.button !== 0) return;
        start.current = { x: e.clientX, scrollLeft: ref.current?.scrollLeft ?? 0 };
        moved.current = false;
        setDragging(true);
      }}
      onPointerMove={(e) => {
        if (!start.current || !ref.current) return;
        const dx = e.clientX - start.current.x;
        if (Math.abs(dx) > 4) moved.current = true;
        ref.current.scrollLeft = start.current.scrollLeft - dx;
      }}
      onPointerUp={() => {
        start.current = null;
        setDragging(false);
      }}
      onPointerLeave={() => {
        start.current = null;
        setDragging(false);
      }}
      onClickCapture={(e) => {
       
        if (moved.current) {
          e.preventDefault();
          e.stopPropagation();
          moved.current = false;
        }
      }}
      onDragStart={(e) => e.preventDefault()} 
    >
      {children}
    </div>
  );
}
