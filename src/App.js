import React, { useEffect, useState } from 'react';
import './App.css';
import ConnectionPanel from './components/ConnectionPanel';
import Whiteboard from './components/Whiteboard';
import WebRTCManager from './services/WebRTCManager';

function App() {
  const [webrtcManager] = useState(() => new WebRTCManager());
  const [connectionState, setConnectionState] = useState('disconnected');
  const [debugLogs, setDebugLogs] = useState([]);

  useEffect(() => {
    // Set up WebRTC event handlers
    webrtcManager.onConnectionStateChange = (state) => {
      console.log(`Connection state changed: ${state}`);
      setConnectionState(state);
    };

    webrtcManager.onDebugLog = (message) => {
      setDebugLogs(prev => {
        const newLogs = [...prev, { message, timestamp: Date.now() }];
        return newLogs.slice(-20); // Keep only last 20 logs
      });
    };

    return () => {
      webrtcManager.cleanup();
    };
  }, [webrtcManager]);

  const handleConnect = async (roomId, isHost) => {
    console.log(`Attempting to connect to room: ${roomId} as ${isHost ? 'HOST' : 'GUEST'}`);
    setConnectionState('connecting');
    
    try {
      const result = await webrtcManager.joinRoom(roomId);
      console.log('Connection result:', result);
    } catch (error) {
      console.error('Connection failed:', error);
      setConnectionState('disconnected');
      throw error;
    }
  };

  const handleDisconnect = () => {
    console.log('Disconnecting...');
    webrtcManager.cleanup();
    setConnectionState('disconnected');
    setDebugLogs([]);
  };

  const clearDebugLogs = () => {
    setDebugLogs([]);
  };

  return (
    <div className="app">
      <div className="app-header">
        <h1>🎨 WebRTC Whiteboard</h1>
        <div className="connection-status">
          <span className={connectionState}>
            {connectionState === 'connected' && '🟢 Connected'}
            {connectionState === 'connecting' && '🟡 Connecting...'}
            {connectionState === 'disconnected' && '🔴 Disconnected'}
            {connectionState === 'failed' && '❌ Connection Failed'}
          </span>
          
          {connectionState === 'connected' && (
            <div className="debug-controls">
              <button className="disconnect-btn" onClick={handleDisconnect}>
                Disconnect
              </button>
            </div>
          )}
        </div>
      </div>

      {connectionState === 'connected' ? (
        <Whiteboard webrtcManager={webrtcManager} />
      ) : (
        <ConnectionPanel 
          onConnect={handleConnect} 
          onDisconnect={handleDisconnect}
          connectionState={connectionState}
        />
      )}

      {/* Debug logs - can be hidden in production */}
      {debugLogs.length > 0 && (
        <div style={{
          position: 'fixed',
          bottom: '10px',
          right: '10px',
          width: '300px',
          maxHeight: '200px',
          background: 'rgba(0,0,0,0.8)',
          color: 'white',
          padding: '10px',
          borderRadius: '5px',
          fontSize: '12px',
          overflow: 'auto',
          zIndex: 1000
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
            <strong>Debug Logs</strong>
            <button 
              onClick={clearDebugLogs}
              style={{ 
                background: 'none', 
                border: 'none', 
                color: 'white', 
                cursor: 'pointer',
                fontSize: '10px'
              }}
            >
              ✖
            </button>
          </div>
          {debugLogs.map((log, index) => (
            <div key={index} style={{ marginBottom: '2px', fontSize: '10px' }}>
              <span style={{ color: '#888' }}>
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              {' '}{log.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App; 