// const express = require('express');
// const http = require('http');
// const socketIo = require('socket.io');
// const wrtc = require('wrtc');
// const path = require('path');

// const app = express();
// const server = http.createServer(app);
// const io = socketIo(server);

// // Set EJS as the view engine
// app.set('view engine', 'ejs');
// app.set('views', path.join(__dirname, 'views'));
// app.use(express.static(path.join(__dirname, 'public')));

// // Routes
// app.get('/broadcast', (req, res) => {
//   res.render('broadcast');
// });

// app.get('/view', (req, res) => {
//   res.render('viewer');
// });

// app.get('/', (req, res) => {
//   res.redirect('/view');
// });

// // WebRTC and Socket.io handling
// let broadcaster = null;
// const viewers = new Map(); // Map to store viewer connections
// let broadcasterStream = null; // Store the broadcaster's MediaStream

// io.on('connection', (socket) => {
//   console.log('Client connected:', socket.id);

//   // When a broadcaster connects
//   socket.on('broadcaster', async () => {
//     // If there's already a broadcaster, disconnect the previous one
//     if (broadcaster) {
//       io.to(broadcaster).emit('broadcaster_exists');
//     }
    
//     broadcaster = socket.id;
//     console.log('Broadcaster connected:', broadcaster);
    
//     // Let all viewers know a broadcaster is available
//     socket.broadcast.emit('broadcaster_connected');
//   });

//   // Handle offer from broadcaster
//   socket.on('broadcaster_offer', async (description) => {
//     if (socket.id !== broadcaster) return;
    
//     try {
//       // Close any existing peer connection
//       if (socket.peerConnection) {
//         socket.peerConnection.close();
//       }
      
//       const peerConnection = new wrtc.RTCPeerConnection({
//         iceServers: [
//           { urls: 'stun:stun.stunprotocol.org:3478' },
//           { urls: 'stun:stun.l.google.com:19302' }
//         ]
//       });
      
//       // Create a new MediaStream to hold the broadcaster's tracks
//       broadcasterStream = new wrtc.MediaStream();
      
//       // Store broadcaster's tracks when they are received
//       peerConnection.ontrack = (event) => {
//         console.log('Received track from broadcaster:', event.track.kind);
        
//         // Add the track to our broadcasterStream
//         broadcasterStream.addTrack(event.track);
        
//         console.log(`Broadcaster stream now has ${broadcasterStream.getTracks().length} tracks`);
//         console.log(`Track types: ${broadcasterStream.getTracks().map(t => t.kind).join(', ')}`);
        
//         // Update all existing viewers with the new track
//         updateAllViewers();
//       };
      
//       // Set up ICE handling
//       peerConnection.onicecandidate = (event) => {
//         if (event.candidate) {
//           socket.emit('broadcaster_ice_candidate', event.candidate);
//         }
//       };
      
//       // Log connection state changes for debugging
//       peerConnection.onconnectionstatechange = () => {
//         console.log(`Broadcaster connection state: ${peerConnection.connectionState}`);
//         if (peerConnection.connectionState === 'connected') {
//           console.log('Broadcaster fully connected!');
//         }
//       };
      
//       peerConnection.oniceconnectionstatechange = () => {
//         console.log(`Broadcaster ICE connection state: ${peerConnection.iceConnectionState}`);
//       };
      
//       await peerConnection.setRemoteDescription(description);
//       const answer = await peerConnection.createAnswer();
//       await peerConnection.setLocalDescription(answer);
      
//       // Send answer back to broadcaster
//       socket.emit('broadcaster_answer', peerConnection.localDescription);
      
//       // Save the peer connection
//       socket.peerConnection = peerConnection;
      
//       console.log('Broadcaster peer connection setup complete');
//     } catch (error) {
//       console.error('Error handling broadcaster offer:', error);
//       socket.emit('error', { message: 'Failed to establish broadcaster connection' });
//     }
//   });

//   // Handle ICE candidates from broadcaster
//   socket.on('broadcaster_ice_candidate', (candidate) => {
//     if (socket.id !== broadcaster || !socket.peerConnection) return;
    
//     try {
//       socket.peerConnection.addIceCandidate(new wrtc.RTCIceCandidate(candidate));
//     } catch (error) {
//       console.error('Error adding broadcaster ICE candidate:', error);
//     }
//   });

//   // Handle viewer connection requests
//   socket.on('viewer_request', async () => {
//     if (!broadcaster) {
//       socket.emit('no_broadcaster');
//       return;
//     }
    
//     try {
//       // Create a new RTCPeerConnection for this viewer
//       const viewerPC = new wrtc.RTCPeerConnection({
//         iceServers: [
//             {
//               urls: "stun:stun.relay.metered.ca:80",
//             },
//             {
//               urls: "turn:global.relay.metered.ca:80",
//               username: "f5baae95181d1a3b2947f791",
//               credential: "n67tiC1skstIO4zc",
//             },
//             {
//               urls: "turn:global.relay.metered.ca:80?transport=tcp",
//               username: "f5baae95181d1a3b2947f791",
//               credential: "n67tiC1skstIO4zc",
//             },
//             {
//               urls: "turn:global.relay.metered.ca:443",
//               username: "f5baae95181d1a3b2947f791",
//               credential: "n67tiC1skstIO4zc",
//             },
//             {
//               urls: "turns:global.relay.metered.ca:443?transport=tcp",
//               username: "f5baae95181d1a3b2947f791",
//               credential: "n67tiC1skstIO4zc",
//             },
//           ],
//       });
      
//       // Add this viewer to our map
//       viewers.set(socket.id, viewerPC);
      
//       // Handle ICE candidate events
//       viewerPC.onicecandidate = (event) => {
//         if (event.candidate) {
//           socket.emit('viewer_ice_candidate', event.candidate);
//         }
//       };
      
//       // Log connection state changes for debugging
//       viewerPC.onconnectionstatechange = () => {
//         console.log(`Viewer ${socket.id} connection state: ${viewerPC.connectionState}`);
//         if (viewerPC.connectionState === 'connected') {
//           console.log(`Viewer ${socket.id} fully connected!`);
//         }
//       };
      
//       viewerPC.oniceconnectionstatechange = () => {
//         console.log(`Viewer ${socket.id} ICE connection state: ${viewerPC.iceConnectionState}`);
//       };
      
//       // Check if we have tracks to send
//       let tracksAdded = false;
      
//       if (broadcasterStream && broadcasterStream.getTracks().length > 0) {
//         console.log(`Adding ${broadcasterStream.getTracks().length} tracks to viewer ${socket.id}`);
        
//         // Important: Clone the MediaStream to ensure proper handling
//         const viewerStream = new wrtc.MediaStream();
        
//         // Add all tracks from broadcaster stream to viewer stream and peer connection
//         broadcasterStream.getTracks().forEach(track => {
//           console.log(`Adding ${track.kind} track to viewer ${socket.id}`);
//           viewerPC.addTrack(track, viewerStream);
//           tracksAdded = true;
//         });
//       }
      
//       if (!tracksAdded) {
//         console.warn('No tracks available to add to the viewer connection');
//         socket.emit('error', { message: 'No broadcast stream available yet. Please try again in a moment.' });
//         return;
//       }
      
//       // Create offer for viewer
//       const offer = await viewerPC.createOffer();
//       await viewerPC.setLocalDescription(offer);
      
//       // Send offer to viewer
//       socket.emit('viewer_offer', viewerPC.localDescription);
//     } catch (error) {
//       console.error('Error setting up viewer connection:', error);
//       socket.emit('error', { message: 'Failed to establish viewer connection' });
//     }
//   });

//   // Handle answer from viewer
//   socket.on('viewer_answer', async (description) => {
//     const viewerPC = viewers.get(socket.id);
//     if (!viewerPC) return;
    
//     try {
//       await viewerPC.setRemoteDescription(description);
//       console.log(`Viewer ${socket.id} answer processed successfully`);
//     } catch (error) {
//       console.error('Error setting viewer remote description:', error);
//     }
//   });

//   // Handle ICE candidates from viewer
//   socket.on('viewer_ice_candidate', (candidate) => {
//     const viewerPC = viewers.get(socket.id);
//     if (!viewerPC) return;
    
//     try {
//       viewerPC.addIceCandidate(new wrtc.RTCIceCandidate(candidate));
//     } catch (error) {
//       console.error('Error adding viewer ICE candidate:', error);
//     }
//   });

//   // Handle disconnections
//   socket.on('disconnect', () => {
//     console.log('Client disconnected:', socket.id);
    
//     if (socket.id === broadcaster) {
//       console.log('Broadcaster disconnected');
//       broadcaster = null;
      
//       // Clean up broadcaster peer connection
//       if (socket.peerConnection) {
//         socket.peerConnection.close();
//         delete socket.peerConnection;
//       }
      
//       // Clear broadcaster stream
//       if (broadcasterStream) {
//         broadcasterStream.getTracks().forEach(track => track.stop());
//         broadcasterStream = null;
//       }
      
//       // Notify all viewers that the broadcaster is gone
//       io.emit('broadcaster_disconnected');
      
//       // Close all viewer connections
//       viewers.forEach((viewerPC) => {
//         viewerPC.close();
//       });
//       viewers.clear();
//     } else if (viewers.has(socket.id)) {
//       console.log('Viewer disconnected:', socket.id);
      
//       // Clean up viewer peer connection
//       const viewerPC = viewers.get(socket.id);
//       if (viewerPC) {
//         viewerPC.close();
//       }
//       viewers.delete(socket.id);
//     }
//   });

//   // Helper function to update all viewers with current broadcaster stream
//   function updateAllViewers() {
//     if (!broadcasterStream || broadcasterStream.getTracks().length === 0) {
//       console.log('No broadcaster stream available to update viewers');
//       return;
//     }
    
//     console.log(`Updating all viewers with ${broadcasterStream.getTracks().length} tracks`);
    
//     viewers.forEach((viewerPC, viewerId) => {
//       try {
//         // Get current senders
//         const senders = viewerPC.getSenders();
//         const existingKinds = senders.map(sender => sender.track?.kind).filter(Boolean);
        
//         // Check each track from broadcaster
//         broadcasterStream.getTracks().forEach(track => {
//           if (!existingKinds.includes(track.kind)) {
//             console.log(`Adding ${track.kind} track to existing viewer ${viewerId}`);
//             const stream = new wrtc.MediaStream();
//             stream.addTrack(track);
//             viewerPC.addTrack(track, stream);
//           }
//         });
//       } catch (error) {
//         console.error(`Error updating viewer ${viewerId}:`, error);
//       }
//     });
//   }
// });

// // Start server
// const PORT = process.env.PORT || 3000;
// server.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
//   console.log(`Broadcast page: http://localhost:${PORT}/broadcast`);
//   console.log(`Viewer page: http://localhost:${PORT}/view`);
// });



const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const wrtc = require('wrtc');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/broadcast', (req, res) => {
  res.render('broadcast');
});

app.get('/view', (req, res) => {
  res.render('viewer');
});

app.get('/', (req, res) => {
  res.redirect('/view');
});

// WebRTC and Socket.io handling
let broadcaster = null;
const viewers = new Map(); // Map to store viewer connections
let broadcasterStream = null; // Store the broadcaster's MediaStream
let simulcastEnabled = false;
let simulcastLayers = [];

class Viewer {
  constructor(socketId, peerConnection) {
    this.socketId = socketId;
    this.peerConnection = peerConnection;
    this.preferredQuality = 'auto'; // Default to auto
    this.networkStats = {
      bitrate: 0,
      packetLoss: 0,
      rtt: 0,
      lastUpdate: Date.now()
    };
    this.activeLayer = 'auto'; // Currently active layer
    this.transceivers = []; // Store transceivers for this viewer
  }
  
  updateNetworkStats(stats) {
    this.networkStats = {
      ...stats,
      lastUpdate: Date.now()
    };
  }
  
  // Determine best quality based on network conditions
  determineOptimalQuality() {
    // If user explicitly chose quality, respect that choice
    if (this.preferredQuality !== 'auto') {
      return this.preferredQuality;
    }
    
    // Auto selection based on network conditions
    const { bitrate, packetLoss, rtt } = this.networkStats;
    
    // Simple algorithm for quality selection
    if (packetLoss > 10 || bitrate < 300) {
      return 'low';
    } else if (packetLoss > 5 || bitrate < 1000 || rtt > 300) {
      return 'medium';
    } else {
      return 'high';
    }
  }
}

// Helper function to log with timestamp
function log(message) {
  const timestamp = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
  console.log(`[${timestamp}] ${message}`);
}

io.on('connection', (socket) => {
  log(`Client connected: ${socket.id}`);

  // When a broadcaster connects
  socket.on('broadcaster', async () => {
    // If there's already a broadcaster, disconnect the previous one
    if (broadcaster) {
      io.to(broadcaster).emit('broadcaster_exists');
    }
    
    broadcaster = socket.id;
    log(`Broadcaster connected: ${broadcaster}`);
    
    // Reset simulcast status for new broadcaster
    simulcastEnabled = false;
    simulcastLayers = [];
    
    // Let all viewers know a broadcaster is available
    socket.broadcast.emit('broadcaster_connected');
  });

  // Handle simulcast status from broadcaster
  socket.on('simulcast_enabled', (data) => {
    if (socket.id !== broadcaster) return;
    
    simulcastEnabled = data.enabled;
    if (simulcastEnabled && data.layers) {
      simulcastLayers = data.layers;
      log(`Broadcaster enabled simulcast with ${simulcastLayers.length} layers`);
    } else {
      log('Broadcaster disabled simulcast');
    }
    
    // Notify all viewers about simulcast status
    viewers.forEach((viewer, viewerId) => {
      io.to(viewerId).emit('simulcast_status', {
        enabled: simulcastEnabled,
        layers: simulcastLayers
      });
    });
  });

  // Handle offer from broadcaster
  socket.on('broadcaster_offer', async (description) => {
    if (socket.id !== broadcaster) return;
    
    try {
      // Close any existing peer connection
      if (socket.peerConnection) {
        socket.peerConnection.close();
      }
      
      const peerConnection = new wrtc.RTCPeerConnection({
        iceServers: [
          { 
            urls: 'stun:stun.relay.metered.ca:80'
          },
          {
            urls: 'turn:global.relay.metered.ca:80',
            username: 'f5baae95181d1a3b2947f791',
            credential: 'n67tiC1skstIO4zc',
          }
        ]
      });
      
      // Create a new MediaStream to hold the broadcaster's tracks
      broadcasterStream = new wrtc.MediaStream();
      
      // Store broadcaster's tracks when they are received
      peerConnection.ontrack = (event) => {
        log(`Received track from broadcaster: ${event.track.kind}, streamId: ${event.streams[0]?.id || 'none'}`);
        
        // Check if this track is a simulcast track (has rid)
        if (event.transceiver && event.transceiver.mid && simulcastEnabled) {
          log(`Simulcast track received with mid: ${event.transceiver.mid}, rid: ${event.track.id}`);
        }
        
        // Add the track to our broadcasterStream
        broadcasterStream.addTrack(event.track);
        
        log(`Broadcaster stream now has ${broadcasterStream.getTracks().length} tracks`);
        const trackTypes = broadcasterStream.getTracks().map(t => `${t.kind}${t.id ? ` (${t.id})` : ''}`).join(', ');
        log(`Track types: ${trackTypes}`);
        
        // Update all existing viewers with the new track
        updateAllViewers();
      };
      
      // Set up ICE handling
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('broadcaster_ice_candidate', event.candidate);
        }
      };
      
      // Log connection state changes for debugging
      peerConnection.onconnectionstatechange = () => {
        log(`Broadcaster connection state: ${peerConnection.connectionState}`);
        if (peerConnection.connectionState === 'connected') {
          log('Broadcaster fully connected!');
        }
      };
      
      peerConnection.oniceconnectionstatechange = () => {
        log(`Broadcaster ICE connection state: ${peerConnection.iceConnectionState}`);
      };
      
      // Detailed analysis of the SDP for simulcast detection
      const offer = new wrtc.RTCSessionDescription(description);
      const sdpLines = offer.sdp.split('\\r\\n');
      let simulcastLine = sdpLines.find(line => line.includes('a=simulcast'));
      
      if (simulcastLine) {
        log(`Detected simulcast in broadcaster SDP: ${simulcastLine}`);
        simulcastEnabled = true;
      }
      
      await peerConnection.setRemoteDescription(offer);
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      
      // Send answer back to broadcaster
      socket.emit('broadcaster_answer', peerConnection.localDescription);
      
      // Save the peer connection
      socket.peerConnection = peerConnection;
      
      log('Broadcaster peer connection setup complete');
      
      // Send viewer count to broadcaster
      socket.emit('viewer_count', viewers.size);
    } catch (error) {
      console.error('Error handling broadcaster offer:', error);
      socket.emit('error', { message: 'Failed to establish broadcaster connection' });
    }
  });

  // Handle ICE candidates from broadcaster
  socket.on('broadcaster_ice_candidate', (candidate) => {
    if (socket.id !== broadcaster || !socket.peerConnection) return;
    
    try {
      socket.peerConnection.addIceCandidate(new wrtc.RTCIceCandidate(candidate));
    } catch (error) {
      console.error('Error adding broadcaster ICE candidate:', error);
    }
  });

  // Handle viewer connection requests
  socket.on('viewer_request', async (data = {}) => {
    if (!broadcaster) {
      socket.emit('no_broadcaster');
      return;
    }
    
    try {
      // Create a new RTCPeerConnection for this viewer
      const viewerPC = new wrtc.RTCPeerConnection({
        iceServers: [
          {
            urls: "stun:stun.relay.metered.ca:80",
          },
          {
            urls: "turn:global.relay.metered.ca:80",
            username: "f5baae95181d1a3b2947f791",
            credential: "n67tiC1skstIO4zc",
          },
          {
            urls: "turn:global.relay.metered.ca:80?transport=tcp",
            username: "f5baae95181d1a3b2947f791",
            credential: "n67tiC1skstIO4zc",
          },
          {
            urls: "turn:global.relay.metered.ca:443",
            username: "f5baae95181d1a3b2947f791",
            credential: "n67tiC1skstIO4zc",
          },
          {
            urls: "turns:global.relay.metered.ca:443?transport=tcp",
            username: "f5baae95181d1a3b2947f791",
            credential: "n67tiC1skstIO4zc",
          },
        ],
      });
      
      // Create a new Viewer object and store it
      const viewer = new Viewer(socket.id, viewerPC);
      
      // Set preferred quality if specified
      if (data.preferredQuality) {
        viewer.preferredQuality = data.preferredQuality;
        log(`Viewer ${socket.id} requested quality: ${viewer.preferredQuality}`);
      }
      
      // Add this viewer to our map
      viewers.set(socket.id, viewer);
      
      // Handle ICE candidate events
      viewerPC.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('viewer_ice_candidate', event.candidate);
        }
      };
      
      // Log connection state changes for debugging
      viewerPC.onconnectionstatechange = () => {
        log(`Viewer ${socket.id} connection state: ${viewerPC.connectionState}`);
        if (viewerPC.connectionState === 'connected') {
          log(`Viewer ${socket.id} fully connected!`);
        }
      };
      
      viewerPC.oniceconnectionstatechange = () => {
        log(`Viewer ${socket.id} ICE connection state: ${viewerPC.iceConnectionState}`);
        
        // Update network stats for quality adaptation when ICE connection is complete
        if (viewerPC.iceConnectionState === 'connected' || viewerPC.iceConnectionState === 'completed') {
          scheduleNetworkStatsUpdate(socket.id);
        }
      };
      
      // Check if we have tracks to send
      let tracksAdded = false;
      
      if (broadcasterStream && broadcasterStream.getTracks().length > 0) {
        log(`Adding ${broadcasterStream.getTracks().length} tracks to viewer ${socket.id}`);
        
        // Important: Clone the MediaStream to ensure proper handling
        const viewerStream = new wrtc.MediaStream();
        
        // Add all tracks from broadcaster stream to viewer stream and peer connection
        broadcasterStream.getTracks().forEach(track => {
          log(`Adding ${track.kind} track to viewer ${socket.id}`);
          
          // If simulcast is enabled and this is a video track, we need special handling
          if (simulcastEnabled && track.kind === 'video') {
            // For simulcast, we need to set specific parameters in the transceiver
            const transceiver = viewerPC.addTransceiver(track, {
              direction: 'sendonly',
              streams: [viewerStream]
            });
            
            // Store the transceiver for later quality changes
            viewer.transceivers.push(transceiver);
            
            // Determine initial quality based on user preference
            const initialQuality = viewer.preferredQuality === 'auto' ? 
              'high' : viewer.preferredQuality;
              
            log(`Setting initial quality for viewer ${socket.id} to ${initialQuality}`);
            viewer.activeLayer = initialQuality;
            
            // Note: Further quality selection will happen after the connection is established
          } else {
            // For audio or when simulcast is disabled, add track normally
            viewerPC.addTrack(track, viewerStream);
          }
          
          tracksAdded = true;
        });
      }
      
      if (!tracksAdded) {
        log('No tracks available to add to the viewer connection');
        socket.emit('error', { message: 'No broadcast stream available yet. Please try again in a moment.' });
        viewers.delete(socket.id);
        return;
      }
      
      // Create offer for viewer
      const offer = await viewerPC.createOffer();
      await viewerPC.setLocalDescription(offer);
      
      // Send offer to viewer
      socket.emit('viewer_offer', viewerPC.localDescription);
      
      // Send simulcast status to viewer
      socket.emit('simulcast_status', {
        enabled: simulcastEnabled,
        layers: simulcastLayers
      });
      
      // Notify broadcaster of new viewer count
      if (broadcaster) {
        io.to(broadcaster).emit('viewer_count', viewers.size);
      }
    } catch (error) {
      console.error('Error setting up viewer connection:', error);
      socket.emit('error', { message: 'Failed to establish viewer connection' });
      viewers.delete(socket.id);
    }
  });

  // Handle answer from viewer
  socket.on('viewer_answer', async (description) => {
    const viewer = viewers.get(socket.id);
    if (!viewer) return;
    
    try {
      await viewer.peerConnection.setRemoteDescription(description);
      log(`Viewer ${socket.id} answer processed successfully`);
    } catch (error) {
      console.error('Error setting viewer remote description:', error);
    }
  });

  // Handle ICE candidates from viewer
  socket.on('viewer_ice_candidate', (candidate) => {
    const viewer = viewers.get(socket.id);
    if (!viewer) return;
    
    try {
      viewer.peerConnection.addIceCandidate(new wrtc.RTCIceCandidate(candidate));
    } catch (error) {
      console.error('Error adding viewer ICE candidate:', error);
    }
  });
  
  // Handle quality change requests from viewers
  socket.on('quality_change', (data) => {
    const viewer = viewers.get(socket.id);
    if (!viewer || !simulcastEnabled) return;
    
    try {
      const newQuality = data.quality;
      log(`Viewer ${socket.id} requested quality change to: ${newQuality}`);
      
      viewer.preferredQuality = newQuality;
      
      // If auto, we'll determine the best quality based on network conditions
      // Otherwise, apply the specific quality selected by the user
      if (newQuality !== 'auto') {
        applyQualityForViewer(socket.id, newQuality);
      } else {
        // For auto, determine the best quality based on current network stats
        const bestQuality = viewer.determineOptimalQuality();
        applyQualityForViewer(socket.id, bestQuality);
      }
      
      // Acknowledge the quality change
      socket.emit('quality_changed', { quality: newQuality });
    } catch (error) {
      console.error('Error handling quality change:', error);
    }
  });

  // Handle disconnections
  socket.on('disconnect', () => {
    log(`Client disconnected: ${socket.id}`);
    
    if (socket.id === broadcaster) {
      log('Broadcaster disconnected');
      broadcaster = null;
      
      // Clean up broadcaster peer connection
      if (socket.peerConnection) {
        socket.peerConnection.close();
        delete socket.peerConnection;
      }
      
      // Clear broadcaster stream
      if (broadcasterStream) {
        broadcasterStream.getTracks().forEach(track => track.stop());
        broadcasterStream = null;
      }
      
      // Reset simulcast status
      simulcastEnabled = false;
      simulcastLayers = [];
      
      // Notify all viewers that the broadcaster is gone
      io.emit('broadcaster_disconnected');
      
      // Close all viewer connections
      viewers.forEach((viewer) => {
        viewer.peerConnection.close();
      });
      viewers.clear();
    } else if (viewers.has(socket.id)) {
      log(`Viewer disconnected: ${socket.id}`);
      
      // Clean up viewer peer connection
      const viewer = viewers.get(socket.id);
      if (viewer.peerConnection) {
        viewer.peerConnection.close();
      }
      viewers.delete(socket.id);
      
      // Notify broadcaster of updated viewer count
      if (broadcaster) {
        io.to(broadcaster).emit('viewer_count', viewers.size);
      }
    }
  });
  
  // Helper function to schedule network stats collection and quality adaptation
  function scheduleNetworkStatsUpdate(viewerId) {
    const viewer = viewers.get(viewerId);
    if (!viewer || !simulcastEnabled) return;
    
    // Store last values for delta calculations
    if (!viewer.lastStats) {
      viewer.lastStats = {
        bytesReceived: 0,
        timestamp: Date.now(),
        packetsReceived: 0,
        packetsLost: 0
      };
    }
    
    setTimeout(async () => {
      try {
        if (!viewers.has(viewerId)) return; // Viewer may have disconnected
        
        // Collect stats for network quality assessment
        const stats = await viewer.peerConnection.getStats();
        let totalBytesReceived = 0;
        let totalPacketsReceived = 0;
        let totalPacketsLost = 0;
        let currentRtt = 0;
        const currentTimestamp = Date.now();
        
        stats.forEach(stat => {
          // For inbound data (from broadcaster to viewer)
          if (stat.type === 'inbound-rtp' && stat.kind === 'video') {
            totalBytesReceived += stat.bytesReceived || 0;
            totalPacketsReceived += stat.packetsReceived || 0;
            if (typeof stat.packetsLost === 'number') {
              totalPacketsLost += stat.packetsLost;
            }
          }
          
          // Look for remote-inbound-rtp for round trip time
          if (stat.type === 'remote-inbound-rtp') {
            if (typeof stat.roundTripTime === 'number') {
              currentRtt = Math.max(currentRtt, stat.roundTripTime);
            }
          }
          
          // Also check transport stats which can be more reliable
          if (stat.type === 'transport') {
            if (stat.bytesReceived) {
              totalBytesReceived = Math.max(totalBytesReceived, stat.bytesReceived);
            }
          }
        });
        
        // Calculate delta values since last measurement
        const bytesDelta = totalBytesReceived - viewer.lastStats.bytesReceived;
        const timeDelta = currentTimestamp - viewer.lastStats.timestamp;
        const packetsDelta = totalPacketsReceived - viewer.lastStats.packetsReceived;
        const packetsLostDelta = Math.max(0, totalPacketsLost - viewer.lastStats.packetsLost);
        
        // Calculate metrics
        let bitrate = 0;
        let packetLoss = 0;
        
        if (timeDelta > 0 && bytesDelta >= 0) {
          // Calculate bitrate in kbps
          bitrate = Math.round((bytesDelta * 8) / (timeDelta / 1000) / 1000);
        }
        
        const totalPacketsDelta = packetsDelta + packetsLostDelta;
        if (totalPacketsDelta > 0) {
          packetLoss = (packetsLostDelta / totalPacketsDelta) * 100;
        }
        
        // Store current values for next calculation
        viewer.lastStats = {
          bytesReceived: totalBytesReceived,
          timestamp: currentTimestamp,
          packetsReceived: totalPacketsReceived,
          packetsLost: totalPacketsLost
        };
        
        // Update viewer's network stats
        viewer.updateNetworkStats({
          bitrate,
          packetLoss,
          rtt: currentRtt * 1000 // Convert to ms
        });
        
        log(`Viewer ${viewerId} network stats: ${bitrate} kbps, ${packetLoss.toFixed(1)}% loss, ${(currentRtt * 1000).toFixed(0)}ms RTT`);
        
        // If auto quality is selected, determine and apply optimal quality
        if (viewer.preferredQuality === 'auto') {
          const optimalQuality = viewer.determineOptimalQuality();
          
          // Only apply if quality would change
          if (optimalQuality !== viewer.activeLayer) {
            log(`Auto-selecting ${optimalQuality} quality for viewer ${viewerId} based on network stats`);
            applyQualityForViewer(viewerId, optimalQuality);
          }
        }
        
        // Schedule next update
        scheduleNetworkStatsUpdate(viewerId);
      } catch (error) {
        console.error(`Error updating network stats for viewer ${viewerId}:`, error);
        
        // Still schedule the next update even if this one failed
        scheduleNetworkStatsUpdate(viewerId);
      }
    }, 3000); // Check every 3 seconds
  }
  
  // Helper function to apply specific quality to a viewer
  function applyQualityForViewer(viewerId, quality) {
    const viewer = viewers.get(viewerId);
    if (!viewer || !simulcastEnabled) return;
    
    try {
      // The proper way to implement simulcast layer selection depends on the 
      // specific wrtc library being used and its support for simulcast
      
      // For server-side WebRTC implementations, there are multiple approaches:
      
      // 1. SDP filtering approach - modify the SDP to include only the desired layers
      // 2. RTP header extension approach - use RTP header extensions to signal preferences
      // 3. RTCP feedback approach - send RTCP feedback to control layers
      
      // Since we don't have direct access to these low-level APIs in most wrtc implementations,
      // we'll implement a simple version that works with basic simulcast support
      
      // Map quality levels to simulcast layer indices
      const layerMapping = {
        'high': 0,    // First layer (highest quality)
        'medium': 1,  // Second layer
        'low': 2      // Third layer (lowest quality)
      };
      
      // In a full implementation, we would set parameters on the sender
      // For now, we'll just log what we would do
      log(`Applied ${quality} quality (layer index: ${layerMapping[quality]}) for viewer ${viewerId}`);
      
      // Update the active layer
      viewer.activeLayer = quality;
      
      // Send a request to the broadcaster to prioritize the selected layer
      // This is a custom signal that would need to be handled by the broadcaster
      if (broadcaster) {
        io.to(broadcaster).emit('layer_preference', {
          viewerId: viewerId,
          quality: quality,
          layerIndex: layerMapping[quality]
        });
      }
      
      // Notify viewer of quality change
      io.to(viewerId).emit('quality_changed', { quality });
    } catch (error) {
      console.error(`Error setting quality for viewer ${viewerId}:`, error);
    }
  }

  // Helper function to update all viewers with current broadcaster stream
  function updateAllViewers() {
    if (!broadcasterStream || broadcasterStream.getTracks().length === 0) {
      log('No broadcaster stream available to update viewers');
      return;
    }
    
    log(`Updating all viewers with ${broadcasterStream.getTracks().length} tracks`);
    
    viewers.forEach((viewer, viewerId) => {
      try {
        const viewerPC = viewer.peerConnection;
        
        // Get current senders
        const senders = viewerPC.getSenders();
        const existingKinds = senders.map(sender => sender.track?.kind).filter(Boolean);
        
        // Check each track from broadcaster
        broadcasterStream.getTracks().forEach(track => {
          if (!existingKinds.includes(track.kind)) {
            log(`Adding ${track.kind} track to existing viewer ${viewerId}`);
            
            // Handle simulcast for video tracks
            if (simulcastEnabled && track.kind === 'video') {
              const transceiver = viewerPC.addTransceiver(track, {
                direction: 'sendonly',
                streams: [new wrtc.MediaStream()]
              });
              
              viewer.transceivers.push(transceiver);
              
              // Apply initial quality
              const initialQuality = viewer.preferredQuality === 'auto' ? 
                'high' : viewer.preferredQuality;
              
              viewer.activeLayer = initialQuality;
            } else {
              // For audio or when simulcast is disabled
              const stream = new wrtc.MediaStream();
              stream.addTrack(track);
              viewerPC.addTrack(track, stream);
            }
          }
        });
        
        // Notify this viewer about simulcast status
        io.to(viewerId).emit('simulcast_status', {
          enabled: simulcastEnabled,
          layers: simulcastLayers
        });
      } catch (error) {
        console.error(`Error updating viewer ${viewerId}:`, error);
      }
    });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  log(`Server running on port ${PORT}`);
  log(`Broadcast page: http://localhost:${PORT}/broadcast`);
  log(`Viewer page: http://localhost:${PORT}/view`);
});