// src/components/Header.jsx
// Changelog:
// v1.0 - Added trace color selector (red, green, black, blue).
//         Dispatches 'trace-color-changed' CustomEvent so Canvas can pick up selection.

import React, { useState, useEffect } from "react";

export default function Header() {
  const colors = [
    { name: "red", hex: "#e53935" },
    { name: "green", hex: "#00c853" },
    { name: "black", hex: "#000000" },
    { name: "blue", hex: "#2962ff" },
  ];

  const [selected, setSelected] = useState("black");

  // Emit selection for Canvas to pick up
  useEffect(() => {
    const ev = new CustomEvent("trace-color-changed", { detail: selected });
    window.dispatchEvent(ev);
  }, [selected]);

  return (
    <header
      className="header"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 12px",
        borderBottom: "1px solid rgba(0,0,0,0.06)",
        background: "#0a102bff",
        zIndex: 1000,
      }}
    >
      <div className="header-left" style={{ display: "flex", alignItems: "center" }}>
        <h1 className="text-3xl font-bold" style={{ margin: 0, color: "#ef4444" }}>
          WireframeX
        </h1>
      </div>

      <div
        className="header-right"
        style={{ display: "flex", alignItems: "center", gap: 12 }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="btn" disabled style={{ padding: "6px 10px" }}>
            New
          </button>
          <button className="btn" disabled style={{ padding: "6px 10px" }}>
            Save
          </button>
          <button className="btn" disabled style={{ padding: "6px 10px" }}>
            Help
          </button>
        </div>

        {/* Trace color selector */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginLeft: 8 }}>
          {colors.map((c) => (
            <button
              key={c.name}
              onClick={() => setSelected(c.name)}
              title={c.name}
              style={{
                width: 26,
                height: 26,
                borderRadius: 999,
                border: selected === c.name ? "2px solid #111" : "2px solid rgba(0,0,0,0.12)",
                background: c.hex,
                padding: 0,
                cursor: "pointer",
                boxSizing: "border-box",
              }}
            />
          ))}
        </div>
      </div>
    </header>
  );
}
