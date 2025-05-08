/**
 * State Manager with Time Travel
 * Includes get/set nested properties with string paths and history tracking
 */
class StateManager {
    constructor(initialState = {}) {
      this._currentState = JSON.parse(JSON.stringify(initialState));
      this._history = [JSON.parse(JSON.stringify(initialState))];
      this._currentIndex = 0;
    }
  
    /**
     * Get a value from the state using a path string
     * @param {string} path - Path to the value (e.g., 'a' or 'nested.key.subkey')
     * @returns {*} - Value at the path or empty string if not found
     */
    get(path) {
      if (!path) return '';
      
      const keys = path.split('.');
      let result = this._currentState;
      
      for (const key of keys) {
        if (result === undefined || result === null || !Object.prototype.hasOwnProperty.call(result, key)) {
          return '';
        }
        result = result[key];
      }
      
      return result !== undefined && result !== null ? result : '';
    }
  
    /**
     * Set a value in the state using a path string
     * @param {string} path - Path to set (e.g., 'a' or 'nested.key.subkey')
     * @param {*} value - Value to set at the path
     * @returns {object} - The updated state
     */
    set(path, value) {
      if (!path) return this._currentState;
      
      // Create a new state to avoid mutating history
      const newState = JSON.parse(JSON.stringify(this._currentState));
      
      const keys = path.split('.');
      let current = newState;
      
      // Navigate through the object, creating keys as needed
      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        // Create the property if it doesn't exist
        if (!current[key] || typeof current[key] !== 'object') {
          current[key] = {};
        }
        current = current[key];
      }
      
      // Set the final value
      const lastKey = keys[keys.length - 1];
      current[lastKey] = value;
      
      // Update the current state
      this._currentState = newState;
      
      // Add to history, removing any future states if we're not at the end
      this._history = this._history.slice(0, this._currentIndex + 1);
      this._history.push(JSON.parse(JSON.stringify(newState)));
      this._currentIndex = this._history.length - 1;
      
      return this._currentState;
    }
  
    /**
     * Get the current state
     * @returns {object} - Current state
     */
    getState() {
      return JSON.parse(JSON.stringify(this._currentState));
    }
  
    /**
     * Check if we can go back in history
     * @returns {boolean} - True if we can go back
     */
    canUndo() {
      return this._currentIndex > 0;
    }
  
    /**
     * Check if we can go forward in history
     * @returns {boolean} - True if we can go forward
     */
    canRedo() {
      return this._currentIndex < this._history.length - 1;
    }
  
    /**
     * Go back in history
     * @returns {object} - The state after going back, or current state if can't go back
     */
    undo() {
      if (this.canUndo()) {
        this._currentIndex--;
        this._currentState = JSON.parse(JSON.stringify(this._history[this._currentIndex]));
      }
      return this.getState();
    }
  
    /**
     * Go forward in history
     * @returns {object} - The state after going forward, or current state if can't go forward
     */
    redo() {
      if (this.canRedo()) {
        this._currentIndex++;
        this._currentState = JSON.parse(JSON.stringify(this._history[this._currentIndex]));
      }
      return this.getState();
    }
  
    /**
     * Go to a specific point in history
     * @param {number} index - The history index to go to
     * @returns {object} - The state at that index, or current state if index is invalid
     */
    goToState(index) {
      if (index >= 0 && index < this._history.length) {
        this._currentIndex = index;
        this._currentState = JSON.parse(JSON.stringify(this._history[this._currentIndex]));
      }
      return this.getState();
    }
  
    /**
     * Get all history states
     * @returns {Array} - Array of all states in history
     */
    getHistory() {
      return this._history.map(state => JSON.parse(JSON.stringify(state)));
    }
  
    /**
     * Get the current history index
     * @returns {number} - Current index in history
     */
    getCurrentIndex() {
      return this._currentIndex;
    }
  }
  
  // Example usage:
  const initialState = {
    a: 1,
    b: 2,
    c: 3,
    mesaj: 'hello world',
    postfix: '!'
  };
  
  // Create a state manager instance
  const stateManager = new StateManager(initialState);
  
  // Example operations
  console.log("Initial state:", stateManager.getState());
  
  stateManager.set('a', 42);
  console.log("After setting a=42:", stateManager.getState());
  
  stateManager.set('nested.deeply.value', 'I am nested');
  console.log("After setting nested value:", stateManager.getState());
  console.log("Get nested value:", stateManager.get('nested.deeply.value'));
  
  stateManager.set('b', 100);
  console.log("After setting b=100:", stateManager.getState());
  
  // Time travel - undo
  console.log("Can undo?", stateManager.canUndo());
  if (stateManager.canUndo()) {
    console.log("After undo:", stateManager.undo());
  }
  
  // Time travel - undo again
  if (stateManager.canUndo()) {
    console.log("After second undo:", stateManager.undo());
  }
  
  // Time travel - redo
  console.log("Can redo?", stateManager.canRedo());
  if (stateManager.canRedo()) {
    console.log("After redo:", stateManager.redo());
  }
  
  // See all history
  console.log("History:", stateManager.getHistory());
  console.log("Current history index:", stateManager.getCurrentIndex());
  
  // Jump to specific state
  console.log("Jump to first state:", stateManager.goToState(0));