import React, { useState } from 'react';

const ConnectionPanel = ({ onConnect, onDisconnect, connectionState }) => {
  const [roomId, setRoomId] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');

  const generateRoomId = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleCreateRoom = async () => {
    const newRoomId = generateRoomId();
    setRoomId(newRoomId);
    await handleConnect(newRoomId, true);
  };

  const handleJoinRoom = async () => {
    if (roomId.trim()) {
      await handleConnect(roomId.trim().toUpperCase(), false);
    }
  };

  const handleConnect = async (targetRoomId, isHost) => {
    setIsConnecting(true);
    setError('');
    
    try {
      await onConnect(targetRoomId, isHost);
    } catch (err) {
      setError(err.message || 'Failed to connect');
      console.error('Connection error:', err);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    onDisconnect();
    setRoomId('');
    setError('');
  };

  const copyRoomId = () => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(roomId)
        .then(() => {
          console.log('Room ID copied to clipboard');
        })
        .catch(err => {
          console.error('Failed to copy: ', err);
          fallbackCopy(roomId);
        });
    } else {
      fallbackCopy(roomId);
    }
  };

  const fallbackCopy = (text) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      document.execCommand('copy');
      console.log('Room ID copied using fallback method');
    } catch (err) {
      console.error('Fallback copy failed: ', err);
    }
    
    document.body.removeChild(textArea);
  };

  if (connectionState === 'connected') {
    return (
      <div className="waiting-screen">
        <div className="waiting-card">
          <h2>🎉 Connected!</h2>
          <div className="room-display">
            <label>Room ID:</label>
            <div className="room-id-display">{roomId}</div>
            <button className="copy-btn" onClick={copyRoomId}>
              📋 Copy Room ID
            </button>
          </div>
          <p>You can now start drawing together!</p>
          <button className="disconnect-btn" onClick={handleDisconnect}>
            Disconnect
          </button>
        </div>
      </div>
    );
  }

  if (connectionState === 'connecting') {
    return (
      <div className="waiting-screen">
        <div className="waiting-card">
          <h2>🔄 Connecting...</h2>
          <div className="room-display">
            <label>Room ID:</label>
            <div className="room-id-display">{roomId}</div>
            <button className="copy-btn" onClick={copyRoomId}>
              📋 Copy Room ID
            </button>
          </div>
          <p>Establishing WebRTC connection...</p>
          <button className="back-btn" onClick={handleDisconnect}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="waiting-screen">
      <div className="waiting-card">
        <h2>🎨 WebRTC Whiteboard</h2>
        
        {error && (
          <div style={{ 
            color: '#f44336', 
            background: '#ffebee', 
            padding: '1rem', 
            borderRadius: '6px', 
            marginBottom: '1rem',
            border: '1px solid #ffcdd2'
          }}>
            ❌ {error}
          </div>
        )}

        <div className="instructions">
          <h3>🚀 Quick Start</h3>
          <p><strong>Create a room</strong> and share the Room ID with others, or <strong>join</strong> an existing room.</p>
          
          <div style={{ 
            background: '#e8f5e8', 
            padding: '1rem', 
            borderRadius: '6px', 
            margin: '1rem 0',
            border: '1px solid #c8e6c9'
          }}>
            <h4>✨ Features:</h4>
            <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
              <li>🎨 Real-time collaborative drawing</li>
              <li>⚡ Sub-100ms latency via WebRTC</li>
              <li>🌐 Works across different devices</li>
              <li>📱 Mobile and tablet support</li>
              <li>🔒 Peer-to-peer (no data through servers)</li>
            </ul>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
          <button 
            className="copy-btn" 
            onClick={handleCreateRoom}
            disabled={isConnecting}
            style={{ flex: 1 }}
          >
            {isConnecting ? '🔄 Creating...' : '🏠 Create Room'}
          </button>
        </div>

        <div style={{ textAlign: 'center', margin: '1rem 0' }}>
          <strong>-- OR --</strong>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Join Existing Room:
          </label>
          <input
            type="text"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value.toUpperCase())}
            placeholder="Enter Room ID (e.g. ABC12345)"
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '2px solid #ddd',
              borderRadius: '6px',
              fontSize: '1rem',
              fontFamily: 'monospace',
              letterSpacing: '1px',
              textAlign: 'center'
            }}
            maxLength={8}
          />
        </div>

        <button 
          className="copy-btn" 
          onClick={handleJoinRoom}
          disabled={!roomId.trim() || isConnecting}
          style={{ width: '100%' }}
        >
          {isConnecting ? '🔄 Joining...' : '🚪 Join Room'}
        </button>
      </div>
    </div>
  );
};

export default ConnectionPanel; 