"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  onChange: (dataUrl: string | null) => void;
  height?: number;
};

export default function SignaturePad({ onChange, height = 160 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  // scale for retina
  useEffect(() => {
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    const width = c.clientWidth;
    const h = height;
    c.width = width * dpr;
    c.height = h * dpr;
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#111827";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, h);
  }, [height]);

  function pos(e: PointerEvent | React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    drawing.current = true;
    setHasDrawn(true);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }

  function end() {
    drawing.current = false;
    // emit data url (PNG)
    const url = canvasRef.current!.toDataURL("image/png");
    onChange(hasDrawn ? url : null);
  }

  function clear() {
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    ctx.save();
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,c.width,c.height);
    ctx.restore();
    // repaint white background
    const dpr = window.devicePixelRatio || 1;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0,0,c.width/dpr,c.height/dpr);
    setHasDrawn(false);
    onChange(null);
  }

  return (
    <div className="space-y-2">
      <div className="border rounded-2xl overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          className="w-full"
          style={{ height }}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          onPointerCancel={end}
        />
      </div>
      <div className="flex gap-2">
        <button type="button" className="rounded-xl border px-3 py-2" onClick={clear}>
          Clear
        </button>
        <span className="text-xs text-[#6B7280]">Sign with finger or mouse.</span>
      </div>
    </div>
  );
}
