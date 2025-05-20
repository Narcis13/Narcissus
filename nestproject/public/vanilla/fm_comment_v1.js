/**
 * GlobalPauseResumeManager: A singleton manager for handling pause and resume operations
 * across all FlowManager instances. It allows workflows to request human intervention
 * and for an external UI layer to respond and resume the flow.
 */
const GlobalPauseResumeManager = (function() {
    // _pausedFlows: Stores active pause states.
    // Key: pauseId (string)
    // Value: { resolve: Function (to resume the Promise), details: any, flowInstanceId: string }
    const _pausedFlows = new Map();
    // _eventTarget: Used for broadcasting events like 'flowPaused' and 'flowResumed'.
    // This allows a UI layer to subscribe to these events.
    const _eventTarget = new EventTarget(); // Requires a browser-like environment or a polyfill for EventTarget

    let _pauseIdCounter = 0; // Simple counter for generating unique parts of pause IDs.

    /**
     * Generates a unique ID for a pause request.
     * @param {string} [prefix='pause'] - A prefix for the ID, often related to the flow instance.
     * @returns {string} A unique pause ID.
     */
    function generatePauseId(prefix = 'pause') {
        _pauseIdCounter++;
        return `${prefix}-${Date.now()}-${_pauseIdCounter}`;
    }

    return {
        /**
         * Emits a custom event.
         * @param {string} eventName - The name of the event (e.g., 'flowPaused').
         * @param {object} detail - The data to be carried by the event.
         */
        _emitEvent(eventName, detail) {
            // console.debug(`[GlobalPauseResumeManager] Emitting event: ${eventName}`, detail);
            _eventTarget.dispatchEvent(new CustomEvent(eventName, { detail }));
        },

        /**
         * Adds an event listener for pause/resume events.
         * The UI layer will use this to react to pauses.
         * @param {string} eventName - Event to listen for ('flowPaused', 'flowResumed', 'resumeFailed').
         * @param {Function} callback - The function to call when the event occurs.
         */
        addEventListener(eventName, callback) {
            _eventTarget.addEventListener(eventName, callback);
        },

        /**
         * Removes an event listener.
         * @param {string} eventName - The event name.
         * @param {Function} callback - The callback to remove.
         */
        removeEventListener(eventName, callback) {
            _eventTarget.removeEventListener(eventName, callback);
        },

        /**
         * Called by a FlowManager node (via `this.humanInput`) to pause execution.
         * @param {object} options - Pause options.
         * @param {string} [options.pauseId] - A user-suggested ID for this pause. If not unique or provided, one is generated.
         * @param {any} [options.details] - Data/details about the pause, to be sent to the UI.
         * @param {string} options.flowInstanceId - The ID of the FlowManager instance initiating the pause.
         * @returns {Promise<any>} A promise that resolves with data when `resume()` is called for this pause.
         */
        requestPause({ pauseId: customPauseId, details, flowInstanceId }) {
            return new Promise((resolve) => {
                const pauseId = customPauseId && !_pausedFlows.has(customPauseId) ? customPauseId : generatePauseId(flowInstanceId || 'flow');

                if (_pausedFlows.has(pauseId)) {
                    // This case should be rare if IDs are generated or custom IDs are unique.
                    // If a customPauseId is reused before resume, it's problematic.
                    console.warn(`[GlobalPauseResumeManager] Pause ID ${pauseId} is already active. This might indicate an issue if not intended. Overwriting the resolver for ${pauseId}.`);
                    // Potentially, we could reject the old promise or handle this more gracefully.
                    // For now, we'll overwrite, assuming the latest pause request is the one to honor.
                }
                _pausedFlows.set(pauseId, { resolve, details, flowInstanceId });
                this._emitEvent('flowPaused', { pauseId, details, flowInstanceId });
                console.log(`[GlobalPauseResumeManager] Flow ${flowInstanceId} paused. ID: ${pauseId}. Details: ${JSON.stringify(details)}. Waiting for resume...`);
            });
        },

        /**
         * Called by an external system (e.g., UI) to resume a paused flow.
         * @param {string} pauseId - The ID of the pause to resume.
         * @param {any} resumeData - Data to be passed back to the awaiting `humanInput()` call in the flow.
         * @returns {boolean} True if resume was successful, false otherwise (e.g., pauseId not found).
         */
        resume(pauseId, resumeData) {
            if (_pausedFlows.has(pauseId)) {
                const { resolve, details, flowInstanceId } = _pausedFlows.get(pauseId);
                resolve(resumeData); // This fulfills the promise returned by requestPause
                _pausedFlows.delete(pauseId);
                this._emitEvent('flowResumed', { pauseId, resumeData, details, flowInstanceId });
                console.log(`[GlobalPauseResumeManager] Flow ${flowInstanceId} resumed. ID: ${pauseId} with data:`, resumeData);
                return true;
            } else {
                console.warn(`[GlobalPauseResumeManager] No active pause found for ID: ${pauseId}. Cannot resume.`);
                this._emitEvent('resumeFailed', { pauseId, reason: 'No active pause found' });
                return false;
            }
        },

        /**
         * Checks if a specific pause ID is currently active.
         * @param {string} pauseId - The pause ID to check.
         * @returns {boolean} True if the pauseId corresponds to an active pause.
         */
        isPaused(pauseId) {
            return _pausedFlows.has(pauseId);
        },

        /**
         * Gets details of all currently active pauses. Useful for a UI to display a list of pending actions.
         * @returns {Array<object>} An array of objects, each being { pauseId, details, flowInstanceId }.
         */
        getActivePauses() {
            const active = [];
            _pausedFlows.forEach(({ details, flowInstanceId }, pauseId) => {
                active.push({ pauseId, details, flowInstanceId });
            });
            return active;
        }
    };
})();


/**
 * FlowManager: A powerful and flexible engine for orchestrating complex workflows,
 * particularly well-suited for AI agentic systems. It allows workflows to be defined
 * as serializable JSON-like structures, enabling dynamic generation, persistence,
 * and execution of directed graphs of tasks and decisions.
 *
 * The core idea is to represent a workflow as a sequence of 'nodes'. Each node
 * can be a simple function, a reference to a function in a shared 'scope',
 * a conditional branch, a sub-flow, or a loop construct. The FlowManager
 * processes these nodes, managing state and handling both synchronous and
 * asynchronous operations, making it ideal for tasks like multi-step AI reasoning,
 * tool usage, and dynamic plan execution.
 *
 * @param {object} config - Configuration for the FlowManager.
 * @param {object} [config.initialState={}] - The initial state for the workflow.
 *                                           This state is mutable and shared across nodes,
 *                                           acting as the agent's memory or context.
 * @param {Array} [config.nodes=[]] - An array defining the workflow's structure.
 *                                    This is the core "program" for the agent.
 * @param {string} [config.instanceId] - An optional ID for this FlowManager instance. If not provided, one is generated.
 * @returns {object} An API to run and interact with the flow.
 */
function FlowManager({initialState, nodes, instanceId}={initialState:{}, nodes:[], instanceId: undefined}) {
  // `steps`: An array to record each executed node and its output.
  // This provides a full audit trail of the workflow's execution, crucial for debugging
  // and understanding an agent's decision-making process.
  const steps = [];
  let currentNode = null; // The node currently being processed.
  let currentIndex = 0;   // The index of the current node in the `nodes` array.

  // `flowInstanceId`: A unique identifier for this specific FlowManager instance.
  // Useful for correlating pause events in the GlobalPauseResumeManager if multiple flows are active.
  const flowInstanceId = instanceId || `fm-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  // `fmState`: An instance of StateManager. This robustly manages the workflow's
  // state, including history for potential undo/redo operations or state-based rollbacks.
  // Think of this as the agent's working memory, accessible and modifiable by each node.
  const fmState = StateManager(initialState);

  // `_resolveRunPromise` and `_rejectRunPromise`: Used to manage the Promise returned by the `run` method,
  // ensuring that it resolves or rejects only after the entire asynchronous flow has completed or errored.
  let _resolveRunPromise = null;
  let _rejectRunPromise = null;

  /**
   * Helper function to determine if a given function was defined using the `async` keyword.
   * This is critical for the FlowManager to correctly `await` asynchronous operations
   * performed by nodes, allowing for non-blocking AI tasks (e.g., API calls, long computations).
   * @param {Function} fn - The function to check.
   * @returns {boolean} True if the function is async, false otherwise.
   */
  function isAsyncFunction(fn) {
    if (!fn) return false;
    // The constructor name for an async function is 'AsyncFunction'.
    return fn.constructor && fn.constructor.name === 'AsyncFunction';
  }

  // --- StateManager ---
  /**
   * StateManager: A dedicated module for managing the workflow's state.
   * It provides mechanisms for getting, setting, and tracking changes to the state,
   * including a history feature for undo/redo capabilities. This robust state handling
   * is vital for agentic systems that need to maintain context, learn, or backtrack.
   *
   * The state is deeply cloned on modifications to ensure immutability of history entries
   * and to prevent unintended side effects between nodes.
   *
   * @param {object} [_initialState={}] - The starting state for this manager.
   * @returns {object} An API for interacting with the state.
   */
  function StateManager(_initialState = {}) {
    // `_currentState`: A deep copy of the initial state, representing the live state.
    const _currentState = JSON.parse(JSON.stringify(_initialState));
    // `_history`: An array storing snapshots of the state, enabling time-travel debugging or rollbacks.
    const _history = [JSON.parse(JSON.stringify(_initialState))];
    let _historyCurrentIndex = 0; // Pointer to the current state within the history.

    return {
      /**
       * `withState`: A higher-order function that wraps a given function (`fn`).
       * When the wrapped function is called, it will be automatically provided with
       * specified parts of the current state as its first argument.
       * This is a utility for convenience, allowing node functions to easily access
       * relevant state without manually calling `this.state.get()`.
       * It also correctly preserves the `async` nature of `fn`.
       *
       * @param {Function} fn - The function to wrap. This function will receive `params` and `...args`.
       * @param {Array<string>} paramNames - An array of top-level state keys to inject into `fn`.
       * @returns {Function} The wrapped function.
       */
      withState(fn, paramNames) {
        const smInstance = this; // Capture StateManager's 'this' for use in the returned function.
        // The `humanInput` function also needs to be available in the `this` context of `fn`
        // if `fn` is called directly (not through `executeFunc`).
        // However, `executeFunc` is the primary way functions are called, and it will set up the context.
        // For `withState` specifically, the context of `fn` will be `smInstance`.
        // If `fn` needs `humanInput`, it would typically be a scope function called via `executeFunc`.
        // This `withState` utility is more for state access convenience.
        // If `humanInput` is needed inside a `withState`-wrapped function, the context injection
        // needs to be more pervasive or `fn` needs to be designed to get it from `this.state` (if we put it there),
        // or from a globally accessible place.
        // For now, assuming `humanInput` is mainly used within `scope` functions called by `evaluateNode`.

        if (isAsyncFunction(fn)) {
          return async function(...args) { // Ensure the wrapper is async if `fn` is.
            const params = (paramNames || []).reduce((acc, name) => {
              if (Object.prototype.hasOwnProperty.call(smInstance.getState(), name)) {
                acc[name] = smInstance.get(name);
              }
              return acc;
            }, {});
            // `fn` is called with `smInstance` as `this`, allowing `fn` to use `this.get()`, `this.set()`, etc.
            return await fn.call(smInstance, params, ...args);
          };
        } else {
          return function(...args) {
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
       * `get`: Retrieves a value from the state using a dot-separated path.
       * Enables targeted access to nested data within the agent's memory.
       * @param {string} path - The path to the desired value (e.g., "agent.status.mood").
       * @returns {*} The value at the path, or '' if not found or undefined/null.
       */
      get(path) {
        if (!path) return ''; // Handle empty path gracefully.
        const keys = path.split('.');
        let result = _currentState;
        for (const key of keys) {
          if (result === undefined || result === null || !Object.prototype.hasOwnProperty.call(result, key)) {
            return ''; // Path does not exist or encounters undefined/null.
          }
          result = result[key];
        }
        return result !== undefined && result !== null ? result : '';
      },
      /**
       * `set`: Sets a value in the state at a specified path or replaces the entire state.
       * This is the primary way nodes modify the agent's context or memory.
       * After setting, a new state snapshot is added to the history.
       * @param {string|null} path - The path to set (e.g., "agent.data.results"), or null/'' to replace the whole state.
       * @param {*} value - The value to set.
       * @returns {*} The value that was set.
       */
      set(path, value) {
        let targetStateObject = _currentState;
        // If path is null or empty, replace the entire state object.
        if (path === null || path === '') {
          const newStateParsed = JSON.parse(JSON.stringify(value)); // Deep clone new value
          // Clear existing keys from _currentState
          for (const key in _currentState) {
            if (Object.prototype.hasOwnProperty.call(_currentState, key)) {
              delete _currentState[key];
            }
          }
          // Assign new keys from newStateParsed
          for (const key in newStateParsed) {
            if (Object.prototype.hasOwnProperty.call(newStateParsed, key)) {
              _currentState[key] = newStateParsed[key];
            }
          }
        } else {
          // Original logic for path-based set.
          // Work on a copy to ensure path creation doesn't partially modify _currentState on error.
          const newStateCopy = JSON.parse(JSON.stringify(_currentState));
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
          Object.assign(_currentState, newStateCopy); // Apply changes to the actual _currentState.
          targetStateObject = current[lastKey];
        }

        // History management: discard redo history and add current state.
        _history.splice(_historyCurrentIndex + 1);
        _history.push(JSON.parse(JSON.stringify(_currentState)));
        _historyCurrentIndex = _history.length - 1;
        return targetStateObject;
      },
      /**
       * `getState`: Returns a deep copy of the entire current state.
       * Essential for inspecting the agent's memory without direct mutation risks.
       * @returns {object} A deep copy of the current state.
       */
      getState() { return JSON.parse(JSON.stringify(_currentState)); },
      canUndo() { return _historyCurrentIndex > 0; },
      canRedo() { return _historyCurrentIndex < _history.length - 1; },
      /**
       * `undo`: Reverts the state to its previous snapshot in history.
       * Useful for agentic backtracking or "what-if" scenario exploration.
       * @returns {object} The state after undoing.
       */
      undo() {
        if (this.canUndo()) {
          _historyCurrentIndex--;
          // Restore state by deep copying from history to prevent shared references.
          Object.assign(_currentState, JSON.parse(JSON.stringify(_history[_historyCurrentIndex])));
        }
        return this.getState();
      },
      /**
       * `redo`: Moves the state forward to the next snapshot in history (if undone).
       * @returns {object} The state after redoing.
       */
      redo() {
        if (this.canRedo()) {
          _historyCurrentIndex++;
          Object.assign(_currentState, JSON.parse(JSON.stringify(_history[_historyCurrentIndex])));
        }
        return this.getState();
      },
      goToState(index) {
        if (index >= 0 && index < _history.length) {
          _historyCurrentIndex = index;
          Object.assign(_currentState, JSON.parse(JSON.stringify(_history[_historyCurrentIndex])));
        }
        return this.getState();
      },
      getHistory() { return _history.map(s => JSON.parse(JSON.stringify(s))); },
      getCurrentIndex() { return _historyCurrentIndex; }
    };
  }

  // --- processReturnedValue ---
  /**
   * `processReturnedValue`: Standardizes the output of a node's execution.
   * A node function can return various types (string, array of strings, object with edge functions).
   * This function normalizes that return value into a consistent `output` object,
   * which must contain an `edges` array. These edges dictate the possible next
   * transitions in the workflow graph. For agentic systems, this allows a node (an "action"
   * or "decision") to signal different outcomes, guiding the agent's next steps.
   * It also handles execution of `edge functions` if provided, potentially awaiting them if async.
   * The `context` for edge functions will include `humanInput`.
   *
   * @param {*} returnedValue - The raw value returned by a node's function.
   * @param {object} context - The execution context (e.g., `{ state: fmState, humanInput: async () => ... }`) for edge functions.
   * @returns {Promise<object>} A promise resolving to the standardized output object (e.g., `{ edges: ['next'], results: [...] }`).
   */
  async function processReturnedValue(returnedValue, context) { // context now includes humanInput
    let output = null;
    if (Array.isArray(returnedValue)) {
      // If an array of strings, these are considered direct edge names.
      if (returnedValue.every(item => typeof item === 'string') && returnedValue.length > 0) {
        output = { edges: returnedValue };
      } else {
        // Default to 'pass' if the array is not solely strings or is empty.
        output = { edges: ['pass'] };
      }
    } else if (typeof returnedValue === 'object' && returnedValue !== null) {
      // If an object, keys can be edge names, and values can be functions to execute for that edge.
      // This allows for dynamic, conditional logic *after* the main node logic.
      const edgeFunctions = {};
      const edgeNames = [];
      Object.keys(returnedValue).forEach(key => {
        if (typeof returnedValue[key] === 'function') {
          edgeNames.push(key);
          edgeFunctions[key] = returnedValue[key];
        }
      });

      const results = [];
      // Sequentially execute (and await if async) each edge function.
      // These edge functions will have `this.humanInput` available from the passed `context`.
      for (const k of edgeNames) {
        try {
          const edgeFn = edgeFunctions[k];
          let result;
          // Edge functions are called with the enhanced context (containing humanInput)
          if (isAsyncFunction(edgeFn)) {
            result = await edgeFn.apply(context, []);
          } else {
            // If edgeFn is synchronous but calls this.humanInput(), it will return a Promise.
            // So, we should await its result to correctly handle the pause.
            result = await Promise.resolve(edgeFn.apply(context, []));
          }
          results.push(result);
        } catch (e) {
          console.error(`[FlowManager:${flowInstanceId}] Error executing edge function for '${k}':`, e);
          results.push({ error: e.message }); // Capture errors from edge functions.
        }
      }
      output = {
        edges: edgeNames.length > 0 ? edgeNames : ['pass'], // Ensure edges array is not empty
        results: results
      };
      if (edgeNames.length === 0 && Object.keys(returnedValue).length > 0) {
        // If it was an object but not with functions as values, treat it as opaque data, default to 'pass'
        // Example: returnedValue = { data: "some info" } -> output = { edges: ['pass'], results: [{data: "some info"}] }
        // This behavior might need refinement based on desired handling of non-function object returns.
        // For now, if no executable edges, it's a pass, but we'll include the original object as a result.
        // output.originalReturn = returnedValue; // Or push it to results?
        // Current logic: If it's an object with non-function values, it will fall through to the 'pass'
        // default at the end of the main `processReturnedValue` function, which is usually fine.
        // Let's refine: if it's an object and keys are not functions, it's treated as a single 'pass' edge
        // and the object itself becomes part of 'results' if not handled by other specific cases.
        // The current logic for `edgeNames.length === 0` above means it will create {edges: ['pass'], results: []}
        // This seems okay, means an object with no functions is just a value.
        // The "pass" default below handles this more generically if output remains null.
    }

    } else if (typeof returnedValue === 'string') {
      // A single string is treated as a single edge.
      output = { edges: [returnedValue] };
    } else {
      // Default fallback for any other type of returned value.
      // The `returnedValue` itself can be passed along as a result.
      output = { edges: ['pass'], results: [returnedValue] };
    }
    // Ensure edges are always present.
    if (!output.edges || output.edges.length === 0) {
        output.edges = ['pass'];
    }
    return output;
  }

  // --- loopManager (Becomes async) ---
  /**
   * `loopManager`: Handles the execution of loop constructs within the workflow.
   * Each iteration creates a new FlowManager instance, which will inherit the `humanInput` capability
   * implicitly via the context setup in `evaluateNode` and how sub-flows are created.
   * The `instanceId` for sub-flows can be made more specific, e.g., `${flowInstanceId}-loop${iterationCount}`.
   *
   * @param {Array} loopNodesConfig - An array where the first element is the controller node
   *                                  and subsequent elements are action nodes for the loop body.
   * @returns {Promise<object>} A promise resolving to an object containing `internalSteps`
   *                            and `finalOutput`.
   */
  async function loopManager(loopNodesConfig) {
    const loopInternalSteps = [];
    if (!loopNodesConfig || loopNodesConfig.length === 0) {
      const passOutput = { edges: ['pass'] };
      return { internalSteps: [{ nodeDetail: "Empty Loop Body", output: passOutput }], finalOutput: passOutput };
    }

    const controllerNode = loopNodesConfig[0];
    const actionNodes = loopNodesConfig.slice(1);
    let maxIterations = 100;
    let iterationCount = 0;
    let lastLoopIterationOutput = { edges: ['pass'] };

    while (iterationCount < maxIterations) {
      iterationCount++;
      const loopIterationInstanceId = `${flowInstanceId}-loop${iterationCount}`;

      // Execute controller node
      const controllerFM = FlowManager({
        initialState: fmState.getState(),
        nodes: [controllerNode],
        instanceId: `${loopIterationInstanceId}-ctrl` // Specific ID for sub-flow
      });
      const controllerRunResult = await controllerFM.run();
      let controllerOutput;

      if (controllerRunResult && controllerRunResult.length > 0) {
        controllerOutput = controllerRunResult.at(-1).output;
        fmState.set(null, controllerFM.getStateManager().getState());
        loopInternalSteps.push({
          nodeDetail: `Loop Iter ${iterationCount}: Controller ${typeof controllerNode === 'string' ? controllerNode : 'Complex Controller'}`,
          outputFromController: controllerOutput,
          controllerSubSteps: controllerRunResult
        });
      } else {
        console.warn(`[FlowManager:${flowInstanceId}] Loop controller did not produce output. Exiting loop.`);
        controllerOutput = { edges: ['exit'] };
        loopInternalSteps.push({
          nodeDetail: `Loop Iter ${iterationCount}: Controller Error`, outputFromController: controllerOutput,
        });
      }
      lastLoopIterationOutput = controllerOutput;

      if (controllerOutput.edges.includes('exit')) {
        break;
      }

      // Execute action nodes if any
      if (actionNodes.length > 0) {
        const actionsFM = FlowManager({
          initialState: fmState.getState(),
          nodes: actionNodes,
          instanceId: `${loopIterationInstanceId}-actions` // Specific ID for sub-flow
        });
        const actionsRunResult = await actionsFM.run();
        fmState.set(null, actionsFM.getStateManager().getState());

        if (actionsRunResult && actionsRunResult.length > 0) {
          lastLoopIterationOutput = actionsRunResult.at(-1).output;
          loopInternalSteps.push({
            nodeDetail: `Loop Iter ${iterationCount}: Actions`, outputFromActions: lastLoopIterationOutput, actionSubSteps: actionsRunResult
          });
        } else {
           loopInternalSteps.push({ nodeDetail: `Loop Iter ${iterationCount}: Actions (no output/steps)`, actionSubSteps: actionsRunResult || [] });
        }
      }

      if (iterationCount >= maxIterations) {
        console.warn(`[FlowManager:${flowInstanceId}] Loop reached max iterations (${maxIterations}). Forcing exit.`);
        lastLoopIterationOutput = { edges: ['exit_forced'] };
        loopInternalSteps.push({ nodeDetail: "Loop Max Iterations Reached", output: lastLoopIterationOutput });
        break;
      }
    }
    return { internalSteps: loopInternalSteps, finalOutput: lastLoopIterationOutput };
  }

  // --- evaluateNode (Becomes async) ---
  /**
   * `evaluateNode`: The heart of the FlowManager's execution engine.
   * This function is responsible for interpreting and executing a single node.
   * It sets up an `executionContext` that includes `state` and the new `humanInput` function.
   *
   * @param {*} node - The node definition to evaluate.
   * @returns {Promise<void>} A promise that resolves when the node has completed.
   */
  async function evaluateNode(node) {
    let output = null;
    let returnedValue;
    const nodeToRecord = node;
    let subStepsToRecord = null;

    // `baseExecutionContext`: This context is passed to all executable functions (node functions, scope functions, edge functions).
    // It provides access to state and the human input mechanism.
    const baseExecutionContext = {
        state: fmState,
        steps, // Current steps array for context
        nodes, // Full nodes list for context
        currentIndex, // Current node index for context
        /**
         * `humanInput`: Allows a node to pause the workflow and request external input.
         * @param {any} details - Information/payload to send to the pausing UI (e.g., a prompt, options).
         * @param {string} [customPauseId] - An optional, specific ID for this pause request.
         * @returns {Promise<any>} A promise that resolves with the data provided by the external system upon resume.
         */
        humanInput: async (details, customPauseId) => {
            console.log(`[FlowManager:${flowInstanceId}] Node (or edge function) requests human input. Details:`, details, "Pause ID hint:", customPauseId);
            const resumeData = await GlobalPauseResumeManager.requestPause({
                pauseId: customPauseId,
                details,
                flowInstanceId // Pass this FlowManager's own ID
            });
            console.log(`[FlowManager:${flowInstanceId}] Human input received:`, resumeData);
            return resumeData; // This data is then returned to the node/edge function
        }
    };

    /**
     * Helper to execute a function and correctly await it.
     * The function `fn` will be called with `baseExecutionContext` as its `this` context.
     */
    async function executeFunc(fn, context, ...args) {
        // Always await, as a sync function calling this.humanInput() will return a Promise.
        return await Promise.resolve(fn.apply(context, args));
    }

    if (typeof node === 'function') {
      // Node is a direct JS function. It will be called with `baseExecutionContext`.
      returnedValue = await executeFunc(node, baseExecutionContext);
    } else if (typeof node === 'string') {
      // Node is a string, referring to a function in `scope`.
      if (scope && scope[node]) {
        returnedValue = await executeFunc(scope[node], baseExecutionContext);
      } else {
        console.error(`[FlowManager:${flowInstanceId}] Function ${node} not found in scope.`);
        output = { edges: ['error'], errorDetails: `Function ${node} not found` };
      }
    } else if (Array.isArray(node)) {
      if (node.length === 1 && Array.isArray(node[0]) && node[0].length > 0) {
        // Loop construct. loopManager will create sub-FlowManagers that inherit context capabilities.
        const loopRun = await loopManager(node[0]);
        output = loopRun.finalOutput;
        subStepsToRecord = loopRun.internalSteps;
      } else if (node.length > 0) {
        // Sequential sub-flow.
        const subflowFM = FlowManager({
          initialState: fmState.getState(),
          nodes: node,
          instanceId: `${flowInstanceId}-subflow${currentIndex}` // Unique ID for sub-flow
        });
        const subflowResultSteps = await subflowFM.run();
        fmState.set(null, subflowFM.getStateManager().getState());
        output = subflowResultSteps?.at(-1)?.output || { edges: ['pass'] };
        subStepsToRecord = subflowResultSteps;
      } else {
        output = {edges: ['pass']};
      }
    } else if (typeof node === 'object' && node !== null) {
      if (Object.keys(node).length === 0) {
        output = { edges: ['pass'] };
      } else {
        const nodeKey = Object.keys(node)[0];
        const nodeValue = node[nodeKey];

        if (typeof nodeValue === 'object' && !Array.isArray(nodeValue) && scope && scope[nodeKey]) {
          // Parameterized function call from scope.
          returnedValue = await executeFunc(scope[nodeKey], baseExecutionContext, nodeValue);
        } else {
          // Conditional/Structural node (branching).
          const prevStepOutput = steps.at(-1)?.output;
          const prevEdges = (prevStepOutput && prevStepOutput.edges) ? prevStepOutput.edges : [];
          let branchTaken = false;

          for (const edgeKey of Object.keys(node)) {
            if (prevEdges.includes(edgeKey)) {
              const branchNode = node[edgeKey];
              const branchFM = FlowManager({
                initialState: fmState.getState(),
                nodes: Array.isArray(branchNode) ? branchNode : [branchNode],
                instanceId: `${flowInstanceId}-branch-${edgeKey}-${currentIndex}` // Unique ID for branch sub-flow
              });
              const branchResultSteps = await branchFM.run();
              fmState.set(null, branchFM.getStateManager().getState());

              output = branchResultSteps?.at(-1)?.output || { edges: ['pass'] };
              subStepsToRecord = branchResultSteps;
              branchTaken = true;
              break;
            }
          }
          if (!branchTaken) {
            output = { edges: ['pass'] };
          }
        }
      }
    } else {
      console.warn(`[FlowManager:${flowInstanceId}] Unknown node type or unhandled case:`, node);
      output = { edges: ['error', 'pass'] };
    }

    if (returnedValue !== undefined && output === null) {
      // Pass `baseExecutionContext` so edge functions within `processReturnedValue` also get `humanInput`.
      output = await processReturnedValue(returnedValue, baseExecutionContext);
    }

    if (!output || typeof output.edges === 'undefined' || !Array.isArray(output.edges) || output.edges.length === 0) {
      output = { ...output, edges: ['pass'] }; // Ensure 'pass' if edges are missing or empty.
    }

    steps.push({ node: nodeToRecord, output, ...(subStepsToRecord && { subSteps: subStepsToRecord }) });
  }

  // --- _nextStepInternal (Handles the flow asynchronously) ---
  /**
   * `_nextStepInternal`: The recursive asynchronous function that drives the workflow execution.
   * It picks the next node, calls `evaluateNode`, and then calls itself.
   * If `evaluateNode` involves a `humanInput` call, `_nextStepInternal` will implicitly pause
   * because `evaluateNode` (and its callees) will `await` the human's response.
   *
   * @returns {Promise<void>}
   */
  async function _nextStepInternal() {
    if (currentIndex < nodes.length) {
      currentNode = nodes[currentIndex];
      currentIndex++;
      await evaluateNode(currentNode); // This await will "pause" if humanInput is awaiting.
      await _nextStepInternal();
    } else {
      if (_resolveRunPromise) {
        _resolveRunPromise(JSON.parse(JSON.stringify(steps)));
        _resolveRunPromise = null;
        _rejectRunPromise = null;
      }
    }
  }

  // --- Returned API ---
  return {
    /**
     * `run`: Initiates the execution of the configured workflow.
     * @returns {Promise<Array<object>>} A promise that resolves with the array of executed steps.
     */
    async run() {
      currentIndex = 0;
      steps.length = 0;
      // fmState = StateManager(initialState); // Optional: uncomment for full state reset on each run.

      return new Promise(async (resolve, reject) => {
        _resolveRunPromise = resolve;
        _rejectRunPromise = reject;

        if (!nodes || nodes.length === 0) {
          resolve([]);
          _resolveRunPromise = null;
          _rejectRunPromise = null;
          return;
        }
        try {
          console.log(`[FlowManager:${flowInstanceId}] Starting execution.`);
          await _nextStepInternal();
          console.log(`[FlowManager:${flowInstanceId}] Execution finished.`);
        } catch (error) {
          console.error(`[FlowManager:${flowInstanceId}] Error during flow execution:`, error);
          if(_rejectRunPromise) _rejectRunPromise(error);
          _resolveRunPromise = null;
          _rejectRunPromise = null;
        }
      });
    },

    getSteps: () => JSON.parse(JSON.stringify(steps)),
    getStateManager: () => fmState,
    /**
     * `getInstanceId`: Returns the unique ID of this FlowManager instance.
     * @returns {string} The instance ID.
     */
    getInstanceId: () => flowInstanceId
  };
}

// --- Example Scope & Usage ---
const scope = {
  pi(params){
    console.log('THIS in functia pi (scope function context):', this, 'Params:', params);
    return {
      pass: () => 3.14 * (params.x || 1) * (params.y || 1)
    };
  }
};

scope['Rezultat aleator'] = function() {
  const randomValue = Math.random();
  let edge = randomValue > 0.5 ? 'big' : 'small';
  console.log(`Rezultat aleator: ${randomValue}, Edge chosen: ${edge}`);
  return {
    [edge]: () => {
      this.state.set('rezultatAleator', randomValue);
      return randomValue;
    }
  };
};

scope['Afiseaza rezultat mare'] = function() {
  console.log('E MARE! Valoare:', this.state.get('rezultatAleator'));
  return { pass: () => "Mare afisat" };
};

scope['Afiseaza rezultat mic'] = function() {
  console.log('E MIC! Valoare:', this.state.get('rezultatAleator'));
  return { pass: () => "Mic afisat" };
};

scope['Mesaj Intimpinare'] = function greet({mesaj, postfix}){
  console.log(this.state.get('name') + '::' + mesaj + ' ' + postfix);
  return { stop: () => "Salutari!" };
};

scope['print'] = function(){
  console.log( 'PRINT FN::' + Math.ceil(Math.random()*100), 'State (partial):', {name: this.state.get('name'), loopCounter: this.state.get('loopCounter') });
  return { pass: () => true };
};

scope['With elements'] = function({of}){
  this.state.set('elements', of);
  console.log('With elements - set these elements in state:', of);
  return { do: () => true };
};

scope['Print elements'] = function(){
  const elements = this.state.get('elements');
  if (elements && elements.length > 0) {
    elements.forEach((element, index) => {
      console.log('Element ' + index + ':', element);
    });
  } else {
    console.log('Print elements: No elements found in state.');
  }
  return { pass: () => "Elements printed" };
};

scope['Loop Controller'] = function() {
  let count = this.state.get('loopCounter') || 0;
  count++;
  this.state.set('loopCounter', count);
  console.log('Loop Controller: iteration count =', count);
  if (count >= 3) {
    this.state.set('loopMessage', 'Loop finished by controller');
    return {
      exit: () => 'Exited at ' + count
    };
  } else {
    return {
      continue: () => 'Continuing at ' + count
    };
  }
};

scope['Loop Action'] = function() {
  console.log('Loop Action: Executing. Current count from state:', this.state.get('loopCounter'));
  this.state.set('actionDoneInLoop', true);
  return { pass: () => 'Action completed' };
};

scope['Reset Counter'] = function() {
  this.state.set('loopCounter', 0);
  console.log('Counter Reset');
  return "pass";
}

scope['Async Task'] = async function() {
  console.log('Async Task: Starting (simulating a 1-second delay)...');
  await new Promise(resolve => setTimeout(resolve, 1000));
  this.state.set('asyncResult', 'Async task successfully completed');
  console.log('Async Task: Finished.');
  return { pass: () => 'Async Done' };
};

scope['Check Async Result'] = function() {
    console.log('Check Async Result (from state):', this.state.get('asyncResult'));
    return 'pass';
};

// --- NEW: Human-in-the-Loop Example Scope Function ---
/**
 * `RequestUserInput`: A scope function demonstrating how to use `this.humanInput`.
 * It will pause the flow and wait for external input.
 */
scope['Request User Input'] = async function(params) { // Must be async to use await for humanInput
  const question = params.question || "Please provide your input:";
  console.log(`[Request User Input] Node is asking: "${question}"`);

  // Call `this.humanInput` to pause and emit event.
  // The `details` object will be sent to the UI via the 'flowPaused' event.
  // An optional `customPauseId` can be provided for easier tracking by the UI if needed.
  const userInput = await this.humanInput(
    { type: 'text_input', prompt: question, defaultValue: params.default || "" },
    params.pauseId || `user-input-${this.state.get('name') || 'generic'}` // Example custom pauseId
  );

  console.log(`[Request User Input] Received input from human:`, userInput);
  this.state.set('lastUserInput', userInput);
  // The `userInput` (data from `GlobalPauseResumeManager.resume()`) can be anything the UI sends.
  // Here, we expect an object like {text: "user's text"}
  return {
    received: () => `Input received: ${userInput.text ? userInput.text.substring(0,50) : JSON.stringify(userInput)}`
  };
};

scope['Confirm Action'] = async function(params) {
    const confirmationDetails = {
        type: 'confirmation',
        message: params.message || "Are you sure you want to proceed?",
        options: ["Yes, Proceed", "No, Cancel"],
        payload: params.payload // e.g., data related to the action
    };
    console.log(`[Confirm Action] Requesting confirmation: "${confirmationDetails.message}"`);

    const decision = await this.humanInput(confirmationDetails, `confirm-${params.actionId || 'action'}`);

    // Assuming UI sends back { choice: "Yes, Proceed" } or { choice: "No, Cancel" }
    if (decision && decision.choice === "Yes, Proceed") {
        this.state.set(`confirmation.${params.actionId || 'action'}`, 'confirmed');
        console.log(`[Confirm Action] Action Confirmed by user.`);
        return { confirmed: () => "Action confirmed" };
    } else {
        this.state.set(`confirmation.${params.actionId || 'action'}`, 'cancelled');
        console.log(`[Confirm Action] Action Cancelled by user.`);
        return { cancelled: () => "Action cancelled" };
    }
};


// --- Test Flow Execution ---
async function runTestFlow() {
  const flowManager = FlowManager({
    initialState:{
      name: 'TestFlowWithHITL',
      a: 8, b: 5, d: { x: 111, y: 200 }, loopCounter: 0
    },
    nodes:[
      'Reset Counter',
      // NEW: Adding a human input step
      { 'Request User Input': { question: "What is your name for this flow run?", pauseId: "initial-name-query" } },
      { 'received': 'print'}, // Print after receiving input
      [['Loop Controller',
        // NEW: Add a confirmation within the loop
        async function insideLoopPause() { // Example of an inline async function using humanInput
            const loopCount = this.state.get('loopCounter');
            console.log(`Inside loop (iteration ${loopCount}), about to ask for HITL.`);
            const approval = await this.humanInput(
                { prompt: `Loop ${loopCount}: Approve this iteration?`, options: ['Approve', 'Skip'] },
                `loop-iter-approval-${loopCount}`
            );
            if (approval && approval.decision === 'Approve') {
                this.state.set(`loopIter${loopCount}Approval`, 'Approved');
                return "approved_iteration";
            }
            this.state.set(`loopIter${loopCount}Approval`, 'Skipped');
            return "skipped_iteration";
        },
       'Loop Action', 'print'
      ]],
      { // Conditional based on the inline function's output
        'approved_iteration': () => console.log("Loop iteration was approved."),
        'skipped_iteration': () => console.log("Loop iteration was skipped.")
      },
      'Async Task',
      'Check Async Result',
      { 'Confirm Action': { message: "Finalize the entire flow?", actionId: "flow-finalization" } },
      { // Branch based on confirmation
        'confirmed': [ 'print', {'Mesaj Intimpinare': {mesaj: 'Flow Confirmed & Finalized', postfix:'!'}} ],
        'cancelled': [ 'print', {'Mesaj Intimpinare': {mesaj: 'Flow Cancelled by User', postfix:'...'}} ]
      },
      'Rezultat aleator',
      {
        'big': 'Afiseaza rezultat mare',
        'small': ['Afiseaza rezultat mic', 'print']
      },
    ]
  });
  console.log(`--- STARTING FLOW EXECUTION (Instance ID: ${flowManager.getInstanceId()}) ---`);
  try {
    const executedSteps = await flowManager.run();
    console.log("--- FINAL EXECUTED STEPS (Workflow Audit Trail) ---");
    executedSteps.forEach((step, i) => {
        const nodeString = typeof step.node === 'string' ? step.node : JSON.stringify(step.node);
        console.log(`Step ${i}: Node: ${nodeString.substring(0,70)}${nodeString.length > 70 ? '...' : ''} -> Output Edges: ${step.output.edges}`);
        if(step.subSteps) {
            console.log(`    Contains ${step.subSteps.length} sub-steps.`);
        }
    });
    console.log("--- FINAL STATE (Agent's Memory After Execution) ---");
    console.log(JSON.stringify(flowManager.getStateManager().getState(), null, 2));
  } catch (error) {
    console.error("--- FLOW EXECUTION FAILED ---");
    console.error(error);
  }
}

// --- UI Layer Mock Interaction (Illustrative) ---
// This part would typically be in a separate UI application.
// It listens to events from GlobalPauseResumeManager.

GlobalPauseResumeManager.addEventListener('flowPaused', (event) => {
    const { pauseId, details, flowInstanceId } = event.detail;
    console.log(`%c[UI Mock] Event: flowPaused`, 'color: blue; font-weight: bold;',
                `Instance: ${flowInstanceId}, Pause ID: ${pauseId}, Details:`, details);

    // Simulate UI interaction based on details.type
    // This is highly simplified. A real UI would render forms, buttons, etc.
    setTimeout(() => { // Simulate user taking some time to respond
        if (details.type === 'text_input') {
            const response = prompt(`[UI Mock for ${flowInstanceId} | ${pauseId}] ${details.prompt}`, details.defaultValue || "");
            GlobalPauseResumeManager.resume(pauseId, { text: response, respondedAt: new Date() });
        } else if (details.type === 'confirmation' || (details.options && details.options.length > 0)) {
            const optionsString = details.options.join(' / ');
            const userChoice = confirm(`[UI Mock for ${flowInstanceId} | ${pauseId}] ${details.message || details.prompt}\nOptions: ${optionsString}\n(OK for first option, Cancel for second if two options)`);
            let choice;
            if (details.options.length === 2) {
                choice = userChoice ? details.options[0] : details.options[1];
            } else { // simplified for more options, just take first or last
                choice = userChoice ? details.options[0] : details.options[details.options.length-1];
            }
            GlobalPauseResumeManager.resume(pauseId, { choice: choice, confirmationTime: new Date(), payload: details.payload });
        } else { // Generic pause
            if (confirm(`[UI Mock for ${flowInstanceId} | ${pauseId}] Flow paused with details: ${JSON.stringify(details)}. Click OK to provide generic resume.`)) {
                GlobalPauseResumeManager.resume(pauseId, { acknowledged: true, resumeTime: new Date() });
            } else {
                 console.log(`[UI Mock] User chose not to resume pauseId ${pauseId} immediately.`);
                 // Flow remains paused until GlobalPauseResumeManager.resume(pauseId, ...) is called.
            }
        }
    }, 1000); // Simulate 1 second delay for user response
});

GlobalPauseResumeManager.addEventListener('flowResumed', (event) => {
    const { pauseId, resumeData, flowInstanceId } = event.detail;
    console.log(`%c[UI Mock] Event: flowResumed`, 'color: green; font-weight: bold;',
                `Instance: ${flowInstanceId}, Pause ID: ${pauseId}, Resumed with:`, resumeData);
});

GlobalPauseResumeManager.addEventListener('resumeFailed', (event) => {
    const { pauseId, reason } = event.detail;
    console.error(`%c[UI Mock] Event: resumeFailed`, 'color: red; font-weight: bold;',
                  `Pause ID: ${pauseId}, Reason: ${reason}`);
});

// --- Run the Test ---
// To see the pause/resume in action, open your browser's developer console.
// The prompts from the UI Mock will appear.
runTestFlow();