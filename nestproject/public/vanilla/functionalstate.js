function StateManager(initialState = {}) {
  // Private state
  const _currentState = JSON.parse(JSON.stringify(initialState));
  const _history = [JSON.parse(JSON.stringify(initialState))];
  let _currentIndex = 0;

  // Return the public API
  return {
    get(path) {
      if (!path) return '';
      
      const keys = path.split('.');
      let result = _currentState;
      
      for (const key of keys) {
        if (result === undefined || result === null || !Object.prototype.hasOwnProperty.call(result, key)) {
          return '';
        }
        result = result[key];
      }
      
      return result !== undefined && result !== null ? result : '';
    },

    set(path, value) {
      if (!path) return _currentState;

      const newState = JSON.parse(JSON.stringify(_currentState));
      
      const keys = path.split('.');
      let current = newState;
     
      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];

        if (!current[key] || typeof current[key] !== 'object') {
          current[key] = {};
        }
        current = current[key];
      }

      const lastKey = keys[keys.length - 1];
      current[lastKey] = value;

      // Update state
      Object.assign(_currentState, newState);

      // Update history
      _history.splice(_currentIndex + 1);
      _history.push(JSON.parse(JSON.stringify(_currentState)));
      _currentIndex = _history.length - 1;
      
      return this.getState();
    },

    getState() {
      return JSON.parse(JSON.stringify(_currentState));
    },

    canUndo() {
      return _currentIndex > 0;
    },

    canRedo() {
      return _currentIndex < _history.length - 1;
    },

    undo() {
      if (this.canUndo()) {
        _currentIndex--;
        Object.assign(_currentState, JSON.parse(JSON.stringify(_history[_currentIndex])));
      }
      return this.getState();
    },

    redo() {
      if (this.canRedo()) {
        _currentIndex++;
        Object.assign(_currentState, JSON.parse(JSON.stringify(_history[_currentIndex])));
      }
      return this.getState();
    },

    goToState(index) {
      if (index >= 0 && index < _history.length) {
        _currentIndex = index;
        Object.assign(_currentState, JSON.parse(JSON.stringify(_history[_currentIndex])));
      }
      return this.getState();
    },

    getHistory() {
      return _history.map(state => JSON.parse(JSON.stringify(state)));
    },

    getCurrentIndex() {
      return _currentIndex;
    }
  };
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
const stateManager = StateManager(initialState);

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