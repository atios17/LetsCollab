import React, { useState, useEffect, useRef } from 'react';
import './index.css';

const App = () => {
  // State hooks for managing the application's UI and data.
  // documentContent: The current content of the collaborative text area.
  const [documentContent, setDocumentContent] = useState('');
  // userId: The unique identifier for the current user once a username is accepted.
  const [userId, setUserId] = useState('');
  // usernameInput: The value of the username input field.
  const [usernameInput, setUsernameInput] = useState('');
  // isUsernameApproved: A flag to switch between the username entry screen and the main editor.
  const [isUsernameApproved, setIsUsernameApproved] = useState(false);
  // activeUsers: An array of user objects representing all connected clients.
  const [activeUsers, setActiveUsers] = useState([]);
  // error: Any error message to display to the user.
  const [error, setError] = useState('');

  // useRef hooks to persist values across renders without causing re-renders.
  // previousContentRef: Stores the content of the document from the last state update, used for diffing.
  const previousContentRef = useRef('');
  // ws: A reference to the WebSocket connection instance.
  const ws = useRef(null);

  // useEffect hook to handle WebSocket connection and cleanup.
  useEffect(() => {
    // Establish a new WebSocket connection to the server.
    ws.current = new WebSocket('ws://localhost:8080');

    // WebSocket event listeners.
    ws.current.onopen = () => {
      console.log('WebSocket connected');
    };

    ws.current.onmessage = (event) => {
      // Parse the incoming JSON message from the server.
      const message = JSON.parse(event.data);
      // Handle different message types received from the server.
      switch (message.type) {
        case 'usernameAccepted':
          // If the username is accepted, set the user ID and switch to the editor view.
          setUserId(message.userId);
          setIsUsernameApproved(true);
          break;
        case 'usernameRejected':
          // If the username is rejected, display an error message.
          setError('Username already taken. Please choose another one.');
          break;
        case 'documentUpdate':
          // Update the document content with the latest version from the server.
          setDocumentContent(message.content);
          // Also, update the ref to track the content for future diffing.
          previousContentRef.current = message.content;
          break;
        case 'userListUpdate':
          // Update the list of active users.
          setActiveUsers(message.users);
          break;
        default:
          console.log('Unknown message type:', message.type);
      }
    };

    ws.current.onclose = () => console.log('WebSocket disconnected');
    ws.current.onerror = (error) => console.error('WebSocket error:', error);

    // Cleanup function: Closes the WebSocket connection when the component unmounts.
    return () => {
      if (ws.current) ws.current.close();
    };
  }, []); // Empty dependency array ensures this effect runs only once on component mount.

  // --- Event Handlers ---

  /**
   * Handles the "Join" button click to check the desired username with the server.
   */
  const handleJoin = () => {
    const trimmedName = usernameInput.trim();
    // Validate that the username is not empty.
    if (!trimmedName) {
      setError('Username cannot be empty.');
      return;
    }
    // If the WebSocket connection is open, send a 'checkUsername' message to the server.
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: 'checkUsername', username: trimmedName }));
    }
  };

  /**
   * Handles changes to the textarea, calculates the diff, and broadcasts the changes.
   * @param {object} event - The change event from the textarea.
   */
  const handleDocumentChange = (event) => {
    const newContent = event.target.value;
    setDocumentContent(newContent);

    // Split the previous and new content into lines to find what changed.
    const oldLines = previousContentRef.current.split('\n');
    const newLines = newContent.split('\n');

    // Find all line numbers that have been modified.
    const changedLines = [];
    newLines.forEach((line, index) => {
      // Check if the line exists and if its content has changed.
      if (line !== oldLines[index]) {
        changedLines.push(index);
      }
    });

    // Update the ref with the new content for the next change event's comparison.
    previousContentRef.current = newContent;

    // If the WebSocket is open and there are changes, send an 'edit' message to the server.
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        type: 'edit',
        userId,
        content: newContent,
        changedLines
      }));
    }
  };

  // --- Conditional Rendering ---

  // Renders the username entry screen if the user has not been approved yet.
  if (!isUsernameApproved) {
    return (
      <div className="username-entry-container">
        <div className="username-entry-card">
          <h2 className="username-title">Enter Your Username</h2>
          <input
            type="text"
            value={usernameInput}
            onChange={(e) => {
              setUsernameInput(e.target.value);
              // Clear any previous error when the user starts typing.
              setError('');
            }}
            placeholder="Choose a unique username"
            className="username-input"
          />
          <button onClick={handleJoin} className="username-join-button">
            Join
          </button>
          {/* Display an error message if one exists. */}
          {error && <p className="username-error">{error}</p>}
        </div>
      </div>
    );
  }

  // Renders the main editor UI once the username is approved.
  return (
    <div className="full-editor-container">
      <div className="top-bar">
        <h1 className="app-title">BrainLoop</h1>
        <h5> Connect. Create. Collaborate.</h5>
        <div className="top-bar-info">
          <span className="user-info">You are: <span className="user-id">{userId}</span></span>
          <div className="active-users">
            {/* Map over the activeUsers array to display an avatar for each user. */}
            {activeUsers.map((user) => (
              <div
                key={user.id}
                className="user-avatar"
                style={{ backgroundColor: user.color }}
                title={user.id}
              >
                {/* Display the first letter of the user's ID. */}
                {user.id.charAt(0)}
              </div>
            ))}
          </div>
        </div>
      </div>

      <textarea
        className="full-editor-textarea"
        value={documentContent}
        onChange={handleDocumentChange}
        spellCheck="false"
        placeholder="Start typing..."
      />
    </div>
  );
};

export default App;