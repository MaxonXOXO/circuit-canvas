// src/components/Sidebar.jsx
import React from "react";
import esp8266Img from "../assets/esp8266.png";
import ultrasonicImg from "../assets/ultrasonic_sensor.png";

const parts = [
  { id: "esp8266", name: "ESP8266", image: esp8266Img },
  { id: "ultrasonic", name: "Ultrasonic Sensor", image: ultrasonicImg },
];

export default function Sidebar() {
  const handleDragStart = (event, part) => {
    // Send the whole part object as JSON under a custom mime type
    event.dataTransfer.setData("application/reactflow", JSON.stringify(part));
    event.dataTransfer.effectAllowed = "copy";

    // Optional: set a nicer drag ghost image (fallback will still happen)
    try {
      const ghost = new Image();
      ghost.src = part.image;
      // offset the ghost so cursor is near top-left
      event.dataTransfer.setDragImage(ghost, 24, 24);
    } catch (err) {
      // ignore
    }
  };

  return (
    <aside className="sidebar">
      <h3 className="sidebar-title">PARTS</h3>
      <div className="sidebar-parts">
        {parts.map((part) => (
          <div
            key={part.id}
            className="part-item"
            draggable
            onDragStart={(e) => handleDragStart(e, part)}
          >
            {/* IMPORTANT: this image must NOT be directly draggable to avoid browser default image-drag */}
            <img src={part.image} alt={part.name} className="part-image" draggable={false} />
            <span>{part.name}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}
