// Import necessary modules
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

// Initialize Express app and HTTP server
const app = express();
const server = http.createServer(app);

// Initialize WebSocket server attached to the HTTP server
const wss = new WebSocket.Server({ server });

// Middleware setup
// Enable Cross-Origin Resource Sharing for all origins
app.use(cors());
// Parse incoming JSON payloads
app.use(express.json());

// --- Core Logic & State Management ---

/**
 * Utility function to generate a random color for a user's avatar.
 * @returns {string} A hex color code.
 */
const getRandomColor = () => {
  const colors = ['#EF4444', '#F97316', '#EAB308', '#22C55E', '#0EA5E9', '#6366F1', '#EC4899'];
  return colors[Math.floor(Math.random() * colors.length)];
};

// In-memory state for the collaborative document and connected users
// The shared document content as a single string
let sharedDocumentContent = '';
// A Map to store active users, mapping each WebSocket connection to a user object
let activeUsersMap = new Map();
// An object to track which user last edited a specific line number
let lineEdits = {}; // e.g., { 0: { userId: 'alice', color: '#FF0' } }

/**
 * Broadcasts the current list of active users to all connected clients.
 */
const broadcastUserList = () => {
  // Convert the Map of users to an array for easier client-side handling
  const usersArray = Array.from(activeUsersMap.values());
  // Iterate over all connected clients and send the user list
  wss.clients.forEach(client => {
    // Ensure the connection is open before sending
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'userListUpdate', users: usersArray }));
    }
  });
};

/**
 * Broadcasts the line attribution data (who last edited which line) to all clients.
 */
const broadcastLineAttribution = () => {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'lineAttributionUpdate', lineEdits }));
    }
  });
};

// --- WebSocket Event Handling ---

// Event handler for new client connections
wss.on('connection', ws => {
  console.log('Client connected');

  // On new connection, send the initial state of the document and attribution
  ws.send(JSON.stringify({ type: 'documentUpdate', content: sharedDocumentContent }));
  // Also, broadcast the current user list and line attributions to ensure everyone is synced
  broadcastUserList();
  broadcastLineAttribution();

  // Event handler for messages from the client
  ws.on('message', message => {
    // Parse the incoming JSON message
    const parsed = JSON.parse(message);
    console.log('Received:', parsed);

    // Handle different message types using a switch statement
    switch (parsed.type) {
      // Handles a client requesting a username
      case 'checkUsername': {
        const desired = parsed.username.trim();
        // Check if the username is already taken by an active user
        const isTaken = Array.from(activeUsersMap.values()).some(user => user.id === desired);

        if (!desired || isTaken) {
          // Reject the username if it's empty or taken
          ws.send(JSON.stringify({ type: 'usernameRejected' }));
        } else {
          // If available, accept the username, create a user object, and store it
          const user = { id: desired, color: getRandomColor() };
          activeUsersMap.set(ws, user); // Map the WebSocket connection to the new user
          ws.send(JSON.stringify({ type: 'usernameAccepted', userId: desired }));
          // Notify all clients of the new user
          broadcastUserList();
          broadcastLineAttribution();
        }
        break;
      }

      // Handles document edits from a client
      case 'edit': {
        // Update the in-memory document with the new content
        sharedDocumentContent = parsed.content;
        const { changedLines, userId } = parsed;

        // Update the line attribution for each line that was changed
        changedLines.forEach(lineNum => {
          // Find the user object corresponding to the userId
          const user = Array.from(activeUsersMap.values()).find(u => u.id === userId);
          if (user) {
            // Assign the line to the user who made the edit
            lineEdits[lineNum] = { userId: user.id, color: user.color };
          }
        });

        // Broadcast the updated document to all clients
        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'documentUpdate', content: sharedDocumentContent }));
          }
        });

        // Broadcast the updated line attributions
        broadcastLineAttribution();
        break;
      }

      // Default case for any unknown message types
      default:
        console.log('Unknown message type:', parsed.type);
    }
  });

  // Event handler for client disconnections
  ws.on('close', () => {
    console.log('Client disconnected');
    // Remove the user from the active users map
    if (activeUsersMap.has(ws)) {
      activeUsersMap.delete(ws);
      // Broadcast the updated user list to all remaining clients
      broadcastUserList();
    }
  });

  // Event handler for WebSocket errors
  ws.on('error', error => {
    console.error('WebSocket error:', error);
  });
});

// --- Server Startup ---

// Define the port for the server
const PORT = process.env.PORT || 8080;
// Start the server and listen on the specified port
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});