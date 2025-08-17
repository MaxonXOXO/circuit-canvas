import React from "react";
import Header from "./components/Header";
import Footer from "./components/Footer";
import Canvas from "./components/Canvas";
import "./styles.css";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
function App() {

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Router>
  );
}

export default function App() {
  return (
    <div className="app-container">
      <Header />
      <main>
        <Canvas />
      </main>
      <Footer />
    </div>
  );
}
