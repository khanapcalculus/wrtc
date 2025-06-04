import React, { useEffect, useRef, useState } from 'react';

const Toolbar = ({ 
  currentTool, 
  setCurrentTool, 
  currentColor, 
  setCurrentColor, 
  strokeWidth, 
  setStrokeWidth, 
  onClear 
}) => {
  const [colorExpanded, setColorExpanded] = useState(false);
  const [strokeExpanded, setStrokeExpanded] = useState(false);
  const toolbarRef = useRef(null);
  const colorButtonRef = useRef(null);
  const strokeButtonRef = useRef(null);

  // Close palettes when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (toolbarRef.current && !toolbarRef.current.contains(event.target)) {
        setColorExpanded(false);
        setStrokeExpanded(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // 16 colors for 4x4 grid
  const colors = [
    '#000000', '#FFFFFF', '#FF0000', '#00FF00',
    '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
    '#FFA500', '#800080', '#008000', '#808080',
    '#FFC0CB', '#A52A2A', '#FFD700', '#4B0082'
  ];

  // 16 stroke sizes for 4x4 grid  
  const strokeSizes = [1, 2, 3, 4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32];

  const handleColorSelect = (color) => {
    setCurrentColor(color);
    setColorExpanded(false);
  };

  const handleStrokeSelect = (size) => {
    setStrokeWidth(size);
    setStrokeExpanded(false);
  };

  const toggleColorPalette = () => {
    setStrokeExpanded(false);
    setColorExpanded(!colorExpanded);
  };

  const toggleStrokePalette = () => {
    setColorExpanded(false);
    setStrokeExpanded(!strokeExpanded);
  };

  return (
    <div ref={toolbarRef}>
      {/* Pen Tool */}
      <button
        className={`tool-btn ${currentTool === 'pen' ? 'active' : ''}`}
        onClick={() => setCurrentTool('pen')}
        title="Pen Tool"
      >
        ✏️
      </button>

      {/* Divider */}
      <div className="divider"></div>

      {/* Color Palette Button */}
      <div className="palette-container">
        <button
          className={`palette-btn color-palette-btn ${colorExpanded ? 'expanded' : ''}`}
          onClick={toggleColorPalette}
          title="Color Palette"
          ref={colorButtonRef}
        >
          <div 
            className="current-color"
            style={{ backgroundColor: currentColor }}
          />
        </button>

        {colorExpanded && (
          <div className="palette-grid color-grid-expanded">
            {colors.map(color => (
              <button
                key={color}
                className={`palette-item color-item ${currentColor === color ? 'active-item' : ''}`}
                style={{ backgroundColor: color }}
                onClick={() => handleColorSelect(color)}
                title={`Color: ${color}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="divider"></div>

      {/* Stroke Width Palette Button */}
      <div className="palette-container">
        <button
          className={`palette-btn stroke-palette-btn ${strokeExpanded ? 'expanded' : ''}`}
          onClick={toggleStrokePalette}
          title="Stroke Width"
          ref={strokeButtonRef}
        >
          <div 
            className="current-stroke"
            style={{ 
              width: `${Math.min(strokeWidth * 1.5, 20)}px`,
              height: `${Math.min(strokeWidth * 1.5, 20)}px`,
              backgroundColor: currentColor
            }}
          />
        </button>

        {strokeExpanded && (
          <div className="palette-grid stroke-grid-expanded">
            {strokeSizes.map(size => (
              <button
                key={size}
                className={`palette-item stroke-item ${strokeWidth === size ? 'active-item' : ''}`}
                onClick={() => handleStrokeSelect(size)}
                title={`Stroke: ${size}px`}
              >
                <div 
                  className="stroke-number"
                  style={{ 
                    color: currentColor
                  }}
                >
                  {size}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="divider"></div>

      {/* Clear Button */}
      <button
        className="clear-btn"
        onClick={onClear}
        title="Clear Page"
      >
        🗑️
      </button>
    </div>
  );
};

export default Toolbar; 