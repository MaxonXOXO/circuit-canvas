import React, { useEffect, useRef, useState } from "react";

const GRID_SIZE = 20;
const DOT_RADIUS = 1;
const TRACE_WIDTH = 4;
const uid = () => Math.random().toString(36).slice(2, 9);
const VIRTUAL_WORLD_MIN = 10000;
const MIN_COMPONENT_SIZE = 400;
const MAX_COMPONENT_SIZE = 1080;
const SIZE_INCREMENT = GRID_SIZE / 2;

// Tool types
const TOOLS = {
  PAN: 'pan',
  POINTER: 'pointer',
  SELECT: 'select',
  DRAW: 'draw',
  SMART_DRAW: 'smart_draw'
};

export default function Canvas() {
  const hostRef = useRef(null);
  const [selectedColor, setSelectedColor] = useState("#00e676");
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [placed, setPlaced] = useState([]);
  const [draggingId, setDraggingId] = useState(null);
  const [resizingId, setResizingId] = useState(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const [traces, setTraces] = useState([]);
  const [activeTrace, setActiveTrace] = useState(null);
  
  // Tool state
  const [activeTool, setActiveTool] = useState(TOOLS.POINTER);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState(null);
  
  // Smart draw state
  const [smartDrawStart, setSmartDrawStart] = useState(null);
  const [smartDrawEnd, setSmartDrawEnd] = useState(null);
  
  // Selection box state
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState(null);
  const [selectionEnd, setSelectionEnd] = useState(null);
  const [selectedTraces, setSelectedTraces] = useState(new Set());
  const [selectedComponents, setSelectedComponents] = useState(new Set());
  
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    targetId: null,
    targetTraceId: null,
  });
  
  // History state for undo/redo
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  const contextMenuRef = useRef(null);

  // Smart draw pathfinding algorithm
  const createSmartTrace = (start, end) => {
    const startGrid = worldToGrid(start.wx, start.wy);
    const endGrid = worldToGrid(end.wx, end.wy);
    
    // Simple L-shaped path with 90-degree turns
    const points = [startGrid];
    
    // Determine if we should go horizontal first or vertical first
    const dx = Math.abs(endGrid.gx - startGrid.gx);
    const dy = Math.abs(endGrid.gy - startGrid.gy);
    
    // Go horizontal first if horizontal distance is greater
    if (dx >= dy) {
      // Horizontal then vertical
      if (endGrid.gx !== startGrid.gx) {
        points.push({ gx: endGrid.gx, gy: startGrid.gy });
      }
      points.push(endGrid);
    } else {
      // Vertical then horizontal
      if (endGrid.gy !== startGrid.gy) {
        points.push({ gx: startGrid.gx, gy: endGrid.gy });
      }
      points.push(endGrid);
    }
    
    return points;
  };

  // Save state to history
  const saveToHistory = (newPlaced, newTraces) => {
    const state = {
      placed: newPlaced || placed,
      traces: newTraces || traces,
      timestamp: Date.now()
    };
    
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(state);
      return newHistory.slice(-50);
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  };

  // Undo functionality
  const undo = () => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      setPlaced(prevState.placed);
      setTraces(prevState.traces);
      setHistoryIndex(historyIndex - 1);
      clearSelection();
    }
  };

  // Redo functionality
  const redo = () => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setPlaced(nextState.placed);
      setTraces(nextState.traces);
      setHistoryIndex(historyIndex + 1);
      clearSelection();
    }
  };

  // Helper function to check if a point is inside a rectangle
  const pointInRect = (px, py, rx, ry, rw, rh) => {
    return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
  };

  // Helper function to check if a trace intersects with selection rectangle
  const traceIntersectsRect = (trace, rect) => {
    const { x, y, width, height } = rect;
    return trace.points.some(pt => {
      const worldPt = gridToWorld(pt);
      return pointInRect(worldPt.x, worldPt.y, x, y, width, height);
    });
  };

  // Helper function to check if a component intersects with selection rectangle
  const componentIntersectsRect = (component, rect) => {
    const compLeft = component.x - component.width / 2;
    const compTop = component.y - component.height / 2;
    const compRight = compLeft + component.width;
    const compBottom = compTop + component.height;
    
    const rectRight = rect.x + rect.width;
    const rectBottom = rect.y + rect.height;
    
    return !(compRight < rect.x || compLeft > rectRight || 
             compBottom < rect.y || compTop > rectBottom);
  };

  // Update selection based on current selection box
  const updateSelection = () => {
    if (!selectionStart || !selectionEnd) return;
    
    const startWorld = toWorld(selectionStart.x, selectionStart.y);
    const endWorld = toWorld(selectionEnd.x, selectionEnd.y);
    
    const selectionRect = {
      x: Math.min(startWorld.wx, endWorld.wx),
      y: Math.min(startWorld.wy, endWorld.wy),
      width: Math.abs(endWorld.wx - startWorld.wx),
      height: Math.abs(endWorld.wy - startWorld.wy)
    };
    
    const newSelectedTraces = new Set();
    traces.forEach(trace => {
      if (traceIntersectsRect(trace, selectionRect)) {
        newSelectedTraces.add(trace.id);
      }
    });
    
    const newSelectedComponents = new Set();
    placed.forEach(component => {
      if (componentIntersectsRect(component, selectionRect)) {
        newSelectedComponents.add(component.id);
      }
    });
    
    setSelectedTraces(newSelectedTraces);
    setSelectedComponents(newSelectedComponents);
  };

  // Delete selected items
  const deleteSelected = () => {
    if (selectedTraces.size > 0) {
      setTraces(prev => prev.filter(trace => !selectedTraces.has(trace.id)));
    }
    if (selectedComponents.size > 0) {
      setPlaced(prev => prev.filter(component => !selectedComponents.has(component.id)));
    }
    
    setTimeout(() => saveToHistory(), 0);
    clearSelection();
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedTraces(new Set());
    setSelectedComponents(new Set());
  };

  // Add trace deletion to context menu
  const deleteTrace = () => {
    if (!contextMenu.targetTraceId) return;
    setTraces(prev => prev.filter(t => t.id !== contextMenu.targetTraceId));
    setContextMenu({ visible: false, x: 0, y: 0, targetId: null, targetTraceId: null });
    setTimeout(() => saveToHistory(), 0);
  };

  // Event listeners
  useEffect(() => {
    const handler = (e) => setSelectedColor(e?.detail || "#00e676");
    window.addEventListener("trace-color-changed", handler);
    return () => window.removeEventListener("trace-color-changed", handler);
  }, []);

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

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === "Space" && activeTool !== TOOLS.PAN) {
        e.preventDefault();
        setIsPanning(true);
        setContextMenu((c) => (c.visible ? { ...c, visible: false } : c));
      } else if (e.code === "Escape") {
        setContextMenu((c) => (c.visible ? { ...c, visible: false } : c));
        if (isDrawing) {
          setActiveTrace(null);
          setIsDrawing(false);
        }
        if (isSelecting) {
          setIsSelecting(false);
          setSelectionStart(null);
          setSelectionEnd(null);
        }
        if (smartDrawStart) {
          setSmartDrawStart(null);
          setSmartDrawEnd(null);
        }
        clearSelection();
        setResizingId(null);
      } else if (e.code === "Delete" || e.code === "Backspace") {
        if (selectedTraces.size > 0 || selectedComponents.size > 0) {
          e.preventDefault();
          deleteSelected();
        }
      } else if (e.ctrlKey && e.key === "a") {
        e.preventDefault();
        setSelectedTraces(new Set(traces.map(t => t.id)));
        setSelectedComponents(new Set(placed.map(c => c.id)));
      } else if (e.ctrlKey && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey && e.key === "y") || (e.ctrlKey && e.shiftKey && e.key === "Z")) {
        e.preventDefault();
        redo();
      } else if (contextMenu.targetId && e.shiftKey) {
        if (e.key === "+") {
          e.preventDefault();
          resizeComponent(contextMenu.targetId, SIZE_INCREMENT);
        } else if (e.key === "-") {
          e.preventDefault();
          resizeComponent(contextMenu.targetId, -SIZE_INCREMENT);
        }
      }
      
      // Tool shortcuts
      if (!e.ctrlKey && !e.altKey && !e.metaKey) {
        switch(e.key.toLowerCase()) {
          case 'p':
            setActiveTool(TOOLS.PAN);
            break;
          case 'v':
            setActiveTool(TOOLS.POINTER);
            break;
          case 's':
            setActiveTool(TOOLS.SELECT);
            break;
          case 'd':
            setActiveTool(TOOLS.DRAW);
            break;
          case 'w':
            setActiveTool(TOOLS.SMART_DRAW);
            break;
        }
      }
    };
    
    const handleKeyUp = (e) => {
      if (e.code === "Space" && activeTool !== TOOLS.PAN) {
        setIsPanning(false);
        setPanStart(null);
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isDrawing, contextMenu.targetId, selectedTraces, selectedComponents, traces, placed, isSelecting, activeTool, smartDrawStart]);

  useEffect(() => {
    const handleDocMouseDown = (e) => {
      if (!contextMenu.visible) return;
      if (contextMenuRef.current?.contains(e.target)) return;
      setContextMenu((c) => ({ ...c, visible: false }));
    };
    window.addEventListener("mousedown", handleDocMouseDown);
    return () => window.removeEventListener("mousedown", handleDocMouseDown);
  }, [contextMenu.visible]);

  useEffect(() => {
    if (isSelecting) {
      updateSelection();
    }
  }, [selectionEnd, isSelecting]);

  // Coordinate helpers
  const toLocal = (e) => {
    const rect = hostRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const toWorld = (x, y) => ({
    wx: (x - offset.x) / scale,
    wy: (y - offset.y) / scale
  });

  const snapWorld = (v) => Math.round(v / GRID_SIZE) * GRID_SIZE;

  const worldToGrid = (wx, wy) => ({
    gx: Math.round(wx / GRID_SIZE),
    gy: Math.round(wy / GRID_SIZE)
  });

  const gridToWorld = ({ gx, gy }) => ({
    x: gx * GRID_SIZE,
    y: gy * GRID_SIZE
  });

  // Infinite canvas dimensions
  const worldW = Math.max(size.w * 5, VIRTUAL_WORLD_MIN);
  const worldH = Math.max(size.h * 5, VIRTUAL_WORLD_MIN);

  // Component resizing
  const resizeComponent = (id, delta) => {
    setPlaced(prev => prev.map(item => {
      if (item.id === id) {
        const newWidth = Math.min(
          Math.max(item.width + delta, MIN_COMPONENT_SIZE),
          MAX_COMPONENT_SIZE
        );
        const newHeight = Math.min(
          Math.max(item.height + delta, MIN_COMPONENT_SIZE),
          MAX_COMPONENT_SIZE
        );
        return { ...item, width: newWidth, height: newHeight };
      }
      return item;
    }));
  };

  // Event handlers
  const onDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const onDrop = (e) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData("application/reactflow") || e.dataTransfer.getData("text/plain");
    if (!raw) return;

    let part = {};
    try {
      part = JSON.parse(raw);
    } catch {
      part = { id: uid(), name: "part", image: raw };
    }

    const { x: lx, y: ly } = toLocal(e);
    const { wx, wy } = toWorld(lx, ly);
    const sx = snapWorld(wx);
    const sy = snapWorld(wy);

    setPlaced((p) => [
      ...p,
      {
        id: uid(),
        type: part.id || "part",
        name: part.name || "Part",
        img: part.image || part.img || "",
        x: sx,
        y: sy,
        width: 1080,
        height: 1080
      }
    ]);
    
    setTimeout(() => saveToHistory(), 0);
  };

  const onItemMouseDown = (e, id) => {
    // Only allow component interaction with pointer tool or when not using drawing tools
    if (activeTool === TOOLS.DRAW || activeTool === TOOLS.SMART_DRAW) return;
    if (activeTool === TOOLS.PAN || isPanning || isSelecting) return;
    
    e.stopPropagation();
    setContextMenu((c) => (c.visible ? { ...c, visible: false } : c));

    const item = placed.find((p) => p.id === id);
    if (!item) return;

    // For pointer tool, also select the component
    if (activeTool === TOOLS.POINTER) {
      clearSelection();
      setContextMenu((c) => ({ ...c, targetId: id, targetTraceId: null }));
    }

    const { x: lx, y: ly } = toLocal(e);
    const { wx, wy } = toWorld(lx, ly);
    setDraggingId(id);
    dragOffset.current = { x: wx - item.x, y: wy - item.y };
  };

  const onItemContextMenu = (e, id) => {
    // Disable context menu for drawing tools
    if (activeTool === TOOLS.DRAW || activeTool === TOOLS.SMART_DRAW) return;
    
    e.preventDefault();
    e.stopPropagation();
    const rect = hostRef.current.getBoundingClientRect();
    setContextMenu({
      visible: true,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      targetId: id,
      targetTraceId: null
    });
  };

  const onSectionContextMenu = (e) => {
    e.preventDefault();
    const { x: lx, y: ly } = toLocal(e);
    const { wx, wy } = toWorld(lx, ly);
    
    const clickedTrace = traces.find(trace => {
      return trace.points.some(pt => {
        const { x, y } = gridToWorld(pt);
        return Math.abs(x - wx) < 5 && Math.abs(y - wy) < 5;
      });
    });

    if (clickedTrace) {
      const rect = hostRef.current.getBoundingClientRect();
      setContextMenu({
        visible: true,
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        targetTraceId: clickedTrace.id,
        targetId: null
      });
    } else if (selectedTraces.size > 0 || selectedComponents.size > 0) {
      const rect = hostRef.current.getBoundingClientRect();
      setContextMenu({
        visible: true,
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        targetTraceId: null,
        targetId: null
      });
    }
  };

  const deleteContextTarget = () => {
    if (!contextMenu.targetId) return;
    setPlaced((p) => p.filter((it) => it.id !== contextMenu.targetId));
    setContextMenu({ visible: false, x: 0, y: 0, targetId: null, targetTraceId: null });
    setDraggingId((d) => (d === contextMenu.targetId ? null : d));
    setTimeout(() => saveToHistory(), 0);
  };

  const onSectionMouseDown = (e) => {
    setContextMenu((c) => (c.visible ? { ...c, visible: false } : c));

    const { x: lx, y: ly } = toLocal(e);
    const { wx, wy } = toWorld(lx, ly);

    // Pan tool or space key panning
    if (activeTool === TOOLS.PAN || isPanning) {
      setPanStart({
        x: e.clientX,
        y: e.clientY,
        offsetX: offset.x,
        offsetY: offset.y
      });
      return;
    }

    // Pointer tool - just clears selection and allows component interaction
    if (activeTool === TOOLS.POINTER) {
      if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
        clearSelection();
        setContextMenu((c) => ({ ...c, targetId: null, targetTraceId: null }));
      }
      return;
    }

    // Selection tool
    if (activeTool === TOOLS.SELECT) {
      e.preventDefault();
      clearSelection();
      setSelectionStart({ x: lx, y: ly });
      setSelectionEnd({ x: lx, y: ly });
      setIsSelecting(true);
      setContextMenu((c) => ({ ...c, targetId: null, targetTraceId: null }));
      return;
    }

    // Draw tool
    if (activeTool === TOOLS.DRAW) {
      e.preventDefault();
      const gp = worldToGrid(wx, wy);
      setActiveTrace({ id: uid(), points: [gp], color: selectedColor });
      setIsDrawing(true);
      return;
    }

    // Smart draw tool
    if (activeTool === TOOLS.SMART_DRAW) {
      e.preventDefault();
      if (!smartDrawStart) {
        setSmartDrawStart({ wx, wy, x: lx, y: ly });
      } else {
        setSmartDrawEnd({ wx, wy, x: lx, y: ly });
        
        // Create smart trace
        const tracePoints = createSmartTrace(smartDrawStart, { wx, wy });
        const newTrace = {
          id: uid(),
          points: tracePoints,
          color: selectedColor
        };
        
        setTraces(prev => [...prev, newTrace]);
        setTimeout(() => saveToHistory(), 0);
        
        setSmartDrawStart(null);
        setSmartDrawEnd(null);
      }
      return;
    }

    // Clear selection when clicking on empty canvas (only for pointer tool)
    if (activeTool === TOOLS.POINTER && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      clearSelection();
      setContextMenu((c) => ({ ...c, targetId: null, targetTraceId: null }));
    }
  };

  const onMouseMove = (e) => {
    if (resizingId) {
      const { x: lx, y: ly } = toLocal(e);
      const { wx, wy } = toWorld(lx, ly);
      const component = placed.find(c => c.id === resizingId);
      
      if (component) {
        const dx = Math.abs(wx - component.x) * 2;
        const newSize = Math.max(
          MIN_COMPONENT_SIZE, 
          Math.min(MAX_COMPONENT_SIZE, dx)
        );
        
        setPlaced(prev =>
          prev.map(c =>
            c.id === resizingId
              ? { ...c, width: newSize, height: newSize }
              : c
          )
        );
      }
      return;
    }

    if (isSelecting) {
      const { x: lx, y: ly } = toLocal(e);
      setSelectionEnd({ x: lx, y: ly });
      return;
    }

    if ((activeTool === TOOLS.PAN || isPanning) && panStart) {
      const dx = (e.clientX - panStart.x) / scale;
      const dy = (e.clientY - panStart.y) / scale;
      setOffset({
        x: panStart.offsetX + dx,
        y: panStart.offsetY + dy
      });
      return;
    }

    if (isDrawing && activeTrace && activeTool === TOOLS.DRAW) {
      const { x: lx, y: ly } = toLocal(e);
      const { wx, wy } = toWorld(lx, ly);
      const gp = worldToGrid(wx, wy);

      setActiveTrace((prev) => {
        const pts = prev.points;
        const last = pts[pts.length - 1];
        if (!last || last.gx !== gp.gx || last.gy !== gp.gy) {
          return { ...prev, points: [...pts, gp] };
        }
        return prev;
      });
      return;
    }

    if (!draggingId) return;
    const { x: lx, y: ly } = toLocal(e);
    const { wx, wy } = toWorld(lx, ly);
    const nx = snapWorld(wx - dragOffset.current.x);
    const ny = snapWorld(wy - dragOffset.current.y);

    setPlaced((prev) =>
      prev.map((p) => (p.id === draggingId ? { ...p, x: nx, y: ny } : p))
    );
  };

  const onMouseUp = () => {
    setResizingId(null);
    if (panStart) setPanStart(null);
    
    if (isSelecting) {
      setIsSelecting(false);
      setSelectionStart(null);
      setSelectionEnd(null);
    }
    
    if (isDrawing && activeTrace) {
      if (activeTrace.points.length > 1) {
        setTraces((prev) => [...prev, activeTrace]);
        setTimeout(() => saveToHistory(), 0);
      }
      setActiveTrace(null);
      setIsDrawing(false);
    }
    setDraggingId(null);
  };

  const onWheel = (e) => {
    e.preventDefault();
    const delta = -e.deltaY / 500;
    setScale((prev) => Math.min(Math.max(prev + delta, 0.3), 2));
  };

  // Get cursor based on active tool
  const getCursor = () => {
    if (resizingId) return "nwse-resize";
    if (panStart) return "grabbing";
    if (activeTool === TOOLS.PAN || isPanning) return "grab";
    if (activeTool === TOOLS.SELECT && isSelecting) return "crosshair";
    if (activeTool === TOOLS.DRAW && (isDrawing || !smartDrawStart)) return "crosshair";
    if (activeTool === TOOLS.SMART_DRAW) return smartDrawStart ? "crosshair" : "cell";
    if (activeTool === TOOLS.POINTER) return "default";
    if (draggingId) return "grabbing";
    return "default";
  };

  // Styles
  const sectionGridStyle = {
    backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.12) ${DOT_RADIUS}px, transparent ${DOT_RADIUS + 0.5}px)`,
    backgroundSize: `${GRID_SIZE * scale * 2}px ${GRID_SIZE * scale * 2}px`,
    backgroundPosition: `${offset.x}px ${offset.y}px`,
    backgroundRepeat: "repeat",
    backgroundColor: isDrawing ? 'rgba(0,0,0,0.02)' : 'transparent',
    transition: 'background 0.2s ease'
  };

  const worldStyle = {
    position: "absolute",
    left: `${offset.x}px`,
    top: `${offset.y}px`,
    width: `${worldW}px`,
    height: `${worldH}px`,
    transform: `scale(${scale})`,
    transformOrigin: "0 0"
  };

  // Render selection box
  const renderSelectionBox = () => {
    if (!isSelecting || !selectionStart || !selectionEnd) return null;
    
    const left = Math.min(selectionStart.x, selectionEnd.x);
    const top = Math.min(selectionStart.y, selectionEnd.y);
    const width = Math.abs(selectionEnd.x - selectionStart.x);
    const height = Math.abs(selectionEnd.y - selectionStart.y);
    
    return (
      <div
        style={{
          position: "absolute",
          left: `${left}px`,
          top: `${top}px`,
          width: `${width}px`,
          height: `${height}px`,
          border: "1px dashed #60a5fa",
          backgroundColor: "rgba(96, 165, 250, 0.1)",
          zIndex: 10,
          pointerEvents: "none"
        }}
      />
    );
  };

  // Render smart draw preview
  const renderSmartDrawPreview = () => {
    if (!smartDrawStart) return null;
    
    const startWorld = gridToWorld(worldToGrid(smartDrawStart.wx, smartDrawStart.wy));
    
    return (
      <circle
        cx={startWorld.x}
        cy={startWorld.y}
        r="4"
        fill="#60a5fa"
        stroke="#fff"
        strokeWidth="2"
      />
    );
  };

  // Component rendering with selection highlight
  const renderComponent = (c) => {
    const isSelected = selectedComponents.has(c.id) || contextMenu.targetId === c.id;
    
    return (
      <div
        key={c.id}
        style={{
          position: "absolute",
          left: `${c.x}px`,
          top: `${c.y}px`,
          transform: 'translate(-50%, -50%)',
          zIndex: 3,
          userSelect: "none",
          pointerEvents: (activeTool === TOOLS.DRAW || activeTool === TOOLS.SMART_DRAW) ? "none" : "auto"
        }}
        onMouseDown={(e) => onItemMouseDown(e, c.id)}
        onContextMenu={(e) => onItemContextMenu(e, c.id)}
      >
        <img
          src={c.img}
          alt={c.name}
          draggable={false}
          style={{
            width: `${c.width}px`,
            height: `${c.height}px`,
            pointerEvents: "none",
            border: isSelected ? "2px solid #60a5fa" : "none",
            borderRadius: 4,
            boxShadow: isSelected ? "0 0 0 2px rgba(96, 165, 250, 0.3)" : "none"
          }}
        />
      </div>
    );
  };

  // Render toolbar
  const renderToolbar = () => {
    const toolButtons = [
      { id: TOOLS.PAN, icon: '✋', label: 'Pan', shortcut: 'P' },
      { id: TOOLS.POINTER, icon: '👆', label: 'Pointer', shortcut: 'V' },
      { id: TOOLS.SELECT, icon: '⬚', label: 'Select Box', shortcut: 'S' },
      { id: TOOLS.DRAW, icon: '✏️', label: 'Draw', shortcut: 'D' },
      { id: TOOLS.SMART_DRAW, icon: '🪄', label: 'Smart Draw', shortcut: 'W' }
    ];
    
    return (
      <div style={{
        position: "absolute",
        top: "50%",
        left: 20,
        transform: "translateY(-50%)",
        zIndex: 5,
        background: "rgba(17, 7, 36, 0.95)",
        backdropFilter: "blur(10px)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 12,
        padding: 8,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        boxShadow: "0 8px 32px rgba(0,0,0,0.3)"
      }}>
        {toolButtons.map(tool => (
          <button
            key={tool.id}
            onClick={(e) => {
              e.stopPropagation();
              setActiveTool(tool.id);
            }}
            title={`${tool.label} (${tool.shortcut})`}
            style={{
              width: 48,
              height: 48,
              border: activeTool === tool.id ? "2px solid #60a5fa" : "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              background: activeTool === tool.id ? "rgba(96, 165, 250, 0.2)" : "transparent",
              color: "#fff",
              fontSize: 16,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s ease"
            }}
          >
            {tool.icon}
          </button>
        ))}
      </div>
    );
  };

  // Render undo/redo buttons
  const renderUndoRedoButtons = () => {
    const canUndo = historyIndex > 0;
    const canRedo = historyIndex < history.length - 1;
    
    return (
      <div style={{
        position: "absolute",
        bottom: 16,
        right: 16,
        zIndex: 4,
        display: "flex",
        gap: "8px"
      }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            undo();
          }}
          onMouseDown={(e) => e.stopPropagation()}
          disabled={!canUndo}
          style={{
            background: canUndo ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.3)",
            color: canUndo ? "#fff" : "#666",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: "6px",
            padding: "8px 12px",
            cursor: canUndo ? "pointer" : "not-allowed",
            fontSize: "12px",
            userSelect: "none",
            pointerEvents: "auto"
          }}
          title="Undo (Ctrl+Z)"
        >
          ↶ Undo
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            redo();
          }}
          onMouseDown={(e) => e.stopPropagation()}
          disabled={!canRedo}
          style={{
            background: canRedo ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.3)",
            color: canRedo ? "#fff" : "#666",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: "6px",
            padding: "8px 12px",
            cursor: canRedo ? "pointer" : "not-allowed",
            fontSize: "12px",
            userSelect: "none",
            pointerEvents: "auto"
          }}
          title="Redo (Ctrl+Y)"
        >
          ↷ Redo
        </button>
      </div>
    );
  };

  // Trace component with selection highlight
  const Trace = ({ trace, isActive = false }) => {
    const isSelected = selectedTraces.has(trace.id);
    
    return (
      <polyline
        points={trace.points.map(pt => {
          const { x, y } = gridToWorld(pt);
          return `${x},${y}`;
        }).join(" ")}
        fill="none"
        stroke={isSelected ? "#60a5fa" : trace.color}
        strokeWidth={isActive ? 2 : (isSelected ? TRACE_WIDTH + 2 : TRACE_WIDTH)}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={isSelected ? 0.8 : 1}
      />
    );
  };

  // Updated context menu
  const renderContextMenu = () => {
    if (!contextMenu.visible) return null;
    
    const hasSelectedItems = selectedTraces.size > 0 || selectedComponents.size > 0;
    
    return (
      <div
        ref={contextMenuRef}
        style={{
          position: "absolute",
          left: contextMenu.x,
          top: contextMenu.y,
          zIndex: 9999,
          background: "#110724ff",
          border: "1px solid rgba(0,0,0,0.12)",
          boxShadow: "0 6px 18px rgba(0,0,0,0.12)",
          borderRadius: 4,
          minWidth: 160,
          overflow: "hidden",
          userSelect: "none",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {contextMenu.targetTraceId ? (
          <>
            <div style={{ padding: "8px 12px", borderBottom: "1px solid rgba(0,0,0,0.06)", fontSize: 13 }}>
              Trace Options
            </div>
            <div
              onClick={(e) => {
                e.stopPropagation();
                deleteTrace();
              }}
              style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13, color: "#ef4444" }}
            >
              Delete Trace
            </div>
          </>
        ) : contextMenu.targetId ? (
          <>
            <div style={{ padding: "8px 12px", borderBottom: "1px solid rgba(0,0,0,0.06)", fontSize: 13 }}>
              Component Options
            </div>
            <div
              onClick={(e) => {
                e.stopPropagation();
                deleteContextTarget();
              }}
              style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13, color: "#ef4444" }}
            >
              Delete Component
            </div>
            <div style={{ padding: "6px 12px", fontSize: 12, color: "#9ca3af" }}>
              Resize:
            </div>
            <div
              onClick={(e) => {
                e.stopPropagation();
                resizeComponent(contextMenu.targetId, SIZE_INCREMENT);
              }}
              style={{ padding: "6px 12px", cursor: "pointer", fontSize: 13 }}
            >
              Increase Size (Shift++)
            </div>
            <div
              onClick={(e) => {
                e.stopPropagation();
                resizeComponent(contextMenu.targetId, -SIZE_INCREMENT);
              }}
              style={{ padding: "6px 12px", cursor: "pointer", fontSize: 13 }}
            >
              Decrease Size (Shift+-)
            </div>
          </>
        ) : hasSelectedItems ? (
          <>
            <div style={{ padding: "8px 12px", borderBottom: "1px solid rgba(0,0,0,0.06)", fontSize: 13 }}>
              Selection ({selectedTraces.size + selectedComponents.size} items)
            </div>
            <div
              onClick={(e) => {
                e.stopPropagation();
                deleteSelected();
              }}
              style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13, color: "#ef4444" }}
            >
              Delete Selected
            </div>
            <div
              onClick={(e) => {
                e.stopPropagation();
                clearSelection();
              }}
              style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13 }}
            >
              Clear Selection
            </div>
          </>
        ) : null}
      </div>
    );
  };

  return (
    <section
      className="canvas"
      ref={hostRef}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onWheel={onWheel}
      onMouseDown={onSectionMouseDown}
      onContextMenu={onSectionContextMenu}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      style={{
        position: "relative",
        overflow: "hidden",
        ...sectionGridStyle,
        cursor: getCursor(),
        width: "100%",
        height: "100%"
      }}
    >
      <div style={worldStyle}>
        <svg
          width="100%"
          height="100%"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            zIndex: 2,
            pointerEvents: isDrawing ? 'auto' : 'none',
            overflow: 'visible'
          }}
        >
          {traces.map((t) => <Trace key={t.id} trace={t} />)}
          {isDrawing && activeTrace && <Trace trace={activeTrace} isActive />}
          {renderSmartDrawPreview()}
        </svg>

        {placed.map(renderComponent)}
      </div>

      {renderSelectionBox()}
      {renderToolbar()}
      {renderContextMenu()}
      {renderUndoRedoButtons()}

      <div style={{
        position: "absolute",
        top: 8,
        left: 8,
        zIndex: 4,
        color: "#fff",
        pointerEvents: "none",
        background: "rgba(0,0,0,0.5)",
        padding: "4px 8px",
        borderRadius: 4
      }}>
        Active Tool: {activeTool.toUpperCase()} • Space for temporary pan • Keys: P/V/S/D/W for tools
      </div>

      {(selectedTraces.size > 0 || selectedComponents.size > 0) && (
        <div style={{
          position: "absolute",
          top: 8,
          right: 8,
          zIndex: 4,
          color: "#60a5fa",
          pointerEvents: "none",
          background: "rgba(0,0,0,0.7)",
          padding: "4px 8px",
          borderRadius: 4,
          fontSize: 12
        }}>
          Selected: {selectedTraces.size} traces, {selectedComponents.size} components
        </div>
      )}
    </section>
  );
}