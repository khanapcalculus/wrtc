import { io } from 'socket.io-client';

class WebRTCManager {
  constructor() {
    this.peerConnection = null;
    this.dataChannel = null;
    this.socket = null;
    this.roomId = null;
    this.isHost = false;
    this.onConnectionStateChange = null;
    this.onDataReceived = null;
    this.onDebugLog = null;
    this.connectionTimeout = null;
    this.isUsingFallback = false; // Track if using Socket.IO fallback
    
    // WebRTC configuration with STUN and TURN servers
    this.config = {
      iceServers: [
        // Google STUN servers
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        
        // Metered TURN servers (free tier)
        {
          urls: 'turn:openrelay.metered.ca:80',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        {
          urls: 'turn:openrelay.metered.ca:443',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        {
          urls: 'turn:openrelay.metered.ca:443?transport=tcp',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        
        // Additional free TURN servers for redundancy
        {
          urls: 'turn:relay.metered.ca:80',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        {
          urls: 'turn:relay.metered.ca:443',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        {
          urls: 'turn:relay.metered.ca:443?transport=tcp',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        
        // Alternative TURN servers for restrictive networks
        {
          urls: 'turn:turn.anyfirewall.com:443?transport=tcp',
          username: 'webrtc',
          credential: 'webrtc'
        },
        {
          urls: 'turn:numb.viagenie.ca:3478',
          username: 'webrtc@live.com',
          credential: 'muazkh'
        },
        {
          urls: 'turn:numb.viagenie.ca:443?transport=tcp',
          username: 'webrtc@live.com', 
          credential: 'muazkh'
        }
      ],
      iceCandidatePoolSize: 10,
      iceTransportPolicy: 'all', // Use all available transports
      bundlePolicy: 'balanced' // Optimize for connectivity
    };
  }

  // Connect to signaling server
  connectToSignalingServer() {
    this.debugLog('🔗 Connecting to signaling server...');
    
    // Auto-detect environment: production (deployed) vs development (local)
    const currentHost = window.location.hostname;
    let signalingUrl;
    
    if (currentHost === 'localhost' || currentHost.startsWith('192.168') || currentHost.startsWith('10.')) {
      // Development: use local signaling server
      signalingUrl = `http://${currentHost}:3001`;
    } else {
      // Production: use deployed signaling server on Render.com
      signalingUrl = 'https://wrtc-signaling-server.onrender.com';
    }
    
    this.debugLog(`📡 Signaling server URL: ${signalingUrl}`);
    this.debugLog(`🌍 Current page: ${window.location.href}`);
    this.debugLog(`💡 Environment: ${currentHost === 'localhost' ? 'Development' : 'Production'}`);
    
    this.socket = io(signalingUrl, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true,
      upgrade: true,
      rememberUpgrade: false
    });

    this.socket.on('connect', () => {
      this.debugLog('✅ Connected to signaling server');
    });

    this.socket.on('disconnect', (reason) => {
      this.debugLog(`❌ Disconnected from signaling server: ${reason}`);
    });

    this.socket.on('connect_error', (error) => {
      this.debugLog(`❌ Connection error: ${error.message}`);
      this.debugLog(`🔧 Trying to connect to: ${signalingUrl}`);
      
      // Provide helpful troubleshooting info
      this.debugLog('💡 Check if signaling server is deployed and running');
    });

    // Listen for WebRTC signaling events
    this.setupSignalingListeners();
  }

  setupSignalingListeners() {
    // Handle incoming offer
    this.socket.on('webrtc-offer', async (data) => {
      this.debugLog('📥 Received WebRTC offer');
      try {
        await this.handleOffer(data.offer);
        this.debugLog('✅ Processed offer and sent answer');
      } catch (error) {
        this.debugLog(`❌ Error handling offer: ${error.message}`);
      }
    });

    // Handle incoming answer
    this.socket.on('webrtc-answer', async (data) => {
      this.debugLog('📥 Received WebRTC answer');
      try {
        await this.handleAnswer(data.answer);
        this.debugLog('✅ Processed answer');
      } catch (error) {
        this.debugLog(`❌ Error handling answer: ${error.message}`);
      }
    });

    // Handle ICE candidates
    this.socket.on('webrtc-ice-candidate', async (data) => {
      this.debugLog(`🧊 Received ICE candidate: ${data.candidate.type} (${data.candidate.protocol})`);
      try {
        await this.handleIceCandidate(data.candidate);
      } catch (error) {
        this.debugLog(`❌ Error handling ICE candidate: ${error.message}`);
      }
    });

    // Handle call initiation (for host)
    this.socket.on('start-call', async () => {
      this.debugLog('🚀 Starting call as host');
      
      try {
        if (this.peerConnection && this.peerConnection.signalingState === 'stable') {
          await this.createOffer();
        } else {
          this.debugLog('❌ Peer connection not ready, skipping offer creation');
        }
      } catch (error) {
        this.debugLog(`❌ Error in start-call: ${error.message}`);
      }
    });

    // Handle user events
    this.socket.on('user-joined', (data) => {
      this.debugLog(`👋 User joined room (${data.participantCount} total)`);
    });

    this.socket.on('user-left', (data) => {
      this.debugLog(`👋 User left room (${data.participantCount} remaining)`);
      if (data.participantCount === 0) {
        this.cleanup();
      }
    });

    // Socket.IO fallback for data transmission
    this.socket.on('fallback-data', (data) => {
      this.debugLog('📡 Received data via Socket.IO fallback');
      if (this.onDataReceived) {
        this.onDataReceived(data);
      }
    });
  }

  // Join or create a room
  async joinRoom(roomId) {
    if (!this.socket) {
      this.connectToSignalingServer();
      await new Promise(resolve => {
        this.socket.on('connect', resolve);
      });
    }

    return new Promise((resolve, reject) => {
      this.roomId = roomId;
      
      this.socket.emit('join-room', roomId, (response) => {
        if (response.success) {
          this.isHost = response.isHost;
          this.debugLog(`✅ Joined room as ${this.isHost ? 'HOST' : 'GUEST'}`);
          this.debugLog(`👥 Participants: ${response.participantCount}/2`);
          
          // Initialize WebRTC
          this.initializePeerConnection();
          
          resolve({
            success: true,
            isHost: this.isHost,
            participantCount: response.participantCount
          });
        } else {
          this.debugLog(`❌ Failed to join room: ${response.message}`);
          reject(new Error(response.message));
        }
      });
    });
  }

  initializePeerConnection() {
    this.debugLog('🔄 Initializing peer connection...');
    
    this.peerConnection = new RTCPeerConnection(this.config);

    // Create data channel (host only)
    if (this.isHost) {
      this.dataChannel = this.peerConnection.createDataChannel('whiteboard', {
        ordered: true
      });
      this.setupDataChannel();
      this.debugLog('📺 Data channel created (host)');
    }

    // Handle incoming data channel (guest)
    this.peerConnection.ondatachannel = (event) => {
      this.debugLog('📺 Data channel received (guest)');
      this.dataChannel = event.channel;
      this.setupDataChannel();
    };

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.debugLog(`🧊 Sending ICE candidate: ${event.candidate.type} (${event.candidate.protocol})`);
        this.socket.emit('webrtc-ice-candidate', {
          candidate: event.candidate
        });
      } else {
        this.debugLog('🧊 ICE gathering complete');
      }
    };

    // Monitor connection state
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection.connectionState;
      this.debugLog(`🔄 Connection state: ${state}`);
      
      if (this.onConnectionStateChange) {
        this.onConnectionStateChange(state);
      }

      if (state === 'connected') {
        this.debugLog('🎉 WebRTC connection established!');
        if (this.connectionTimeout) {
          clearTimeout(this.connectionTimeout);
        }
      } else if (state === 'failed' || state === 'disconnected') {
        this.debugLog('❌ Connection failed or disconnected');
        this.cleanup();
      }
    };

    // Monitor ICE connection state
    this.peerConnection.oniceconnectionstatechange = () => {
      const iceState = this.peerConnection.iceConnectionState;
      this.debugLog(`🧊 ICE connection state: ${iceState}`);
      
      if (iceState === 'connected' || iceState === 'completed') {
        this.debugLog('🎉 ICE connection established!');
      } else if (iceState === 'failed') {
        this.debugLog('❌ ICE connection failed - trying to restart');
        // Try ICE restart
        this.peerConnection.restartIce();
      }
    };

    // Monitor signaling state
    this.peerConnection.onsignalingstatechange = () => {
      const signalingState = this.peerConnection.signalingState;
      this.debugLog(`📡 Signaling state: ${signalingState}`);
    };

    // Set connection timeout (increased to 60 seconds)
    this.connectionTimeout = setTimeout(() => {
      if (this.peerConnection?.connectionState !== 'connected') {
        this.debugLog('⏰ WebRTC connection timeout (60s) - enabling Socket.IO fallback');
        this.debugLog(`🔍 Final states - Connection: ${this.peerConnection?.connectionState}, ICE: ${this.peerConnection?.iceConnectionState}, Signaling: ${this.peerConnection?.signalingState}`);
        
        // Enable fallback mode instead of cleanup
        this.enableSocketIOFallback();
      }
    }, 60000); // 60 second timeout
  }

  setupDataChannel() {
    this.dataChannel.onopen = () => {
      this.debugLog('📺 Data channel opened');
    };

    this.dataChannel.onclose = () => {
      this.debugLog('📺 Data channel closed');
    };

    this.dataChannel.onmessage = (event) => {
      if (this.onDataReceived) {
        const data = JSON.parse(event.data);
        this.onDataReceived(data);
      }
    };

    this.dataChannel.onerror = (error) => {
      this.debugLog(`❌ Data channel error: ${error}`);
    };
  }

  async createOffer() {
    try {
      this.debugLog('📤 Creating offer...');
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      this.socket.emit('webrtc-offer', { offer });
      this.debugLog('📤 Offer sent');
    } catch (error) {
      this.debugLog(`❌ Error creating offer: ${error.message}`);
      throw error;
    }
  }

  async handleOffer(offer) {
    try {
      await this.peerConnection.setRemoteDescription(offer);
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      
      this.socket.emit('webrtc-answer', { answer });
      this.debugLog('📤 Answer sent');
    } catch (error) {
      this.debugLog(`❌ Error handling offer: ${error.message}`);
      throw error;
    }
  }

  async handleAnswer(answer) {
    try {
      await this.peerConnection.setRemoteDescription(answer);
    } catch (error) {
      this.debugLog(`❌ Error handling answer: ${error.message}`);
      throw error;
    }
  }

  async handleIceCandidate(candidate) {
    try {
      await this.peerConnection.addIceCandidate(candidate);
    } catch (error) {
      this.debugLog(`❌ Error adding ICE candidate: ${error.message}`);
    }
  }

  sendData(data) {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      // Use WebRTC data channel (preferred)
      this.dataChannel.send(JSON.stringify(data));
      return true;
    } else if (this.isUsingFallback && this.socket) {
      // Use Socket.IO fallback
      this.debugLog('📡 Sending data via Socket.IO fallback');
      this.socket.emit('fallback-data', data);
      return true;
    }
    return false;
  }

  getConnectionState() {
    if (this.isUsingFallback) {
      return 'connected-fallback';
    }
    return this.peerConnection?.connectionState || 'new';
  }

  enableSocketIOFallback() {
    this.debugLog('🔄 Enabling Socket.IO fallback mode...');
    this.isUsingFallback = true;
    
    // Clean up WebRTC connection but keep socket
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
    }
    
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    
    // Notify connection state change
    if (this.onConnectionStateChange) {
      this.onConnectionStateChange('connected-fallback');
    }
    
    this.debugLog('✅ Socket.IO fallback enabled - whiteboard should work now!');
  }

  cleanup() {
    this.debugLog('🧹 Cleaning up WebRTC connection...');
    
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
    }

    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.roomId = null;
    this.isHost = false;
  }

  debugLog(message) {
    console.log(`[WebRTC] ${message}`);
    if (this.onDebugLog) {
      this.onDebugLog(message);
    }
  }
}

export default WebRTCManager; 