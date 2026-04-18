import React, { useState, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";

export const MapVisualizationSection = (): JSX.Element => {
  // State for drag functionality
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const mapRef = useRef<HTMLDivElement>(null);

  // Handle mouse down for drag start
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  }, [position]);

  // Handle mouse move for dragging
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  }, [isDragging, dragStart]);

  // Handle mouse up to end drag
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handle wheel for zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY * -0.01;
    const newScale = Math.min(Math.max(0.5, scale + delta), 3);
    setScale(newScale);
  }, [scale]);

  // Reset map position and zoom
  const resetMap = () => {
    setPosition({ x: 0, y: 0 });
    setScale(1);
  };

  return (
    <div 
      className="relative w-full h-[965px] bg-[#1b1e26] overflow-hidden cursor-grab active:cursor-grabbing"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      ref={mapRef}
    >
      {/* Draggable Map Container */}
      <div
        className="transition-transform duration-100"
        style={{
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          transformOrigin: 'center'
        }}
      >
        {/* US Map Background */}
        <img
          className="w-full h-full object-contain object-center select-none"
          alt="United States map"
          src="/figmaAssets/united-states.png"
          draggable={false}
        />
      </div>

      {/* Map Controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-10 mb-[280px]">
        <button
          onClick={resetMap}
          className="px-4 py-2 bg-black bg-opacity-80 text-white rounded-lg border border-gray-600 hover:bg-opacity-90 transition-all duration-200 shadow-xl"
        >
          Reset View
        </button>
        <div className="bg-black bg-opacity-80 p-3 rounded-lg border border-gray-600 shadow-xl">
          <p className="text-white text-sm font-medium">Zoom: {Math.round(scale * 100)}%</p>
          <p className="text-gray-300 text-xs mt-1">Scroll to zoom</p>
          <p className="text-gray-300 text-xs">Drag to pan</p>
        </div>
      </div>

      {/* Interactive Map Legend */}
      <div className="absolute bottom-4 right-4 bg-black bg-opacity-80 p-5 rounded-xl border border-gray-600 shadow-2xl">
        <h3 className="text-white font-bold mb-3 text-lg">Interactive US Map</h3>
        <div className="space-y-2 text-sm text-white">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded"></div>
            <span>Drag to move map</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span>Scroll to zoom</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-purple-500 rounded"></div>
            <span>Click reset to center</span>
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-gray-600">
          <p className="text-gray-300 text-xs">Explore the United States</p>
          <p className="text-gray-300 text-xs">Pan and zoom for details</p>
        </div>
      </div>
    </div>
  );
};