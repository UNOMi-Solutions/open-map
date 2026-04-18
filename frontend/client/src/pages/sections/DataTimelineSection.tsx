import React, { useState, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";

export const DataTimelineSection = (): JSX.Element => {
  // State for drag functionality
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [currentYear, setCurrentYear] = useState(2025);
  const [sliderPosition, setSliderPosition] = useState(100); // Start at 2025 (rightmost)
  const timelineRef = useRef<HTMLDivElement>(null);

  // Timeline markers positions - matching Figma layout
  const timelineMarkers = [
    { position: 5 },   // ~2015
    { position: 20 },  // ~2017
    { position: 35 },  // ~2019
    { position: 50 },  // ~2021
    { position: 65 },  // ~2022
    { position: 80 },  // ~2024
    { position: 90 },  // ~2025
  ];

  // Handle mouse down for drag start
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.timeline-clickable')) return; // Don't drag when clicking timeline
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

  // Handle timeline click
  const handleTimelineClick = useCallback((e: React.MouseEvent) => {
    if (!timelineRef.current) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left - 47; // Account for left padding
    const timelineWidth = rect.width - 94; // Account for padding on both sides
    const percentage = Math.max(0, Math.min(100, (clickX / timelineWidth) * 100));
    
    setSliderPosition(percentage);
    // Convert percentage to year (2015-2025)
    const year = Math.round(2015 + (percentage / 100) * 10);
    setCurrentYear(Math.min(2025, Math.max(2015, year)));
  }, []);

  // Reset timeline position
  const resetPosition = () => {
    setPosition({ x: 0, y: 0 });
  };

  return (
    <div className="w-full pl-[444px]"> {/* Account for sidebar width */}
      <div
        className={`relative transition-transform duration-100 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{
          transform: `translate(${position.x}px, ${position.y}px)`,
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <Card className="relative w-full h-[123px] mx-auto rounded-[29px] bg-[#06012a] border border-solid border-[#736bd6] opacity-[0.64]">
          <CardContent className="p-0">
            {/* Timeline bar */}
            <div 
              ref={timelineRef}
              className="absolute w-[calc(100%-94px)] h-1 top-12 left-[47px] bg-[#d9d9d9] rounded-[5px] timeline-clickable cursor-pointer"
              onClick={handleTimelineClick}
            />

            {/* Timeline markers */}
            {timelineMarkers.map((marker, index) => (
              <div
                key={`marker-${index}`}
                className="absolute w-[3px] h-5 top-10 bg-[#d9d9d9] rounded-[5px]"
                style={{ left: `calc(47px + ${marker.position}% * (100% - 94px) / 100%)` }}
              />
            ))}

            {/* Active slider indicator */}
            <div 
              className="absolute top-10 transition-all duration-300 z-10"
              style={{ left: `calc(47px + ${sliderPosition}% * (100% - 94px) / 100% - 1.5px)` }}
            >
              <div className="w-[3px] h-5 bg-red-600 rounded-[5px]"></div>
            </div>

            {/* Year indicator */}
            <div 
              className="absolute top-[17px] text-sm font-normal text-white tracking-[0] leading-[normal] font-sans transition-all duration-300"
              style={{ left: `calc(47px + ${sliderPosition}% * (100% - 94px) / 100% - 15px)` }}
            >
              {currentYear}
            </div>

            {/* Triangle pointer */}
            <img
              className="absolute w-[29px] h-[25px] top-[54px] transition-all duration-300"
              style={{ left: `calc(47px + ${sliderPosition}% * (100% - 94px) / 100% - 14.5px)` }}
              alt="Pointer"
              src="/figmaAssets/polygon-2.svg"
            />

            {/* Timeline label */}
            <div className="absolute top-[85px] left-1/2 transform -translate-x-1/2 font-bold text-white text-[20.2px] tracking-[0] leading-[normal] whitespace-nowrap font-sans">
              Timeline
            </div>

            {/* Drag indicator (top right) */}
            <div className="absolute top-2 right-4 px-2 py-1 bg-black bg-opacity-50 text-white text-xs rounded border border-gray-600">
              Drag to Move
            </div>

            {/* Reset button (top left) */}
            <button
              onClick={resetPosition}
              className="absolute top-2 left-4 px-2 py-1 bg-black bg-opacity-50 text-white text-xs rounded border border-gray-600 hover:bg-opacity-70 transition-all duration-200"
            >
              Reset
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};