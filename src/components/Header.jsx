import React from "react";

export default function Header() {
  return (
    <header className="header">
      <div className="header-left">
        <h1 className="text-3xl font-bold text-red-500">WireframeX</h1>
      </div>
      <div className="header-right">
        <button className="btn" disabled>New</button>
        <button className="btn" disabled>Save</button>
        <button className="btn" disabled>Help</button>
      </div>
    </header>
  );
}
