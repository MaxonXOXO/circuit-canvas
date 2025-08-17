// src/components/Canvas.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";

const GRID_SIZE = 40;
const DOT_RADIUS = 2;
const uid = () => Math.random().toString(36).slice(2, 9);

export default function Canvas() {
  const hostRef = useRef(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [placed, setPlaced] = useState([]);
  const [scale, setScale] = useState(1);

  const [draggingId, setDraggingId] = useState(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  // --- NEW: trace drawing state (stored in grid units so zoom won't break them)
  // A trace = { id, points: [{ gx, gy }, ...] }
  const [traces, setTraces] = useState([]);
  const [activeTrace, setActiveTrace] = useState(null); // same shape as trace
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setSize({ w: Math.floor(r.width), h: Math.floor(r.height) });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const points = useMemo(() => {
    const pts = [];
    const step = GRID_SIZE * scale;
    for (let x = step; x <= size.w - step; x += step) {
      for (let y = step; y <= size.h - step; y += step) {
        pts.push({ x, y });
      }
    }
    return pts;
  }, [size, scale]);

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const snap = (v) =>
    Math.round(v / (GRID_SIZE * scale)) * (GRID_SIZE * scale);

  // Helpers to convert mouse -> local -> grid units
  const toLocal = (e) => {
    const rect = hostRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const toGrid = (x, y) => {
    const step = GRID_SIZE * scale;
    return { gx: Math.round(x / step), gy: Math.round(y / step) };
  };
  const gridToScreen = ({ gx, gy }) => {
    const step = GRID_SIZE * scale;
    return { x: gx * step, y: gy * step };
  };

  // Drag & drop handlers (unchanged)
  const onDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const onDrop = (e) => {
    e.preventDefault();
    const raw =
      e.dataTransfer.getData("application/reactflow") ||
      e.dataTransfer.getData("text/plain");
    if (!raw) return;

    let part = null;
    try {
      part = JSON.parse(raw);
    } catch {
      part = { id: uid(), name: "part", image: raw, imageUrl: raw };
    }

    const rect = hostRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const sx = clamp(snap(x), GRID_SIZE * scale, size.w - GRID_SIZE * scale);
    const sy = clamp(snap(y), GRID_SIZE * scale, size.h - GRID_SIZE * scale);

    const img = part.image || part.imageUrl || part.img || part.imageSrc || "";

    const item = {
      id: uid(),
      type: part.id || part.name || "part",
      name: part.name || part.type || "Part",
      img,
      x: sx,
      y: sy,
    };

    setPlaced((p) => [...p, item]);
  };

  // Start dragging existing items (unchanged except for Shift override)
  const onItemMouseDown = (e, id) => {
    // If Shift is held, we're drawing traces instead of dragging items.
    if (e.shiftKey) return;

    e.stopPropagation();
    const rect = hostRef.current.getBoundingClientRect();
    const item = placed.find((p) => p.id === id);
    if (!item) return;
    setDraggingId(id);
    dragOffset.current = {
      x: e.clientX - rect.left - item.x,
      y: e.clientY - rect.top - item.y,
    };
  };

  // Section-level mousedown: if Shift is held, start a snapped trace
  const onSectionMouseDown = (e) => {
    if (!e.shiftKey) return; // only handle drawing when Shift is down
    e.preventDefault();

    const { x, y } = toLocal(e);
    const gp = toGrid(x, y);

    setActiveTrace({ id: uid(), points: [gp] });
    setIsDrawing(true);
  };

  const onMouseMove = (e) => {
    // Drawing takes priority
    if (isDrawing && activeTrace) {
      const { x, y } = toLocal(e);
      const gp = toGrid(x, y);
      const pts = activeTrace.points;
      const last = pts[pts.length - 1];
      // add a new snapped point only when the grid cell changes
      if (!last || last.gx !== gp.gx || last.gy !== gp.gy) {
        setActiveTrace({ ...activeTrace, points: [...pts, gp] });
      }
      return;
    }

    // Dragging items (original behavior)
    if (!draggingId) return;
    const rect = hostRef.current.getBoundingClientRect();
    const newX = e.clientX - rect.left - dragOffset.current.x;
    const newY = e.clientY - rect.top - dragOffset.current.y;
    setPlaced((prev) =>
      prev.map((p) =>
        p.id === draggingId
          ? {
              ...p,
              x: clamp(snap(newX), GRID_SIZE * scale, size.w - GRID_SIZE * scale),
              y: clamp(snap(newY), GRID_SIZE * scale, size.h - GRID_SIZE * scale),
            }
          : p
      )
    );
  };

  const onMouseUp = () => {
    // Finish drawing a trace
    if (isDrawing && activeTrace) {
      if (activeTrace.points.length > 1) {
        setTraces((prev) => [...prev, activeTrace]);
      }
      setActiveTrace(null);
      setIsDrawing(false);
      return;
    }

    // Finish dragging items
    setDraggingId(null);
  };

  const onWheel = (e) => {
    e.preventDefault();
    const delta = -e.deltaY / 500;
    setScale((prev) => clamp(prev + delta, 0.3, 2));
  };

  return (
    <section
      className="canvas"
      ref={hostRef}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onWheel={onWheel}
      onMouseDown={onSectionMouseDown} /* enable Shift-to-draw */
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      style={{
        position: "relative",
        overflow: "hidden",
        background: "#222",
        cursor: isDrawing ? "crosshair" : draggingId ? "grabbing" : "grab",
      }}
    >
      {/* Grid + Traces layer (SVG under the images) */}
      <svg
        className="canvas-svg"
        width={size.w}
        height={size.h}
        viewBox={`0 0 ${size.w} ${size.h}`}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          zIndex: 1,
        }}
      >
        {/* existing dotted grid */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={DOT_RADIUS}
            fill="rgba(255,255,255,0.12)"
          />
        ))}

        {/* completed snapped traces */}
        {traces.map((t) => {
          const pts = t.points.map((pt) => {
            const { x, y } = gridToScreen(pt);
            return `${x},${y}`;
          });
          return (
            <polyline
              key={t.id}
              points={pts.join(" ")}
              fill="none"
              stroke="#00e676"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}

        {/* active trace while drawing */}
        {isDrawing && activeTrace && activeTrace.points.length > 0 && (
          <polyline
            points={activeTrace.points
              .map((pt) => {
                const { x, y } = gridToScreen(pt);
                return `${x},${y}`;
              })
              .join(" ")}
            fill="none"
            stroke="#ffc400"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>

      {/* Components without forced resize (unchanged) */}
      {placed.map((c) => (
        <img
          key={c.id}
          src={c.img}
          alt={c.name}
          draggable={false}
          onMouseDown={(e) => onItemMouseDown(e, c.id)}
          style={{
            position: "absolute",
            left: c.x - (1080 / 2) * scale, // keep center position with scale
            top: c.y - (1080 / 2) * scale,
            width: 1080 * scale, // scale only if zoomed
            height: 1080 * scale,
            zIndex: 2,
            userSelect: "none",
            pointerEvents: "auto",
          }}
        />
      ))}

      <div
        className="canvas-hint"
        style={{
          position: "absolute",
          top: 8,
          left: 8,
          zIndex: 3,
          color: "#fff",
        }}
      >
        Scroll to zoom — drag items to move — drop parts to place (snap to grid) —{" "}
        <strong>Hold Shift + drag to draw traces (snaps to grid)</strong>
      </div>
    </section>
  );
}
