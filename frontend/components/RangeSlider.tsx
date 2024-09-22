import React, { useState, useRef, useEffect } from "react";
import "./RangeSlider.css";

interface RangeSliderProps {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  showLabel?: boolean;
}

const RangeSlider: React.FC<RangeSliderProps> = ({
  value,
  min,
  max,
  step,
  onChange,
  showLabel = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    updateValue(e.clientX);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    updateValue(e.touches[0].clientX);
  };

  const handleMouseUp = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleTouchEnd = (e: TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleMouseMove = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isDragging) {
      updateValue(e.clientX);
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isDragging) {
      updateValue(e.touches[0].clientX);
    }
  };

  const updateValue = (clientX: number) => {
    if (sliderRef.current) {
      const rect = sliderRef.current.getBoundingClientRect();
      const percentage = (clientX - rect.left) / rect.width;
      const rawValue = percentage * (max - min) + min;
      const steppedValue = Math.round(rawValue / step) * step;
      const newValue = Math.max(min, Math.min(max, steppedValue));
      onChange(Number(newValue.toFixed(getDecimalPlaces(step))));
    }
  };

  const getDecimalPlaces = (num: number): number => {
    if (Math.floor(num) === num) return 0;
    return num.toString().split(".")[1].length || 0;
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      window.addEventListener("touchmove", handleTouchMove);
      window.addEventListener("touchend", handleTouchEnd);
    } else {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isDragging]);

  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className="range-slider-container">
      <div
        className="range-slider"
        ref={sliderRef}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        <div className="range-slider-track">
          <div
            className="range-slider-fill"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <div
          className="range-slider-thumb"
          style={{ left: `${percentage}%` }}
        />
      </div>
      {showLabel && <div className="range-slider-label">{value}</div>}
    </div>
  );
};

export default RangeSlider;
