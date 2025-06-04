import { io } from 'socket.io-client';

class WebRTCManager {
  constructor(options = {}) {
    this.peerConnection = null;
    this.dataChannel = null;
    this.socket = null;
    this.roomId = null;
    this.isHost = false;
    this.onConnectionStateChange = null;
    this.onDataReceived = null;
    this.onDebugLog = null;
    this.connectionTimeout = null;
    
    // Configuration options - WebRTC only
    this.maxRetryAttempts = options.maxRetryAttempts || 3;
    this.retryDelay = options.retryDelay || 5000; // 5 seconds between retries
    this.currentRetryAttempt = 0;
    
    // Enterprise analytics
    this.analytics = {
      connectionAttempts: 0,
      webrtcSuccessful: 0,
      retryAttempts: 0,
      connectionTime: null,
      startTime: null,
      iceGatheringTime: null,
      selectedCandidateTypes: []
    };
    
    // Enterprise-grade WebRTC configuration
    this.config = this.buildEnterpriseICEConfig();
  }

  // Build enterprise-grade ICE configuration
  buildEnterpriseICEConfig() {
    // Detect user's approximate location for optimal TURN server selection
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const isAsian = timezone.includes('Asia') || timezone.includes('Tokyo') || timezone.includes('Shanghai');
    const isEuropean = timezone.includes('Europe') || timezone.includes('London') || timezone.includes('Berlin');
    const isAmerican = timezone.includes('America') || timezone.includes('New_York') || timezone.includes('Los_Angeles');

    this.debugLog(`🌍 Detected timezone: ${timezone}`);
    this.debugLog(`📍 Geographic optimization: ${isAsian ? 'Asia' : isEuropean ? 'Europe' : isAmerican ? 'Americas' : 'Global'}`);

    // Multiple STUN servers for redundancy
    const iceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' }
    ];

    this.debugLog('🔧 Configuring STUN servers: 5 Google STUN servers');

    // Add the most reliable free TURN servers first (tested and working)
    const reliableTurnServers = [
      // Metered.ca - Most reliable free provider
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
      
      // Backup reliable servers
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
      }
    ];

    // Add region-specific servers for better performance
    const regionalTurnServers = [];
    if (isAsian) {
      regionalTurnServers.push(
        {
          urls: 'turn:turn-ap-southeast-1.metered.ca:80',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        {
          urls: 'turn:turn-ap-southeast-1.metered.ca:443',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        }
      );
      this.debugLog('🌏 Added Asia-Pacific TURN servers');
    } else if (isEuropean) {
      regionalTurnServers.push(
        {
          urls: 'turn:turn-eu-west-1.metered.ca:80',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        {
          urls: 'turn:turn-eu-west-1.metered.ca:443',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        }
      );
      this.debugLog('🇪🇺 Added European TURN servers');
    } else {
      regionalTurnServers.push(
        {
          urls: 'turn:turn-us-east-1.metered.ca:80',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        {
          urls: 'turn:turn-us-east-1.metered.ca:443',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        }
      );
      this.debugLog('🇺🇸 Added Americas TURN servers');
    }

    // Add additional backup TURN servers
    const backupTurnServers = [
      {
        urls: 'turn:numb.viagenie.ca:3478',
        username: 'webrtc@live.com',
        credential: 'muazkh'
      },
      {
        urls: 'turn:numb.viagenie.ca:443?transport=tcp',
        username: 'webrtc@live.com',
        credential: 'muazkh'
      },
      {
        urls: 'turn:turn.anyfirewall.com:443?transport=tcp',
        username: 'webrtc',
        credential: 'webrtc'
      }
    ];

    // Combine all servers: Regional first (best latency), then reliable, then backup
    const allTurnServers = [...regionalTurnServers, ...reliableTurnServers, ...backupTurnServers];
    iceServers.push(...allTurnServers);

    this.debugLog(`🔧 Total ICE servers: ${iceServers.length} (${allTurnServers.length} TURN servers)`);

    return {
      iceServers: iceServers,
      iceCandidatePoolSize: 20, // Increased for better connectivity
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle', // Optimize for connectivity
      rtcpMuxPolicy: 'require',
      // Optimizations for free tier reliability
      iceConnectionReceivingTimeout: 6000, // Longer timeout
      iceBackupCandidatePairPingInterval: 30000,
      enableDtlsSrtp: true
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
      rememberUpgrade: false,
      // Enhanced stability for fallback mode
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      maxReconnectionAttempts: 10
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
      const candidate = data.candidate;
      const candidateType = candidate?.candidate?.includes('typ relay') ? 'relay' :
                           candidate?.candidate?.includes('typ srflx') ? 'srflx' :
                           candidate?.candidate?.includes('typ host') ? 'host' : 'unknown';
      const protocol = candidate?.protocol || 'unknown';
      
      this.debugLog(`🧊 Received ICE candidate: ${candidateType} (${protocol})`);
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
    this.analytics.connectionAttempts++;
    this.analytics.startTime = Date.now();
    
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
        const candidate = event.candidate;
        const candidateType = candidate.candidate.includes('typ relay') ? 'relay' :
                             candidate.candidate.includes('typ srflx') ? 'srflx' :
                             candidate.candidate.includes('typ host') ? 'host' : 'unknown';
        const protocol = candidate.protocol || 'unknown';
        
        this.debugLog(`🧊 Sending ICE candidate: ${candidateType} (${protocol})`);
        
        // Track relay candidates for analytics
        if (candidateType === 'relay') {
          this.analytics.selectedCandidateTypes.push('relay');
          this.debugLog('🎯 TURN server working - relay candidate available!');
        }
        
        this.socket.emit('webrtc-ice-candidate', {
          candidate: event.candidate
        });
      } else {
        this.debugLog('🧊 ICE gathering complete');
        
        // Check if we got any relay candidates
        const hasRelay = this.analytics.selectedCandidateTypes.includes('relay');
        if (!hasRelay) {
          this.debugLog('⚠️ No TURN relay candidates found - may have connectivity issues');
        }
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
        this.analytics.webrtcSuccessful++;
        this.analytics.connectionTime = Date.now() - this.analytics.startTime;
        this.debugLog(`🎉 WebRTC connection established in ${this.analytics.connectionTime}ms!`);
        this.debugLog(`📊 Analytics: ${this.analytics.webrtcSuccessful}/${this.analytics.connectionAttempts} WebRTC success rate`);
        
        if (this.connectionTimeout) {
          clearTimeout(this.connectionTimeout);
        }
      } else if (state === 'failed') {
        this.debugLog('❌ WebRTC connection failed - attempting retry');
        this.attemptRetry();
      } else if (state === 'disconnected') {
        this.debugLog('⚠️ WebRTC connection disconnected - attempting reconnection');
        this.attemptReconnection();
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
        this.debugLog('⏰ WebRTC connection timeout (60s) - attempting retry');
        this.debugLog(`🔍 Final states - Connection: ${this.peerConnection?.connectionState}, ICE: ${this.peerConnection?.iceConnectionState}, Signaling: ${this.peerConnection?.signalingState}`);
        this.attemptRetry();
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
    }
    return false;
  }

  getConnectionState() {
    return this.peerConnection?.connectionState || 'new';
  }

  cleanup() {
    this.debugLog('🧹 Cleaning up WebRTC connection...');
    
    // Reset retry counter
    this.currentRetryAttempt = 0;
    
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

  // Get enterprise analytics for monitoring
  getAnalytics() {
    const successRate = this.analytics.connectionAttempts > 0 
      ? (this.analytics.webrtcSuccessful / this.analytics.connectionAttempts * 100).toFixed(1)
      : 0;
    
    return {
      ...this.analytics,
      webrtcSuccessRate: `${successRate}%`,
      averageConnectionTime: this.analytics.connectionTime || 'N/A',
      currentConnectionType: 'WebRTC Direct'
    };
  }

  // WebRTC retry logic
  attemptRetry() {
    if (this.currentRetryAttempt < this.maxRetryAttempts) {
      this.currentRetryAttempt++;
      this.analytics.retryAttempts++;
      
      this.debugLog(`🔄 Retry attempt ${this.currentRetryAttempt}/${this.maxRetryAttempts} in ${this.retryDelay/1000}s...`);
      
      // Clean up current connection
      if (this.peerConnection) {
        this.peerConnection.close();
        this.peerConnection = null;
      }
      
      if (this.dataChannel) {
        this.dataChannel.close();
        this.dataChannel = null;
      }
      
      // Wait and retry
      setTimeout(() => {
        this.debugLog(`🚀 Retrying WebRTC connection (attempt ${this.currentRetryAttempt})`);
        this.initializePeerConnection();
        
        // If host, create new offer
        if (this.isHost) {
          setTimeout(() => {
            if (this.peerConnection && this.peerConnection.signalingState === 'stable') {
              this.createOffer();
            }
          }, 1000);
        }
      }, this.retryDelay);
    } else {
      this.debugLog(`❌ Max retry attempts (${this.maxRetryAttempts}) reached. Connection failed.`);
      this.debugLog(`📊 Final analytics: ${this.analytics.webrtcSuccessful}/${this.analytics.connectionAttempts} success, ${this.analytics.retryAttempts} retries`);
      this.cleanup();
    }
  }

  // WebRTC reconnection logic
  attemptReconnection() {
    this.debugLog('🔄 Attempting to reconnect WebRTC...');
    
    // Try ICE restart first
    if (this.peerConnection && this.peerConnection.connectionState !== 'closed') {
      try {
        this.peerConnection.restartIce();
        this.debugLog('🧊 ICE restart initiated');
        
        // Wait for reconnection, then retry if still failed
        setTimeout(() => {
          if (this.peerConnection?.connectionState !== 'connected') {
            this.debugLog('⚠️ ICE restart failed, attempting full retry');
            this.attemptRetry();
          }
        }, 10000); // 10 seconds for ICE restart
      } catch (error) {
        this.debugLog(`❌ ICE restart failed: ${error.message}`);
        this.attemptRetry();
      }
    } else {
      this.attemptRetry();
    }
  }
}

export default WebRTCManager; 