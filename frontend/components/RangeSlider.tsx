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
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [tempLabelValue, setTempLabelValue] = useState<string>("");

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

  const clampAndSnap = (raw: number): number => {
    const clamped = Math.max(min, Math.min(max, raw));
    const stepsFromMin = Math.round((clamped - min) / step);
    const snapped = min + stepsFromMin * step;
    return Number(snapped.toFixed(getDecimalPlaces(step)));
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
      {showLabel && (
        <div className="range-slider-label">
          {!isEditingLabel ? (
            <button
              className="range-slider-label-button"
              onClick={() => {
                setTempLabelValue(String(value));
                setIsEditingLabel(true);
              }}
              title="Click to edit value"
            >
              {value}
            </button>
          ) : (
            <input
              className="range-slider-input"
              type="number"
              inputMode="decimal"
              step={step}
              min={min}
              max={max}
              value={tempLabelValue}
              autoFocus
              onChange={(e) => setTempLabelValue(e.target.value)}
              onBlur={() => {
                const parsed = parseFloat(tempLabelValue);
                if (!isNaN(parsed)) {
                  onChange(clampAndSnap(parsed));
                }
                setIsEditingLabel(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const parsed = parseFloat(tempLabelValue);
                  if (!isNaN(parsed)) {
                    onChange(clampAndSnap(parsed));
                  }
                  setIsEditingLabel(false);
                }
                if (e.key === "Escape") {
                  setIsEditingLabel(false);
                }
              }}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default RangeSlider;
