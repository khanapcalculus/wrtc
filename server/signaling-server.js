const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

// Enable CORS for all origins (development only)
app.use(cors({
  origin: "*",
  methods: ["GET", "POST"]
}));

app.use(express.json());

// Basic route for health check
app.get('/', (req, res) => {
  res.json({ 
    message: 'WebRTC Signaling Server', 
    status: 'running',
    timestamp: new Date().toISOString(),
    protocol: 'HTTP'
  });
});

// Create HTTP server (WebSocket works better with HTTP for local development)
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  allowEIO3: true,
  transports: ['websocket', 'polling']
});

// Store active rooms and their participants
const rooms = new Map(); // roomId -> { participants: Set, host: socketId }

io.on('connection', (socket) => {
  console.log(`🔗 User connected: ${socket.id}`);
  
  // Handle room joining
  socket.on('join-room', (roomId, callback) => {
    console.log(`🏠 ${socket.id} wants to join room: ${roomId}`);
    
    if (!rooms.has(roomId)) {
      rooms.set(roomId, { participants: new Set(), host: null });
    }
    
    const room = rooms.get(roomId);
    
    if (room.participants.size >= 2) {
      callback({ 
        success: false, 
        message: 'Room is full (max 2 participants)' 
      });
      return;
    }
    
    // Join the room
    socket.join(roomId);
    room.participants.add(socket.id);
    socket.roomId = roomId;
    
    const isHost = room.participants.size === 1;
    if (isHost) {
      room.host = socket.id;
    }
    
    const participantCount = room.participants.size;
    
    console.log(`✅ ${socket.id} joined room ${roomId} as ${isHost ? 'HOST' : 'GUEST'}`);
    
    // Notify other participants
    socket.to(roomId).emit('user-joined', { 
      participantCount,
      newUser: socket.id 
    });
    
    callback({ 
      success: true, 
      isHost,
      participantCount 
    });
    
    // If room is full (2 participants), notify host to start the call
    if (participantCount === 2) {
      console.log(`🚀 Room ${roomId} is ready for WebRTC - notifying host to create offer`);
      console.log(`🎯 Host socket ID: ${room.host}`);
      
      // Find and notify the specific host
      const hostSocket = io.sockets.sockets.get(room.host);
      if (hostSocket) {
        console.log(`📤 Sending start-call to host ${room.host}`);
        hostSocket.emit('start-call');
      } else {
        console.log(`❌ Host socket ${room.host} not found!`);
      }
    }
  });
  
  // Handle WebRTC signaling
  socket.on('webrtc-offer', (data) => {
    console.log(`📤 Forwarding offer from ${socket.id} to room ${socket.roomId}`);
    socket.to(socket.roomId).emit('webrtc-offer', data);
  });
  
  socket.on('webrtc-answer', (data) => {
    console.log(`📤 Forwarding answer from ${socket.id} to room ${socket.roomId}`);
    socket.to(socket.roomId).emit('webrtc-answer', data);
  });
  
  socket.on('webrtc-ice-candidate', (data) => {
    console.log(`🧊 Forwarding ICE candidate from ${socket.id} to room ${socket.roomId}`);
    socket.to(socket.roomId).emit('webrtc-ice-candidate', data);
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`❌ User disconnected: ${socket.id}`);
    
    if (socket.roomId && rooms.has(socket.roomId)) {
      const room = rooms.get(socket.roomId);
      room.participants.delete(socket.id);
      
      const participantCount = room.participants.size;
      
      // Notify remaining participants
      socket.to(socket.roomId).emit('user-left', { 
        participantCount,
        leftUser: socket.id 
      });
      
      // Clean up empty rooms
      if (participantCount === 0) {
        rooms.delete(socket.roomId);
        console.log(`🧹 Cleaned up empty room: ${socket.roomId}`);
      }
    }
  });
});

server.listen(PORT, HOST, () => {
  console.log(`🚀 Signaling server running on ${HOST}:${PORT}`);
  console.log(`📡 WebSocket server ready for connections`);
  console.log(`🌐 Accessible at: http://localhost:${PORT} and http://[your-ip]:${PORT}`);
  console.log(`💡 Using HTTP for better WebSocket compatibility`);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    rooms: rooms.size,
    timestamp: new Date().toISOString()
  });
});

// Get room info endpoint
app.get('/rooms/:roomId', (req, res) => {
  const room = rooms.get(req.params.roomId);
  if (room) {
    res.json({
      participants: room.participants.size,
      isFull: room.participants.size >= 2
    });
  } else {
    res.json({
      participants: 0,
      isFull: false
    });
  }
}); 