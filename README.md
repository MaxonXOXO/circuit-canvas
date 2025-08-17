
# ⚡ Circuit Builder WebApp (Alpha)
 👉 A web-based PCB design simulator (Alpha) — drag, drop, snap, and connect components on an interactive canvas. Inspired by Circuito.io.
 
<img width="1920" height="965" alt="image" src="https://github.com/user-attachments/assets/902b4ec6-64cf-4b52-8f1b-c5034212a5e8" />


## 📌 Overview  
This project is a **React-based web application** for building simple circuits visually. (May use Vite or Tailwind CSS in future)  
Users can drag electronic components from a sidebar, drop them on a canvas, and arrange them using an invisible grid with snapping support.  

Currently in **Alpha stage**:
- ✅ Drag & Drop from sidebar to canvas  
- ✅ Grid snapping  
- 🚧 Upcoming: Resizing, repositioning, and connecting traces  

---

## 🛠️ Features (Alpha)
- **Drag & Drop Components** → Place parts like resistors, LEDs, etc. on the canvas.  
- **Snap to Grid** → Keeps items aligned neatly.  
- **Resizable & Moveable Elements (Coming Soon)** → Planned functionality for resizing components and repositioning after drop.  
- **Trace Drawing (Planned)** → Invisible grid layout for drawing circuit traces.  

---

## 📂 Project Structure (Alpha! may or may not change)
```
src/
 ┣ components/
 ┃ ┣ Canvas.jsx       # Main canvas for placing components
 ┃ ┣ Sidebar.jsx      # Sidebar with draggable items
 ┃ ┗ App.jsx          # Root component
 ┣ assets/            # Component images/icons
 ┣ index.js           # Entry point
 ┗ styles/            # (Optional) Global styles
```

---

## 🚀 Installation & Running
```bash
# Clone the repo
git clone https://github.com/MaxonXOXO/circuit-canvas.git
cd circuit-canvas

# Install dependencies
npm install

# Run development server
npm start
```

---

## 📌 Roadmap
- [x] Basic drag & drop support  
- [x] Snap-to-grid layout  
- [ ] Resizable dropped items  
- [ ] Move existing items on canvas  
- [ ] Draw and connect traces  

---

## 🤝 Contributing
This is a **work-in-progress Alpha release**. Contributions are welcome!  
Feel free to fork, suggest features, or submit issues.  

---

## 📜 License
MIT License – Free to use and modify.  
