/**
 * GlobalPauseResumeManager: A singleton manager for handling pause and resume operations
 * across all FlowManager instances. It allows workflows to request human intervention
 * (or any external asynchronous process) and for an external UI layer (or any service)
 * to respond and resume the flow.
 * This version uses a custom, environment-agnostic event bus for communication about pause/resume events.
 *
 * Design Pattern: Singleton (achieved via an IIFE - Immediately Invoked Function Expression).
 * This ensures there's only one instance of this manager, centralizing all pause/resume states.
 */
const GlobalPauseResumeManager = (function() {
    // _pausedFlows: Stores active pause states. This is the core data structure holding
    // information about all currently paused workflows.
    // Key: pauseId (string) - A unique identifier for each pause request.
    // Value: {
    //   resolve: Function, // The `resolve` function of the Promise created by `requestPause`. Calling this resumes the workflow.
    //   details: any,      // Arbitrary data provided by the workflow when requesting the pause, useful for the external system.
    //   flowInstanceId: string // The ID of the FlowManager instance that initiated this pause.
    // }
    const _pausedFlows = new Map();

    // _listeners: Stores event listeners for the custom event bus.
    // This allows different parts of an application (e.g., a UI) to react to
    // events like 'flowPaused', 'flowResumed', or 'resumeFailed'.
    // Key: eventName (string) - The name of the event (e.g., 'flowPaused').
    // Value: Array of callback functions - Functions to be executed when the event is emitted.
    const _listeners = {};

    // _pauseIdCounter: A simple counter to help ensure uniqueness of generated pause IDs,
    // especially when combined with a timestamp and a prefix.
    let _pauseIdCounter = 0;

    /**
     * Generates a unique ID for a pause request.
     * Uniqueness is important to correctly identify and resume specific paused flows.
     * The ID combines a prefix (often related to the flow instance), the current timestamp,
     * and an incrementing counter to minimize collision chances.
     *
     * @param {string} [prefix='pause'] - A prefix for the ID, useful for context (e.g., flowInstanceId).
     * @returns {string} A unique pause ID (e.g., "flow-abc-1678886400000-1").
     */
    function generatePauseId(prefix = 'pause') {
        _pauseIdCounter++;
        return `${prefix}-${Date.now()}-${_pauseIdCounter}`;
    }

    // The public API of the GlobalPauseResumeManager.
    return {
        /**
         * Emits an event to all registered listeners for that event type.
         * This is the core mechanism of the custom event bus.
         * It's an internal helper method, prefixed with an underscore, but exposed for potential advanced usage or testing.
         *
         * @param {string} eventName - The name of the event to emit (e.g., 'flowPaused').
         * @param {object} eventData - The data object to be passed to each listener.
         */
        _emitEvent(eventName, eventData) {
            // console.debug(`[GlobalPauseResumeManager] Emitting event: ${eventName}`, eventData); // Useful for debugging.
            if (_listeners[eventName]) {
                // Iterate over a copy of the listeners array in case a listener modifies the array (e.g., removes itself).
                _listeners[eventName].slice().forEach(callback => {
                    try {
                        // Pass the eventData object directly to the callback.
                        callback(eventData);
                    } catch (e) {
                        console.error(`[GlobalPauseResumeManager] Error in listener for ${eventName}:`, e);
                        // Execution continues to other listeners even if one fails.
                    }
                });
            }
        },

        /**
         * Adds an event listener for specific pause/resume lifecycle events.
         * This allows external systems (like UIs) to be notified when flows are paused,
         * resumed, or when a resume attempt fails.
         *
         * @param {string} eventName - The event to listen for. Expected values: 'flowPaused', 'flowResumed', 'resumeFailed'.
         * @param {Function} callback - The function to call when the event occurs.
         *                             The callback will receive an `eventData` object specific to the event.
         *                             For 'flowPaused': { pauseId, details, flowInstanceId }
         *                             For 'flowResumed': { pauseId, resumeData, details, flowInstanceId }
         *                             For 'resumeFailed': { pauseId, reason, flowInstanceId? }
         */
        addEventListener(eventName, callback) {
            if (typeof callback !== 'function') {
                console.error('[GlobalPauseResumeManager] addEventListener: callback must be a function.');
                return;
            }
            if (!_listeners[eventName]) {
                _listeners[eventName] = []; // Initialize array if this is the first listener for this event.
            }
            _listeners[eventName].push(callback);
        },

        /**
         * Removes an event listener that was previously added.
         * It's important to remove listeners when they are no longer needed to prevent memory leaks
         * and unintended behavior.
         *
         * @param {string} eventName - The name of the event from which to remove the listener.
         * @param {Function} callback - The specific callback function to remove. Must be the same function reference.
         */
        removeEventListener(eventName, callback) {
            if (_listeners[eventName]) {
                // Filter out the specified callback.
                _listeners[eventName] = _listeners[eventName].filter(cb => cb !== callback);
            }
        },

        /**
         * Called by a FlowManager node (typically via a `this.humanInput` method within a node's function)
         * to pause the workflow's execution and wait for external input.
         *
         * @param {object} options - Options for the pause request.
         * @param {string} [options.pauseId] - A user-suggested ID for this pause. If provided and unique, it will be used.
         *                                     Otherwise, a unique ID will be generated. Useful for idempotent pause requests
         *                                     or pre-determined pause points.
         * @param {any} [options.details] - Data/details about why the pause is needed. This information is passed
         *                                  to listeners of the 'flowPaused' event and can be displayed by a UI.
         * @param {string} options.flowInstanceId - The ID of the FlowManager instance initiating the pause. This helps
         *                                          in identifying the source of the pause.
         * @returns {Promise<any>} A promise that resolves with the `resumeData` when the `resume()` method
         *                         is called for this `pauseId`. The workflow execution effectively `await`s this promise.
         */
        requestPause({ pauseId: customPauseId, details, flowInstanceId }) {
            // Return a new Promise. The `resolve` function of this promise is stored,
            // and will be called by the `resume()` method later.
            return new Promise((resolve) => {
                // Determine the pauseId: use custom if valid and unique, otherwise generate one.
                // A prefix related to the flow instance makes logs and tracking easier.
                const pauseId = (customPauseId && !_pausedFlows.has(customPauseId))
                                ? customPauseId
                                : generatePauseId(flowInstanceId || 'flow');

                if (_pausedFlows.has(pauseId) && customPauseId) {
                    // This case implies a potential issue: a customPauseId was provided but it's already in use.
                    // Overwriting might be intentional in some retry scenarios, but often indicates a logic error
                    // or a non-unique customPauseId. The current behavior is to overwrite.
                    console.warn(`[GlobalPauseResumeManager] Pause ID ${pauseId} (custom) is already active. Overwriting the resolver for ${pauseId}. This might be due to a retry or a non-unique custom ID.`);
                } else if (_pausedFlows.has(pauseId)) {
                    // This should ideally not happen if generatePauseId is robust and not overridden by a non-unique customPauseId.
                    // Indicates a very rare collision or misuse.
                    console.warn(`[GlobalPauseResumeManager] Generated Pause ID ${pauseId} is already active. This is unexpected. Overwriting.`);
                }

                // Store the pause information, including the `resolve` function,
                // so it can be resumed later.
                _pausedFlows.set(pauseId, { resolve, details, flowInstanceId });

                // Emit an event to notify external systems (e.g., UI) that a flow has paused.
                this._emitEvent('flowPaused', { pauseId, details, flowInstanceId });
                console.log(`[GlobalPauseResumeManager] Flow ${flowInstanceId} paused. ID: ${pauseId}. Details: ${JSON.stringify(details)}. Waiting for resume...`);
            });
        },

        /**
         * Called by an external system (e.g., a UI layer or another service) to resume a previously paused flow.
         *
         * @param {string} pauseId - The ID of the pause to resume. This ID must match one provided by `requestPause`.
         * @param {any} resumeData - The data to be passed back to the awaiting `humanInput()` call in the flow.
         *                           This data becomes the resolution value of the promise returned by `requestPause`.
         * @returns {boolean} True if the resume operation was successful (i.e., the pauseId was found and flow resumed),
         *                    false otherwise (e.g., pauseId not found).
         */
        resume(pauseId, resumeData) {
            if (_pausedFlows.has(pauseId)) {
                const { resolve, details, flowInstanceId } = _pausedFlows.get(pauseId);

                // Call the stored `resolve` function with the `resumeData`.
                // This fulfills the promise that the workflow is awaiting, allowing it to continue.
                resolve(resumeData);

                // Remove the pause state from active pauses as it's now being resumed.
                _pausedFlows.delete(pauseId);

                // Emit an event to notify external systems that the flow has been resumed.
                this._emitEvent('flowResumed', { pauseId, resumeData, details, flowInstanceId });
                console.log(`[GlobalPauseResumeManager] Flow ${flowInstanceId} resumed. ID: ${pauseId} with data:`, resumeData);
                return true;
            } else {
                // The specified pauseId does not correspond to an active pause.
                console.warn(`[GlobalPauseResumeManager] No active pause found for ID: ${pauseId}. Cannot resume.`);
                // Emit an event to notify about the failed resume attempt.
                this._emitEvent('resumeFailed', { pauseId, reason: 'No active pause found', resumeDataAttempted: resumeData });
                return false;
            }
        },

        /**
         * Checks if a specific pause ID is currently active (i.e., the flow is paused and waiting).
         *
         * @param {string} pauseId - The pause ID to check.
         * @returns {boolean} True if the pauseId corresponds to an active pause, false otherwise.
         */
        isPaused(pauseId) {
            return _pausedFlows.has(pauseId);
        },

        /**
         * Gets details of all currently active pauses.
         * This is useful for an administrative UI or service to display a list of workflows
         * that are pending human intervention or external action.
         *
         * @returns {Array<object>} An array of objects, where each object represents an active pause
         *                          and contains { pauseId, details, flowInstanceId }.
         */
        getActivePauses() {
            const active = [];
            // Iterate over the _pausedFlows Map to construct the array.
            _pausedFlows.forEach(({ details, flowInstanceId }, pauseId) => { // Destructuring value and getting key
                active.push({ pauseId, details, flowInstanceId });
            });
            return active;
        }
    };
})();


/**
 * FlowManager: A powerful and flexible engine for orchestrating complex workflows,
 * particularly well-suited for AI agentic systems. It allows workflows to be defined
 * as serializable JSON-like structures (an array of "nodes"), enabling dynamic generation,
 * persistence, and execution of directed graphs of tasks and decisions.
 *
 * Key Features:
 * - State Management: Each flow has its own isolated state, with history for undo/redo.
 * - Node-based Execution: Workflows are sequences of nodes. Nodes can be functions,
 *   sub-flows (arrays of nodes), conditional branches (objects), or loops.
 * - Asynchronous Operations: Supports async functions and human input pauses.
 * - Extensibility: Node functions can be provided externally (via a `scope` object, implicitly assumed here).
 * - Event-driven Pauses: Integrates with GlobalPauseResumeManager for human-in-the-loop scenarios.
 * - Tracing: Records each step of execution for debugging and auditing.
 *
 * @param {object} config - Configuration for the FlowManager.
 * @param {object} [config.initialState={}] - The initial state object for the workflow. This state can be read and modified by nodes.
 * @param {Array} [config.nodes=[]] - An array defining the workflow's structure. Each element is a "node."
 *                                    Nodes are processed sequentially, but their output can dictate branching or looping.
 * @param {string} [config.instanceId] - An optional unique ID for this FlowManager instance. If not provided, one is generated.
 *                                       Useful for tracking and logging, especially when multiple flows run concurrently
 *                                       or when integrating with GlobalPauseResumeManager.
 * @param {object} [config.scope={}] - An optional object containing named functions that can be referenced by string
 *                                     identifiers within the node definitions. This allows for decoupling node logic
 *                                     from the FlowManager core and defining reusable actions.
 *                                     (Note: `scope` is used in `evaluateNode` but not explicitly passed or stored here,
 *                                     assuming it's available in the closure or globally if this function is part of a larger module.
 *                                     For clarity, it's added to the params doc here.)
 * @returns {object} An API object to run the flow, get execution steps, access state, and get instance ID.
 */
function FlowManager({initialState, nodes, instanceId, scope /* implicitly used, added for doc clarity */}={initialState:{}, nodes:[], instanceId: undefined, scope: {}}) {
  // `steps`: An array that records the execution history of the workflow.
  // Each element represents a processed node and its outcome.
  // Structure: { node: <nodeDefinition>, output: { edges: [...], results: [...] }, subSteps: [...]? }
  const steps = [];

  // `currentNode`: Stores the definition of the node currently being processed.
  let currentNode = null;
  // `currentIndex`: The index in the `nodes` array of the `currentNode`.
  let currentIndex = 0;

  // `flowInstanceId`: A unique identifier for this specific run of the flow.
  // Useful for logging, debugging, and associating pauses with their originating flow.
  const flowInstanceId = instanceId || `fm-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  // `fmState`: An instance of the StateManager, responsible for managing this flow's private state.
  // It handles getting, setting, and history (undo/redo) of the state.
  const fmState = StateManager(initialState);

  // `_resolveRunPromise`, `_rejectRunPromise`: Functions to resolve or reject the main Promise
  // returned by the `run()` method. This manages the overall asynchronous execution of the flow.
  let _resolveRunPromise = null;
  let _rejectRunPromise = null;

  /**
   * Helper function to determine if a given function is an `async function`.
   * This is used to correctly `await` its result.
   * @param {Function} fn - The function to check.
   * @returns {boolean} True if `fn` is an AsyncFunction, false otherwise.
   */
  function isAsyncFunction(fn) {
    if (!fn) return false;
    // Check the constructor name. Reliable in most modern JS environments.
    return fn.constructor && fn.constructor.name === 'AsyncFunction';
  }

  /**
   * StateManager: An inner factory function that creates a state management object.
   * This manager encapsulates the flow's state, providing methods to get, set,
   * and navigate through the history of state changes (undo/redo).
   *
   * @param {object} _initialState - The initial state for this state manager instance.
   * @returns {object} A state management API.
   */
  function StateManager(_initialState = {}) {
    // `_currentState`: A deep copy of the initial state, representing the live state.
    const _currentState = JSON.parse(JSON.stringify(_initialState));
    // `_history`: An array storing snapshots of the state at each modification.
    // The first entry is the initial state.
    const _history = [JSON.parse(JSON.stringify(_initialState))];
    // `_historyCurrentIndex`: Points to the current state within the `_history` array.
    let _historyCurrentIndex = 0;

    return {
      /**
       * withState: A higher-order function that wraps a given function (`fn`)
       * to automatically inject specified parts of the current state as its first argument.
       * This simplifies node functions by giving them direct access to relevant state slices.
       *
       * @param {Function} fn - The function to be wrapped. This function will receive `params` as its first argument.
       * @param {Array<string>} paramNames - An array of strings, where each string is a path (e.g., 'user.name')
       *                                   to a property in the state that should be included in the `params` object.
       * @returns {Function} A new function that, when called, will execute `fn` with injected state parameters.
       */
      withState(fn, paramNames) {
        const smInstance = this; // Capture `this` (the StateManager instance).
        if (isAsyncFunction(fn)) {
          return async function(...args) { // Wrapper for async functions
            const params = (paramNames || []).reduce((acc, name) => {
              // Check if the state actually has this property to avoid injecting undefined.
              if (Object.prototype.hasOwnProperty.call(smInstance.getState(), name)) {
                acc[name] = smInstance.get(name);
              }
              return acc;
            }, {});
            // Call the original function with `this` set to `smInstance`, injected `params`, and original arguments.
            return await fn.call(smInstance, params, ...args);
          };
        } else {
          return function(...args) { // Wrapper for synchronous functions
            const params = (paramNames || []).reduce((acc, name) => {
              if (Object.prototype.hasOwnProperty.call(smInstance.getState(), name)) {
                acc[name] = smInstance.get(name);
              }
              return acc;
            }, {});
            return fn.call(smInstance, params, ...args);
          };
        }
      },

      /**
       * Retrieves a value from the current state using a dot-separated path.
       *
       * @param {string} path - The dot-separated path to the desired value (e.g., 'user.profile.name').
       *                        If path is empty or null, it's an invalid request for a specific value, so returns empty string.
       * @returns {any|string} The value found at the path, or an empty string if the path is not found or invalid.
       */
      get(path) {
        if (!path) return ''; // Handle empty or null path gracefully.
        const keys = path.split('.');
        let result = _currentState;
        for (const key of keys) {
          if (result === undefined || result === null || !Object.prototype.hasOwnProperty.call(result, key)) {
            return ''; // Path segment not found or trying to access property of null/undefined.
          }
          result = result[key];
        }
        return result !== undefined && result !== null ? result : ''; // Return value or empty string if final value is null/undefined.
      },

      /**
       * Sets a value in the current state at a specified dot-separated path.
       * If the path is null or an empty string, it replaces the entire state object.
       * This operation updates the state history for undo/redo.
       *
       * @param {string|null} path - The dot-separated path (e.g., 'user.profile.name') or null/empty to set root state.
       * @param {any} value - The value to set.
       * @returns {any} The value that was set (or the new root state object if path was null/empty).
       */
      set(path, value) {
        let targetStateObject;
        if (path === null || path === '') {
          // Replace the entire state object.
          const newStateParsed = JSON.parse(JSON.stringify(value)); // Deep clone the new value.
          // Clear existing keys from _currentState
          for (const key in _currentState) {
            if (Object.prototype.hasOwnProperty.call(_currentState, key)) {
              delete _currentState[key];
            }
          }
          // Assign new keys
          for (const key in newStateParsed) {
            if (Object.prototype.hasOwnProperty.call(newStateParsed, key)) {
              _currentState[key] = newStateParsed[key];
            }
          }
          targetStateObject = _currentState;
        } else {
          // Set a value at a specific path.
          const newStateCopy = JSON.parse(JSON.stringify(_currentState)); // Work on a copy for intermediate steps.
          let current = newStateCopy;
          const keys = path.split('.');
          for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            // Create nested objects if they don't exist along the path.
            if (!current[key] || typeof current[key] !== 'object') {
              current[key] = {};
            }
            current = current[key];
          }
          const lastKey = keys[keys.length - 1];
          current[lastKey] = value; // Set the value at the final key.
          // Object.assign(_currentState, newStateCopy); // Apply changes to the actual _currentState.
          // More robust way to update _currentState to reflect changes in newStateCopy:
          // Clear existing keys first if the structure could drastically change, or re-assign deeply.
          // For simplicity and common use cases, Object.assign can work if top-level keys don't disappear.
          // A safer way for deep merge:
          Object.keys(_currentState).forEach(key => delete _currentState[key]);
          Object.assign(_currentState, newStateCopy);

          targetStateObject = current[lastKey]; // The actual object/value that was set.
        }

        // Update history: discard any "redo" states and add the new state.
        _history.splice(_historyCurrentIndex + 1);
        _history.push(JSON.parse(JSON.stringify(_currentState))); // Store a deep copy.
        _historyCurrentIndex = _history.length - 1;

        return targetStateObject;
      },

      /**
       * Returns a deep copy of the entire current state object.
       * @returns {object} A clone of the current state.
       */
      getState() { return JSON.parse(JSON.stringify(_currentState)); },

      /**
       * Checks if an "undo" operation is possible (i.e., if not at the beginning of history).
       * @returns {boolean} True if undo is possible, false otherwise.
       */
      canUndo() { return _historyCurrentIndex > 0; },

      /**
       * Checks if a "redo" operation is possible (i.e., if not at the end of history).
       * @returns {boolean} True if redo is possible, false otherwise.
       */
      canRedo() { return _historyCurrentIndex < _history.length - 1; },

      /**
       * Reverts the state to its previous version in the history.
       * @returns {object} The new current state (after undo), or the current state if undo was not possible.
       */
      undo() {
        if (this.canUndo()) {
          _historyCurrentIndex--;
          // Update _currentState to reflect the undone state.
          const historicState = JSON.parse(JSON.stringify(_history[_historyCurrentIndex]));
          Object.keys(_currentState).forEach(key => delete _currentState[key]);
          Object.assign(_currentState, historicState);
        }
        return this.getState();
      },

      /**
       * Applies the next state version from the history (if an undo was performed).
       * @returns {object} The new current state (after redo), or the current state if redo was not possible.
       */
      redo() {
        if (this.canRedo()) {
          _historyCurrentIndex++;
          // Update _currentState to reflect the redone state.
          const historicState = JSON.parse(JSON.stringify(_history[_historyCurrentIndex]));
          Object.keys(_currentState).forEach(key => delete _currentState[key]);
          Object.assign(_currentState, historicState);
        }
        return this.getState();
      },

      /**
       * Jumps to a specific state in the history, identified by its index.
       * @param {number} index - The index in the history array to go to.
       * @returns {object} The state at the specified index, or current state if index is invalid.
       */
      goToState(index) {
        if (index >= 0 && index < _history.length) {
          _historyCurrentIndex = index;
          const historicState = JSON.parse(JSON.stringify(_history[_historyCurrentIndex]));
          Object.keys(_currentState).forEach(key => delete _currentState[key]);
          Object.assign(_currentState, historicState);
        }
        return this.getState();
      },

      /**
       * Returns a deep copy of the entire state history.
       * @returns {Array<object>} An array of state snapshots.
       */
      getHistory() { return _history.map(s => JSON.parse(JSON.stringify(s))); },

      /**
       * Gets the current index in the state history.
       * @returns {number} The current history index.
       */
      getCurrentIndex() { return _historyCurrentIndex; }
    };
  }

  /**
   * Processes the value returned by a node's execution (function, subflow, etc.)
   * and standardizes it into an output object. This output object must contain
   * an `edges` array, which dictates the next step or branch in the workflow.
   * It can also contain `results` from the node's execution.
   *
   * "Edges" are like named transitions. If a node returns `['next']`, the flow
   * might look for a branch labeled 'next'. If it returns `['error']`, it signals an error path.
   * A common default is `['pass']`.
   *
   * @param {any} returnedValue - The raw value returned by the node's execution.
   * @param {object} context - The execution context of the node (contains `state`, `humanInput`, etc.).
   *                           Used if `returnedValue` is an object with functions that need to be executed.
   * @returns {Promise<object>} A promise that resolves to an object with:
   *                            `edges`: {Array<string>} - Names of edges to follow. Defaults to `['pass']`.
   *                            `results`: {any} (optional) - The processed results from the node.
   */
  async function processReturnedValue(returnedValue, context) {
    let output = null;

    if (Array.isArray(returnedValue)) {
      // If it's an array of strings, these are considered direct edge names.
      if (returnedValue.every(item => typeof item === 'string') && returnedValue.length > 0) {
        output = { edges: returnedValue };
      } else {
        // If it's an array but not of strings, or empty, it's treated as a simple result.
        // The flow defaults to a 'pass' edge.
        output = { edges: ['pass'], results: returnedValue }; // Or consider an error/warning
      }
    } else if (typeof returnedValue === 'object' && returnedValue !== null) {
      // If it's an object, it might define multiple potential edges as functions.
      // Example: { success: () => state.set('status', 'done'), failure: () => state.set('status', 'failed') }
      // The keys of functions become edge names, and the functions are executed.
      const edgeFunctions = {};
      const edgeNames = [];
      Object.keys(returnedValue).forEach(key => {
        if (typeof returnedValue[key] === 'function') {
          edgeNames.push(key);
          edgeFunctions[key] = returnedValue[key];
        }
      });

      if (edgeNames.length > 0) {
        const results = [];
        // Execute each edge function. These functions might perform state changes or other async operations.
        for (const k of edgeNames) {
          try {
            const edgeFn = edgeFunctions[k];
            // Apply the function within the original node's context.
            // The edge function itself might call `this.humanInput` or interact with `this.state`.
            let result = await Promise.resolve(edgeFn.apply(context, []));
            results.push(result);
          } catch (e) {
            console.error(`[FlowManager:${flowInstanceId}] Error executing edge function for '${k}':`, e);
            results.push({ error: e.message }); // Record error as part of results for this edge.
          }
        }
        output = {
          edges: edgeNames, // All function keys become outgoing edges.
          results: results  // Results of executing these functions.
        };
      } else {
        // If the object has no functions, treat the object itself as a result.
        output = { edges: ['pass'], results: returnedValue };
      }
    } else if (typeof returnedValue === 'string') {
      // A single string is treated as a single edge name.
      output = { edges: [returnedValue] };
    } else {
      // For any other type (boolean, number, null, undefined), it's a result, and we take a 'pass' edge.
      output = { edges: ['pass'], results: [returnedValue] };
    }

    // Ensure there's always an `edges` array, defaulting to `['pass']` if none were determined.
    if (!output.edges || output.edges.length === 0) {
        output.edges = ['pass'];
    }
    return output;
  }

  /**
   * Manages the execution of a loop construct within the workflow.
   * A loop is defined by a node structure: `[[controllerNode, actionNode1, actionNode2, ...]]`.
   * - The `controllerNode` is executed first in each iteration. Its output (edges) determines
   *   if the loop continues or exits (e.g., an edge 'exit').
   * - If not exiting, the `actionNodes` are executed sequentially.
   * - The state is persisted and passed between iterations and to sub-FlowManagers for controller/actions.
   *
   * @param {Array} loopNodesConfig - An array where the first element is the controller node definition,
   *                                and subsequent elements are action node definitions.
   *                                e.g., `[[ { type: 'checkCondition' }, { type: 'doWork' } ]]`
   * @returns {Promise<object>} A promise that resolves to an object:
   *                            `internalSteps`: {Array<object>} - Detailed log of each iteration.
   *                            `finalOutput`: {object} - The output of the last executed part of the loop
   *                                                       (either controller or last action).
   */
  async function loopManager(loopNodesConfig) {
    const loopInternalSteps = []; // To record the history within this loop.

    if (!loopNodesConfig || loopNodesConfig.length === 0) {
      // An empty loop definition essentially does nothing and passes.
      const passOutput = { edges: ['pass'] };
      return { internalSteps: [{ nodeDetail: "Empty Loop Body", output: passOutput }], finalOutput: passOutput };
    }

    const controllerNode = loopNodesConfig[0]; // First node is the loop controller.
    const actionNodes = loopNodesConfig.slice(1); // Remaining nodes are actions within the loop body.

    let maxIterations = 100; // Safety break to prevent infinite loops.
    let iterationCount = 0;
    // `lastLoopIterationOutput` stores the output of the last significant operation in an iteration.
    // It defaults to 'pass' to allow the first controller execution.
    let lastLoopIterationOutput = { edges: ['pass'] };

    while (iterationCount < maxIterations) {
      iterationCount++;
      const loopIterationInstanceId = `${flowInstanceId}-loop${iterationCount}`;

      // 1. Execute the Controller Node
      // A new FlowManager instance is created for the controller to encapsulate its execution.
      // It inherits the current state of the parent flow.
      const controllerFM = FlowManager({
        initialState: fmState.getState(), // Pass current state.
        nodes: [controllerNode],          // Controller node runs in its own mini-flow.
        instanceId: `${loopIterationInstanceId}-ctrl`,
        scope: scope // Pass down the scope.
      });
      const controllerRunResult = await controllerFM.run(); // `run` returns array of steps.
      let controllerOutput;

      if (controllerRunResult && controllerRunResult.length > 0) {
        // The output of the controller is the output of its last step.
        controllerOutput = controllerRunResult.at(-1).output;
        // Update the parent flow's state with any changes made by the controller.
        fmState.set(null, controllerFM.getStateManager().getState());
        loopInternalSteps.push({
          nodeDetail: `Loop Iter ${iterationCount}: Controller (${typeof controllerNode === 'string' ? controllerNode : 'Complex Controller'})`,
          outputFromController: controllerOutput,
          controllerSubSteps: controllerRunResult // Record steps taken by controller.
        });
      } else {
        // Controller failed to run or produced no steps/output.
        console.warn(`[FlowManager:${flowInstanceId}] Loop controller (iter ${iterationCount}) did not produce output. Assuming 'exit'.`);
        controllerOutput = { edges: ['exit'] }; // Default to exit to prevent issues.
        loopInternalSteps.push({
          nodeDetail: `Loop Iter ${iterationCount}: Controller Error or No Output`, outputFromController: controllerOutput,
        });
      }

      lastLoopIterationOutput = controllerOutput; // Update last output with controller's.

      // Check if the controller signaled to exit the loop.
      if (controllerOutput.edges.includes('exit')) {
        break; // Exit the while loop.
      }

      // 2. Execute Action Nodes (if controller didn't exit)
      if (actionNodes.length > 0) {
        const actionsFM = FlowManager({
          initialState: fmState.getState(), // Pass current (potentially updated by controller) state.
          nodes: actionNodes,             // Action nodes run sequentially in their own sub-flow.
          instanceId: `${loopIterationInstanceId}-actions`,
          scope: scope // Pass down the scope.
        });
        const actionsRunResult = await actionsFM.run();
        // Update parent state with changes from action nodes.
        fmState.set(null, actionsFM.getStateManager().getState());

        if (actionsRunResult && actionsRunResult.length > 0) {
          // The overall output of this iteration's actions is the output of the last action node.
          lastLoopIterationOutput = actionsRunResult.at(-1).output;
          loopInternalSteps.push({
            nodeDetail: `Loop Iter ${iterationCount}: Actions`, outputFromActions: lastLoopIterationOutput, actionSubSteps: actionsRunResult
          });
        } else {
           loopInternalSteps.push({ nodeDetail: `Loop Iter ${iterationCount}: Actions (no output/steps)`, actionSubSteps: actionsRunResult || [] });
           // If actions produce no output, `lastLoopIterationOutput` remains what the controller set (or previous action).
           // This might need refinement based on desired behavior if actions are optional or might not yield edges.
           // For now, if actions don't change `lastLoopIterationOutput`, the controller's output is still dominant for next iter decision.
        }
      }
      // If loop continues, next iteration starts with state potentially modified by controller and actions.

      if (iterationCount >= maxIterations) {
        console.warn(`[FlowManager:${flowInstanceId}] Loop reached max iterations (${maxIterations}). Forcing exit.`);
        lastLoopIterationOutput = { edges: ['exit_forced'] }; // Special edge for forced exit.
        loopInternalSteps.push({ nodeDetail: "Loop Max Iterations Reached", output: lastLoopIterationOutput });
        break;
      }
    }
    // The finalOutput of the loop is the output of the last thing that happened (controller exit, or last action's output).
    return { internalSteps: loopInternalSteps, finalOutput: lastLoopIterationOutput };
  }


  /**
   * Evaluates a single node from the workflow's `nodes` array.
   * This is the core execution logic for different types of nodes:
   * - Function: Executes the function.
   * - String: Looks up the function by name in the `scope` and executes it.
   * - Array:
   *   - `[[controller, ...actions]]`: Interpreted as a loop, handled by `loopManager`.
   *   - `[node1, node2, ...]`: Interpreted as a subflow, a new FlowManager instance is created.
   * - Object:
   *   - `{}` (empty): A no-op, results in a 'pass' edge.
   *   - `{ "funcNameFromScope": {params} }`: Calls `scope[funcNameFromScope]` with `params`.
   *   - `{ "edgeName": subNode, ... }`: Interpreted as a conditional branch. If the previous node's output
   *     contained `edgeName`, then `subNode` is executed.
   *
   * After execution, the node's return value is processed by `processReturnedValue` to get
   * standardized `output` (with `edges`), and the result is recorded in the `steps` array.
   *
   * @param {any} node - The node definition from the `nodes` array.
   * @returns {Promise<void>} A promise that resolves when the node has been evaluated.
   */
  async function evaluateNode(node) {
    let output = null; // Standardized output: { edges: [], results: [] }
    let returnedValue; // Raw value returned by the node's execution
    const nodeToRecord = node; // Keep a reference to the original node definition for logging.
    let subStepsToRecord = null; // If the node spawns a subflow/loop, its steps are recorded here.

    // `baseExecutionContext`: An object provided as `this` to node functions.
    // It gives nodes access to the flow's state, ability to request human input, etc.
    const baseExecutionContext = {
        state: fmState,         // Access to the StateManager instance for this flow.
        steps,                  // Access to the history of steps executed so far in this flow. (Read-only recommended)
        nodes,                  // The full list of nodes in the current flow. (Read-only recommended)
        currentIndex,           // The index of the current node being evaluated. (Read-only recommended)

        /**
         * `humanInput`: A critical method allowing a node function to pause the workflow
         * and request external input. It integrates with `GlobalPauseResumeManager`.
         *
         * @param {any} details - Information about what input is needed. Passed to `GlobalPauseResumeManager`.
         * @param {string} [customPauseId] - An optional custom ID for the pause request.
         * @returns {Promise<any>} A promise that resolves with the data provided when the flow is resumed.
         */
        humanInput: async (details, customPauseId) => {
            console.log(`[FlowManager:${flowInstanceId}] Node (or edge function) requests human input. Details:`, details, "Pause ID hint:", customPauseId);
            // Delegate the pause request to the global manager.
            const resumeData = await GlobalPauseResumeManager.requestPause({
                pauseId: customPauseId, // Pass along the suggested pauseId.
                details,                // Pass along details for the external system.
                flowInstanceId          // Identify which flow instance is pausing.
            });
            console.log(`[FlowManager:${flowInstanceId}] Human input received:`, resumeData);
            return resumeData; // This data is returned to the node function.
        }
        // Other utilities like `getInstanceId()` could be added here if nodes need them.
    };

    /**
     * Helper to execute a node function (which might be async and might call `this.humanInput`).
     * Ensures that the function is awaited if it's async or returns a Promise.
     * @param {Function} fn - The function to execute.
     * @param {object} context - The `this` context for the function (baseExecutionContext).
     * @param  {...any} args - Arguments to pass to the function.
     * @returns {Promise<any>} The result of the function.
     */
    async function executeFunc(fn, context, ...args) {
        // `Promise.resolve` handles both sync and async functions.
        // If fn is async or returns a Promise, it will be awaited.
        // If fn calls `this.humanInput`, that will return a Promise which gets handled here.
        return await Promise.resolve(fn.apply(context, args));
    }

    // --- Node Type Evaluation ---
    if (typeof node === 'function') {
      // Node is a direct JavaScript function.
      returnedValue = await executeFunc(node, baseExecutionContext);
    } else if (typeof node === 'string') {
      // Node is a string, assumed to be a key in the `scope` object.
      // `scope` should be an object mapping names to functions.
      if (scope && typeof scope[node] === 'function') {
        returnedValue = await executeFunc(scope[node], baseExecutionContext);
      } else {
        console.error(`[FlowManager:${flowInstanceId}] Function '${node}' not found in scope. Scope content:`, scope);
        output = { edges: ['error'], errorDetails: `Function '${node}' not found in scope.` };
      }
    } else if (Array.isArray(node)) {
      // Node is an array, indicating a subflow or a loop.
      if (node.length === 1 && Array.isArray(node[0]) && node[0].length > 0) {
        // Special syntax for a loop: `[[controller, action1, ...]]`
        const loopRun = await loopManager(node[0]); // node[0] is the loop configuration array.
        output = loopRun.finalOutput;       // The loop's final output determines edges for the parent flow.
        subStepsToRecord = loopRun.internalSteps; // Record the detailed steps of the loop's execution.
      } else if (node.length > 0) {
        // Regular subflow: `[subNode1, subNode2, ...]`
        // Create a new FlowManager instance to run the subflow.
        const subflowFM = FlowManager({
          initialState: fmState.getState(), // Subflow inherits parent's current state.
          nodes: node,                      // The array itself is the list of nodes for the subflow.
          instanceId: `${flowInstanceId}-subflow${currentIndex}`, // Unique ID for the subflow.
          scope: scope // Pass down the scope.
        });
        const subflowResultSteps = await subflowFM.run(); // Execute the subflow.
        // After subflow completes, update parent's state with any modifications made by the subflow.
        fmState.set(null, subflowFM.getStateManager().getState());
        // The output of the subflow is the output of its last executed node.
        output = subflowResultSteps?.at(-1)?.output || { edges: ['pass'] }; // Default to 'pass' if subflow was empty or had no output.
        subStepsToRecord = subflowResultSteps; // Record the steps of the subflow.
      } else {
        // Empty array as a node: `[]`. Treated as a no-op.
        output = {edges: ['pass']};
      }
    } else if (typeof node === 'object' && node !== null) {
      // Node is an object. Can be a "function call" with params, or a conditional branch.
      if (Object.keys(node).length === 0) {
        // Empty object `{}`: Treated as a no-op.
        output = { edges: ['pass'] };
      } else {
        // Attempt to interpret as `{ "functionNameFromScope": {params} }`
        const nodeKey = Object.keys(node)[0]; // Assuming one key for this pattern.
        const nodeValue = node[nodeKey];

        if (Object.keys(node).length === 1 && /* `nodeValue` is not an array or function (i.e. it's params) */
            typeof nodeValue === 'object' && !Array.isArray(nodeValue) && nodeValue !== null &&
            scope && typeof scope[nodeKey] === 'function') {
          // This is the `{ "functionNameFromScope": {params} }` pattern.
          // `nodeKey` is the function name, `nodeValue` is the parameters object.
          returnedValue = await executeFunc(scope[nodeKey], baseExecutionContext, nodeValue /* params */);
        } else {
          // Otherwise, interpret as a conditional branch: `{ "edgeName": subNode, ... }`
          // The keys of the object are potential "edge names" from the *previous* node's output.
          const prevStepOutput = steps.at(-1)?.output;
          const prevEdges = (prevStepOutput && Array.isArray(prevStepOutput.edges)) ? prevStepOutput.edges : [];
          let branchTaken = false;

          for (const edgeKey of Object.keys(node)) { // Iterate over keys in the current conditional node (e.g., "success", "failure")
            if (prevEdges.includes(edgeKey)) { // Check if the previous node's output activated this edge
              const branchNode = node[edgeKey]; // This is the node/subflow to execute for this branch.
              // Execute the branch as a new subflow.
              const branchFM = FlowManager({
                initialState: fmState.getState(),
                // Branch node can be a single node or an array (subflow). Normalize to array.
                nodes: Array.isArray(branchNode) ? branchNode : [branchNode],
                instanceId: `${flowInstanceId}-branch-${edgeKey}-${currentIndex}`,
                scope: scope // Pass down the scope.
              });
              const branchResultSteps = await branchFM.run();
              fmState.set(null, branchFM.getStateManager().getState()); // Update state.
              output = branchResultSteps?.at(-1)?.output || { edges: ['pass'] }; // Branch output.
              subStepsToRecord = branchResultSteps; // Record branch steps.
              branchTaken = true;
              break; // Only take the first matching branch.
            }
          }
          if (!branchTaken) {
            // If no edge from the previous step matched any key in this conditional node,
            // it means this conditional block was effectively skipped. Default to 'pass'.
            // This allows the main flow to continue if no conditions are met.
            output = { edges: ['pass'] };
          }
        }
      }
    } else {
      // Unknown node type or unhandled case (e.g., null, number, boolean as a node).
      console.warn(`[FlowManager:${flowInstanceId}] Unknown node type or unhandled case:`, node, `(Type: ${typeof node})`);
      // Default to an 'error' edge, but also 'pass' to potentially allow flow to continue if designed to handle this.
      output = { edges: ['error', 'pass'], errorDetails: 'Unknown node type' };
    }

    // If `returnedValue` was set (meaning the node executed and returned something directly,
    // and `output` wasn't set by an error or special case like branching),
    // then process `returnedValue` to standardize it into the `output` format.
    if (returnedValue !== undefined && output === null) {
      output = await processReturnedValue(returnedValue, baseExecutionContext);
    }

    // Final safety check: ensure `output` always has an `edges` array.
    if (!output || typeof output.edges === 'undefined' || !Array.isArray(output.edges) || output.edges.length === 0) {
      // If output is malformed or edges are missing, default to 'pass'.
      // This can happen if `processReturnedValue` has a bug or a node type handler doesn't set output correctly.
      const existingResults = output?.results;
      output = { edges: ['pass'] };
      if (existingResults) output.results = existingResults; // Preserve results if any
      console.warn(`[FlowManager:${flowInstanceId}] Node evaluation resulted in missing/invalid edges. Defaulting to 'pass'. Original node:`, nodeToRecord, "Interim output:", output);
    }

    // Record the executed node, its standardized output, and any sub-steps (from loops/subflows/branches).
    steps.push({ node: nodeToRecord, output, ...(subStepsToRecord && { subSteps: subStepsToRecord }) });
  }

  /**
   * Internal recursive function to process the workflow's nodes one by one.
   * It advances `currentIndex`, calls `evaluateNode` for the current node,
   * and then calls itself to process the next node until all nodes are done.
   *
   * This function is the heart of the sequential execution logic.
   * The actual branching/conditional logic is handled *within* `evaluateNode`
   * (specifically for object nodes that represent branches), which might then
   * run sub-FlowManagers. The `edges` output by a node determine which branch
   * (if any) is taken if the *next* node is a conditional branching object.
   * Otherwise, for simple sequential flows, it just moves to `nodes[currentIndex+1]`.
   *
   * @private
   */
  async function _nextStepInternal() {
    if (currentIndex < nodes.length) {
      // There are more nodes to process.
      currentNode = nodes[currentIndex];
      currentIndex++; // Increment before async operation to correctly reflect the next node to be processed.
      await evaluateNode(currentNode); // Evaluate the current node.
      await _nextStepInternal(); // Recursively call to process the next node.
    } else {
      // All nodes in the `nodes` array have been processed. The flow run is complete.
      if (_resolveRunPromise) {
        // Resolve the main promise returned by `run()` with a deep copy of the execution steps.
        _resolveRunPromise(JSON.parse(JSON.stringify(steps)));
        _resolveRunPromise = null; // Clear them to prevent multiple resolutions/rejections
        _rejectRunPromise = null;
      }
    }
  }

  // Public API of the FlowManager instance.
  return {
    /**
     * Runs the workflow from the beginning.
     * Resets any previous execution state (steps, current index) for this instance.
     *
     * @returns {Promise<Array<object>>} A promise that resolves with an array of step objects
     *                                    when the flow completes. Each step object details a
     *                                    node's execution and its output.
     *                                    Rejects if an unhandled error occurs during execution.
     */
    async run() {
      // Reset execution state for a new run.
      currentIndex = 0;
      steps.length = 0; // Clear previous steps.

      // Return a new Promise that will be resolved/rejected by `_nextStepInternal`.
      return new Promise(async (resolve, reject) => {
        _resolveRunPromise = resolve;
        _rejectRunPromise = reject;

        if (!nodes || nodes.length === 0) {
          // If there are no nodes, resolve immediately with an empty array of steps.
          resolve([]);
          _resolveRunPromise = null; _rejectRunPromise = null;
          return;
        }

        try {
          console.log(`[FlowManager:${flowInstanceId}] Starting execution with ${nodes.length} top-level nodes.`);
          await _nextStepInternal(); // Start the recursive execution process.
          // `_nextStepInternal` will call `_resolveRunPromise` upon completion.
          console.log(`[FlowManager:${flowInstanceId}] Execution finished. Total top-level steps processed: ${steps.length}.`);
        } catch (error) {
          // Catch any unhandled synchronous or asynchronous errors from the flow execution.
          console.error(`[FlowManager:${flowInstanceId}] Critical error during flow execution:`, error);
          if(_rejectRunPromise) _rejectRunPromise(error); // Reject the main promise.
          _resolveRunPromise = null; _rejectRunPromise = null; // Clean up
        }
      });
    },

    /**
     * Retrieves a deep copy of all steps executed so far in the current or last run.
     * Each step includes the node definition, its output (edges, results), and any sub-steps.
     * @returns {Array<object>} An array of step objects.
     */
    getSteps: () => JSON.parse(JSON.stringify(steps)),

    /**
     * Provides access to the StateManager instance for this flow.
     * This allows external code to inspect or (carefully) manipulate the flow's state,
     * or use its undo/redo capabilities if needed.
     * @returns {object} The StateManager instance.
     */
    getStateManager: () => fmState,

    /**
     * Gets the unique instance ID of this FlowManager.
     * @returns {string} The flow instance ID.
     */
    getInstanceId: () => flowInstanceId
  };
}