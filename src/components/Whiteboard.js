import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Layer, Line, Stage } from 'react-konva';
import Toolbar from './Toolbar';
// import PageManager from './PageManager';

const Whiteboard = ({ webrtcManager }) => {
  const [currentTool, setCurrentTool] = useState('pen');
  const [currentColor, setCurrentColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [drawingData, setDrawingData] = useState([[]]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState([]);
  const [liveStrokes, setLiveStrokes] = useState(new Map()); // Track live strokes from remote users
  const stageRef = useRef();

  const handleRemoteDrawing = useCallback((data) => {
    if (data.type === 'live-drawing') {
      // Update live stroke preview
      setLiveStrokes(prev => {
        const newMap = new Map(prev);
        newMap.set(data.strokeId, {
          points: data.points,
          color: data.color,
          strokeWidth: data.strokeWidth,
          page: data.page
        });
        return newMap;
      });
    } else if (data.type === 'drawing') {
      // Final stroke - remove from live strokes and add to permanent drawing data
      setLiveStrokes(prev => {
        const newMap = new Map(prev);
        // Remove any live strokes that might match this final stroke
        for (const [key, stroke] of newMap) {
          if (stroke.page === data.page) {
            newMap.delete(key);
          }
        }
        return newMap;
      });

      setDrawingData(prev => {
        const newData = [...prev];
        while (newData.length <= data.page) {
          newData.push([]);
        }
        newData[data.page] = [...newData[data.page], data.stroke];
        return newData;
      });
    } else if (data.type === 'clear') {
      // Clear live strokes for this page too
      setLiveStrokes(prev => {
        const newMap = new Map(prev);
        for (const [key, stroke] of newMap) {
          if (stroke.page === data.page) {
            newMap.delete(key);
          }
        }
        return newMap;
      });

      setDrawingData(prev => {
        const newData = [...prev];
        if (newData[data.page]) {
          newData[data.page] = [];
        }
        return newData;
      });
    } else if (data.type === 'pageChange') {
      setTotalPages(prev => Math.max(prev, data.totalPages));
    }
  }, []);

  // Set up WebRTC data handling
  useEffect(() => {
    if (webrtcManager) {
      webrtcManager.onDataReceived = handleRemoteDrawing;
    }
  }, [webrtcManager, handleRemoteDrawing]);

  const handleLocalDrawing = useCallback((stroke) => {
    if (webrtcManager) {
      webrtcManager.sendData({
        type: 'drawing',
        stroke: stroke,
        page: currentPage
      });
    }
    
    setDrawingData(prev => {
      const newData = [...prev];
      while (newData.length <= currentPage) {
        newData.push([]);
      }
      newData[currentPage] = [...newData[currentPage], stroke];
      return newData;
    });
  }, [webrtcManager, currentPage]);

  const handleClearPage = useCallback(() => {
    if (webrtcManager) {
      webrtcManager.sendData({
        type: 'clear',
        page: currentPage
      });
    }
    
    setDrawingData(prev => {
      const newData = [...prev];
      if (newData[currentPage]) {
        newData[currentPage] = [];
      }
      return newData;
    });
  }, [webrtcManager, currentPage]);

  // Page management functions
  const handlePageChange = useCallback((newPage) => {
    if (newPage >= 0 && newPage < totalPages) {
      setCurrentPage(newPage);
    }
  }, [totalPages]);

  const addNewPage = useCallback(() => {
    const newPageIndex = totalPages;
    setTotalPages(prev => prev + 1);
    setCurrentPage(newPageIndex);
    
    // Notify remote user about page change
    if (webrtcManager) {
      webrtcManager.sendData({
        type: 'pageChange',
        totalPages: totalPages + 1
      });
    }
  }, [totalPages, webrtcManager]);

  const handleMouseDown = useCallback((e) => {
    if (currentTool !== 'pen') return;
    
    // Prevent stage dragging
    e.target.getStage().draggable(false);
    
    setIsDrawing(true);
    const pos = e.target.getStage().getPointerPosition();
    setCurrentPath([pos.x, pos.y]);
  }, [currentTool]);

  const handleMouseMove = useCallback((e) => {
    if (!isDrawing || currentTool !== 'pen') return;

    // Prevent default touch behaviors
    e.evt?.preventDefault();
    
    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    
    // Capture all points for high fidelity (especially important for cursive/small writing)
    const newPath = [...currentPath, point.x, point.y];
    setCurrentPath(newPath);

    // Send live preview to remote user
    if (webrtcManager && newPath.length >= 4) { // Send every few points to avoid spam
      webrtcManager.sendData({
        type: 'live-drawing',
        points: newPath,
        color: currentColor,
        strokeWidth: strokeWidth,
        strokeId: `live-${Date.now()}`,
        page: currentPage
      });
    }
  }, [isDrawing, currentTool, currentPath, webrtcManager, currentColor, strokeWidth, currentPage]);

  const handleMouseUp = useCallback((e) => {
    if (!isDrawing || currentTool !== 'pen') {
      setIsDrawing(false);
      setCurrentPath([]);
      return;
    }

    // Prevent default touch behaviors
    e.evt?.preventDefault();

    // Allow shorter strokes for small text and dots
    if (currentPath.length >= 2) {
      const newStroke = {
        id: Date.now() + Math.random(),
        points: currentPath,
        color: currentColor,
        strokeWidth: strokeWidth,
        tool: currentTool,
        timestamp: Date.now()
      };

      handleLocalDrawing(newStroke);
    }
    
    setIsDrawing(false);
    setCurrentPath([]);
  }, [isDrawing, currentTool, currentPath, currentColor, strokeWidth, handleLocalDrawing]);

  // Combine drawing data with current drawing path
  const currentPageData = drawingData[currentPage] || [];
  const allLines = [
    ...currentPageData,
    ...(isDrawing && currentPath.length >= 2 ? [{
      id: 'current',
      points: currentPath,
      color: currentColor,
      strokeWidth: strokeWidth,
      tool: currentTool
    }] : [])
  ];

  // Add live strokes from remote users for current page
  const currentPageLiveStrokes = Array.from(liveStrokes.entries())
    .filter(([_, stroke]) => stroke.page === currentPage)
    .map(([id, stroke]) => ({
      id: `live-${id}`,
      points: stroke.points,
      color: stroke.color,
      strokeWidth: stroke.strokeWidth,
      tool: 'pen'
    }));

  const finalLines = [...allLines, ...currentPageLiveStrokes];

  return (
    <div className="whiteboard-container">
      <div className="controls">
        <Toolbar
          currentTool={currentTool}
          setCurrentTool={setCurrentTool}
          currentColor={currentColor}
          setCurrentColor={setCurrentColor}
          strokeWidth={strokeWidth}
          setStrokeWidth={setStrokeWidth}
          onClear={handleClearPage}
        />
        {/* <PageManager
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          onAddPage={addNewPage}
        /> */}
      </div>

      <div className="whiteboard" style={{ flex: 1, overflow: 'hidden' }}>
        <Stage
          width={1200}
          height={2400}
          onMouseDown={handleMouseDown}
          onMousemove={handleMouseMove}
          onMouseup={handleMouseUp}
          onTouchStart={handleMouseDown}
          onTouchMove={handleMouseMove}
          onTouchEnd={handleMouseUp}
          onPointerDown={handleMouseDown}
          onPointerMove={handleMouseMove}
          onPointerUp={handleMouseUp}
          ref={stageRef}
          draggable={false}
          style={{ 
            border: '2px solid #ddd',
            background: 'white',
            cursor: currentTool === 'pen' ? 'crosshair' : 'default',
            touchAction: 'none'
          }}
        >
          <Layer>
            {finalLines.map((line) => (
              <Line
                key={line.id}
                points={line.points}
                stroke={line.color || '#000000'}
                strokeWidth={line.strokeWidth || 2}
                tension={0.2}
                lineCap="round"
                lineJoin="round"
                globalCompositeOperation="source-over"
                perfectDrawEnabled={false}
                shadowForStrokeEnabled={false}
              />
            ))}
          </Layer>
        </Stage>
      </div>
    </div>
  );
};

export default Whiteboard; 