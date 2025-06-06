You are tasked with creating a complete node implementation for an agentic workflow engine. The node should perform the following task:
<task>
id: google.gmail.listEmails
Description: Lists emails matching specified criteria from a gmail account
Inputs: query (e.g., "from:sender@example.com", "subject:hello", "is:unread"), labelIds, maxResults.
expecting from state connected account details
</task>
Framework Context
This node will be integrated into a FlowManager-based workflow system where:

Nodes execute in sequence with access to previous node outputs via this.input
Nodes can store/retrieve data using this.state.get(path) and this.state.set(path, value)
Nodes can request human input with this.humanInput(details, pauseId)
Nodes can emit custom events with this.emit(eventName, data)
Nodes return values that determine workflow routing via "edges"

Node Implementation Requirements
1. Export Structure:
javascriptCopy/** @type {import('../../types/flow-types.jsdoc.js').NodeDefinition} */
export default {
    // Node definition object
};
2. Required Properties:

id: Unique identifier using dot notation (e.g., "category.subcategory.action")
version: Semantic version (e.g., "1.0.0")
name: Human-readable name
description: Clear description of what the node does
categories: Array of category strings
tags: Array of descriptive tags
inputs: Array of input parameter definitions
outputs: Array of output definitions (optional)
edges: Array of possible routing edges the node can return
implementation: Async function that performs the actual work
aiPromptHints: Object with AI-specific metadata

3. Implementation Function Context:
Your implementation function has access to:

this.input: Output from the previous node in the workflow
this.state: StateManager for getting/setting persistent data
this.humanInput(details, pauseId): Request human interaction
this.emit(eventName, data): Emit custom events
this.flowInstanceId: Unique ID of the current workflow instance
this.self: Metadata about the current node
this.steps: Array of previously executed steps

4. Return Value Patterns:

Simple edge: return "success" → { edges: ["success"], results: ["success"] }
Edge with data: return { success: () => resultData } → Routes to "success" edge, passes resultData to next node
Multiple edges: return { success: () => data1, error: () => data2 } → Both edges available, results array contains both outputs
Array of edges: return ["success", "warning"] → Multiple edges without data

Complete Example Implementation
javascriptCopy/** @type {import('../../types/flow-types.jsdoc.js').NodeDefinition} */
export default {
    id: "data.validation.email",
    version: "1.0.0",
    name: "Email Validator",
    description: "Validates email addresses using regex patterns and optional domain verification. Returns validation status and details.",
    categories: ["Data Processing", "Validation", "Utilities"],
    tags: ["email", "validation", "regex", "verification"],
    inputs: [
        {
            name: "email",
            type: "string",
            description: "The email address to validate.",
            required: true,
            example: "user@example.com"
        },
        {
            name: "strictMode",
            type: "boolean",
            description: "Enable strict validation including domain checks.",
            required: false,
            defaultValue: false,
            example: true
        },
        {
            name: "allowedDomains",
            type: "array",
            description: "List of allowed email domains. If provided, only these domains are accepted.",
            required: false,
            example: ["gmail.com", "company.com"]
        }
    ],
    outputs: [
        { 
            name: "validationResult", 
            type: "object", 
            description: "Detailed validation results including isValid, domain, and issues found." 
        },
        { 
            name: "normalizedEmail", 
            type: "string", 
            description: "The email address in normalized format (lowercase, trimmed)." 
        }
    ],
    edges: [
        { name: "valid", description: "Email passed all validation checks." },
        { name: "invalid", description: "Email failed validation." },
        { name: "restricted", description: "Email domain is not in allowed domains list." },
        { name: "error", description: "An error occurred during validation." }
    ],
    implementation: async function(params) {
        try {
            const email = String(params.email || "").trim().toLowerCase();
            const strictMode = Boolean(params.strictMode);
            const allowedDomains = Array.isArray(params.allowedDomains) ? params.allowedDomains : null;
            
            // Store validation attempt in state
            this.state.set('lastValidationAttempt', {
                email: params.email,
                timestamp: Date.now(),
                strictMode,
                allowedDomains
            });
            
            // Basic regex validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            const isBasicValid = emailRegex.test(email);
            
            if (!isBasicValid) {
                const result = {
                    isValid: false,
                    email: params.email,
                    normalizedEmail: email,
                    issues: ['Invalid email format']
                };
                this.state.set('lastValidationResult', result);
                return { invalid: () => result };
            }
            
            // Extract domain
            const domain = email.split('@')[1];
            
            // Check allowed domains if specified
            if (allowedDomains && !allowedDomains.includes(domain)) {
                const result = {
                    isValid: false,
                    email: params.email,
                    normalizedEmail: email,
                    domain,
                    issues: [`Domain '${domain}' not in allowed list`]
                };
                this.state.set('lastValidationResult', result);
                return { restricted: () => result };
            }
            
            // Strict mode validation (simplified - would normally include DNS checks)
            if (strictMode) {
                const commonInvalidDomains = ['test.com', 'example.com', 'invalid.com'];
                if (commonInvalidDomains.includes(domain)) {
                    const result = {
                        isValid: false,
                        email: params.email,
                        normalizedEmail: email,
                        domain,
                        issues: [`Domain '${domain}' appears to be invalid or test domain`]
                    };
                    this.state.set('lastValidationResult', result);
                    return { invalid: () => result };
                }
            }
            
            // Success case
            const result = {
                isValid: true,
                email: params.email,
                normalizedEmail: email,
                domain,
                issues: []
            };
            
            this.state.set('lastValidationResult', result);
            this.state.set('validEmailsCount', (this.state.get('validEmailsCount') || 0) + 1);
            
            return { valid: () => result };
            
        } catch (error) {
            console.error(`[EmailValidator] Error in ${this.flowInstanceId}:`, error);
            const errorResult = {
                isValid: false,
                email: params.email,
                error: error.message,
                issues: ['Validation error occurred']
            };
            this.state.set('lastValidationError', errorResult);
            return { error: () => errorResult };
        }
    },
    aiPromptHints: {
        toolName: "email_validator",
        summary: "Validates email addresses with optional domain restrictions and strict mode checking.",
        useCase: "Use this tool when you need to verify email address format and domain validity in forms, user registration, or data processing workflows.",
        expectedInputFormat: "Provide 'email' as the string to validate. Optional: 'strictMode' boolean and 'allowedDomains' array.",
        outputDescription: "Returns 'valid', 'invalid', 'restricted', or 'error' edges with detailed validation results. Updates state with validation history and counts."
    }
};
Your Task
Create a node implementation following this exact structure and patterns. Ensure your node:

Has a descriptive, unique ID using dot notation appropriate for the task
Includes comprehensive input/output definitions with examples and descriptions
Implements proper error handling with try-catch blocks
Uses the state system to store relevant data (e.g., operation history, counters, cached results)
Returns appropriate edge objects with functions that provide meaningful data to the next node
Includes detailed AI prompt hints that explain when and how to use the node
Handles the this.input parameter appropriately if the node should work with previous node output
Follows the async function pattern even for synchronous operations
Provides meaningful console logging for debugging (but not excessive)
Uses proper JSDoc type annotation at the top

The node should be completely self-contained and ready to be registered with the NodeRegistry for use in workflows.




// CODE
i have this agentic workflow manager developed by myself. Here is the core implementation of it:
<file_map>
/Users/narcisbrindusescu/cod/Narcissus
└── agent
    └── flow-engine
        ├── core
        │   ├── FlowHub.js
        │   ├── FlowManager.js
        │   ├── NodeRegistry.js
        │   └── TriggerManager.js
        ├── nodes
        │   ├── text
        │   │   ├── analyze-sentiment.node.js
        │   │   └── string-uppercase.node.js
        │   └── utils
        │       └── log-message.node.js
        └── triggers
            └── types
                ├── emailTriggerHandler.js
                └── eventTriggerHandler.js

</file_map>

<file_contents>
File: /Users/narcisbrindusescu/cod/Narcissus/agent/flow-engine/core/FlowHub.js
```js
/**
 * FlowHub: A singleton manager for handling pause and resume operations
 * across all FlowManager instances. It allows workflows to request human intervention
 * and for an external UI layer (or any service) to respond and resume the flow.
 * This version uses a custom, environment-agnostic event bus and also handles
 * step events from FlowManager instances.
 */
const FlowHub = (function() {
    // _pausedFlows: Stores active pause states.
    // Key: pauseId (string)
    // Value: { resolve: Function (to resume the Promise), details: any, flowInstanceId: string }
    const _pausedFlows = new Map();

    // _listeners: Stores event listeners for the custom event bus.
    // Key: eventName (string)
    // Value: Array of callback functions
    const _listeners = {};

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
         * Emits an event to all registered listeners for that event type.
         * @param {string} eventName - The name of the event (e.g., 'flowPaused', 'flowManagerStep').
         * @param {object} eventData - The data to be passed to the listeners.
         */
        _emitEvent(eventName, eventData) {
            // console.debug(`[FlowHub] Emitting event: ${eventName}`, eventData);
            if (_listeners[eventName]) {
                _listeners[eventName].forEach(callback => {
                    try {
                        // Pass the eventData object directly to the callback
                        callback(eventData);
                    } catch (e) {
                        console.error(`[FlowHub] Error in listener for ${eventName}:`, e);
                    }
                });
            }
        },

        /**
         * Adds an event listener for events.
         * @param {string} eventName - Event to listen for ('flowPaused', 'flowResumed', 'resumeFailed', 'flowManagerStep', 'flowManagerNodeEvent').
         * @param {Function} callback - The function to call when the event occurs. The callback will receive the eventData object.
         */
        addEventListener(eventName, callback) {
            if (typeof callback !== 'function') {
                console.error('[FlowHub] addEventListener: callback must be a function.');
                return;
            }
            if (!_listeners[eventName]) {
                _listeners[eventName] = [];
            }
            _listeners[eventName].push(callback);
        },

        /**
         * Removes an event listener.
         * @param {string} eventName - The event name.
         * @param {Function} callback - The callback to remove.
         */
        removeEventListener(eventName, callback) {
            if (_listeners[eventName]) {
                _listeners[eventName] = _listeners[eventName].filter(cb => cb !== callback);
            }
        },

        /**
         * Called by a FlowManager node (via `this.humanInput`) to pause execution.
         * @param {object} options - Pause options.
         * @param {string} [options.pauseId] - A user-suggested ID for this pause. If not unique or provided, one is generated.
         * @param {any} [options.details] - Data/details about the pause, to be sent to the UI/service.
         * @param {string} options.flowInstanceId - The ID of the FlowManager instance initiating the pause.
         * @returns {Promise<any>} A promise that resolves with data when `resume()` is called for this pause.
         */
        requestPause({ pauseId: customPauseId, details, flowInstanceId }) {
            return new Promise((resolve) => {
                const pauseId = customPauseId && !_pausedFlows.has(customPauseId) ? customPauseId : generatePauseId(flowInstanceId || 'flow');

                if (_pausedFlows.has(pauseId)) {
                    console.warn(`[FlowHub] Pause ID ${pauseId} is already active. Overwriting the resolver for ${pauseId}.`);
                }
                _pausedFlows.set(pauseId, { resolve, details, flowInstanceId });
                this._emitEvent('flowPaused', { pauseId, details, flowInstanceId });
              //  console.log(`[FlowHub] Flow ${flowInstanceId} paused. ID: ${pauseId}. Details: ${JSON.stringify(details)}. Waiting for resume...`);
            });
        },

        /**
         * Called by an external system (e.g., UI or another service) to resume a paused flow.
         * @param {string} pauseId - The ID of the pause to resume.
         * @param {any} resumeData - Data to be passed back to the awaiting `humanInput()` call in the flow.
         * @returns {boolean} True if resume was successful, false otherwise (e.g., pauseId not found).
         */
        resume(pauseId, resumeData) {
            if (_pausedFlows.has(pauseId)) {
                const { resolve, details, flowInstanceId } = _pausedFlows.get(pauseId);
                resolve(resumeData);
                _pausedFlows.delete(pauseId);
                this._emitEvent('flowResumed', { pauseId, resumeData, details, flowInstanceId });
             //   console.log(`[FlowHub] Flow ${flowInstanceId} resumed. ID: ${pauseId} with data:`, resumeData);
                return true;
            } else {
                console.warn(`[FlowHub] No active pause found for ID: ${pauseId}. Cannot resume.`);
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
         * Gets details of all currently active pauses. Useful for a UI/service to display a list of pending actions.
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

export default FlowHub;
```

File: /Users/narcisbrindusescu/cod/Narcissus/agent/flow-engine/core/FlowManager.js
```js
// File: /Users/narcisbrindusescu/cod/Narcissus/agent/flow-engine/core/FlowManager.js

import FlowHub from './FlowHub.js';

/**
 * FlowManager: A powerful and flexible engine for orchestrating complex workflows,
 * particularly well-suited for AI agentic systems. It allows workflows to be defined
 * as serializable JSON-like structures, enabling dynamic generation, persistence,
 * and execution of directed graphs of tasks and decisions.
 *
 * Each node's execution context (`this`) provides:
 * - `state`: Access to the FlowManager's StateManager (get, set, undo, redo, etc.).
 * - `steps`: An array of previously executed steps in the current flow (providing history).
 * - `nodes`: The full list of node definitions for the current FlowManager instance.
 * - `self`: The definition or structure of the current node being executed.
 *           - For nodes specified as strings (resolved via scope):
 *             - If resolved to a full NodeDefinition (e.g., from NodeRegistry), `self` is that NodeDefinition.
 *             - If resolved to a simple function in scope, `self` is a synthetic descriptor for that function.
 *             - If unresolved, `self` is a minimal object with the identifier.
 *           - For functions directly in the workflow array, `self` is a synthetic descriptor object.
 *           - For structural nodes (arrays for sub-flows/loops, objects for branches/parameterized calls), `self` is the structure itself.
 * - `input`: The output data from the previously executed node in the current sequence.
 *            This is typically derived from the `results` array of the previous node's processed output.
 *            - If `results` had one item, `input` is that item.
 *            - If `results` had multiple items, `input` is the array of items.
 *            - For the first node in a sequence, or if the previous node had no `results`, `input` is `null`.
 * - `flowInstanceId`: The unique ID of the current FlowManager instance.
 * - `humanInput(details, customPauseId)`: Function to request human input, pausing the flow.
 * - `emit(customEventName, data)`: Function to emit a custom event via FlowHub.
 * - `on(customEventName, nodeCallback)`: Function to listen for custom events on FlowHub.
 *
 * Emits a 'flowManagerStep' event via FlowHub after each step is executed.
 *
 * @param {object} config - Configuration for the FlowManager.
 * @param {object} [config.initialState={}] - The initial state for the workflow.
 * @param {Array} [config.nodes=[]] - An array defining the workflow's structure.
 * @param {string} [config.instanceId] - An optional ID for this FlowManager instance.
 * @param {object} [config.scope={}] - The scope object containing node implementations (functions or NodeDefinition objects).
 * @param {any} [config.initialInput=null] - The initial input for the first node in the flow.
 * @returns {object} An API to run and interact with the flow.
 */
export function FlowManager({
    initialState,
    nodes,
    instanceId,
    scope: providedScope,
    initialInput = null // <<< ADDED initialInput parameter
} = {
    initialState: {},
    nodes: [],
    instanceId: undefined,
    scope: {}, // This default applies if the whole config object is missing
    initialInput: null // <<< ADDED default for destructuring
}) {
  const steps = [];
  let currentNode = null; // Represents the node definition *currently being executed or focused on* by the engine. Used by emit/on.
  let currentIndex = 0; // Index for iterating through the `nodes` array of this FlowManager instance.
  const flowInstanceId = instanceId || `fm-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const fmState = StateManager(initialState);
  let _resolveRunPromise = null;
  let _rejectRunPromise = null;
  
  const scope = providedScope || {}; // <<< MODIFIED: Ensure scope is always an object
  const _initialInput = initialInput; // <<< ADDED: Store initialInput for use later

  const _registeredHubListeners = [];

  /**
   * Manages the state of the FlowManager instance, including history for undo/redo.
   * @param {object} [_initialState={}] - The initial state for the StateManager.
   * @returns {object} An API to interact with the state.
   */
  function StateManager(_initialState = {}) {
    const _currentState = JSON.parse(JSON.stringify(_initialState));
    const _history = [JSON.parse(JSON.stringify(_initialState))];
    let _historyCurrentIndex = 0;

    return {
      get(path) {
        if (!path) return undefined; // MODIFIED: Or perhaps return undefined/null for consistency if path is empty
        const keys = path.split('.');
        let result = _currentState;
        for (const key of keys) {
          if (result === undefined || result === null || !Object.prototype.hasOwnProperty.call(result, key)) {
            return undefined; // <<< MODIFIED: Return undefined if path not fully resolved
          }
          result = result[key];
        }
        return result; // <<< MODIFIED: Return the actual stored value (could be null, undefined, '', etc.)
      },
      set(path, value) {
        let targetObjectForReturn; // What the 'set' operation effectively targeted
    
        if (path === null || path === '') {
            // The intention is to replace the entire state.
            // _currentState should become a deep copy of 'value'.
            const newFullState = JSON.parse(JSON.stringify(value));
            
            // Clear out the old _currentState properties
            Object.keys(_currentState).forEach(key => delete _currentState[key]);
            // Assign new properties from newFullState to _currentState
            Object.assign(_currentState, newFullState);
            targetObjectForReturn = _currentState;
        } else {
            // Setting a specific path
            const keys = path.split('.');
            let current = _currentState; // Work directly on _currentState for path setting
    
            for (let i = 0; i < keys.length - 1; i++) {
                const key = keys[i];
                if (!current[key] || typeof current[key] !== 'object') {
                    current[key] = {}; // Create structure if it doesn't exist
                }
                current = current[key];
            }
            const lastKey = keys[keys.length - 1];
            current[lastKey] = JSON.parse(JSON.stringify(value)); // Ensure deep copy of value being set
            targetObjectForReturn = current[lastKey];
        }
    
        // FIXED: Remove any future history entries and add the new state
        _history.splice(_historyCurrentIndex + 1); // Remove future entries
        _history.push(JSON.parse(JSON.stringify(_currentState))); // Add current modified state
        _historyCurrentIndex = _history.length - 1; // Update index to point to the new entry
    
        return JSON.parse(JSON.stringify(targetObjectForReturn)); // Return a deep copy of what was set
    },

      getState() { return JSON.parse(JSON.stringify(_currentState)); },
      canUndo() { return _historyCurrentIndex > 0; },
      canRedo() { return _historyCurrentIndex < _history.length - 1; },
      undo() {
        if (this.canUndo()) {
          _historyCurrentIndex--;
          // Clear current state
          Object.keys(_currentState).forEach(key => delete _currentState[key]);
          // Assign the historical state
          Object.assign(_currentState, JSON.parse(JSON.stringify(_history[_historyCurrentIndex])));
      }
      return this.getState();
      },
      redo() {
        if (this.canRedo()) {
          _historyCurrentIndex++;
          // Clear current state
          Object.keys(_currentState).forEach(key => delete _currentState[key]);
          // Assign the historical state
          Object.assign(_currentState, JSON.parse(JSON.stringify(_history[_historyCurrentIndex])));
      }
      return this.getState();
      },
      goToState(index) {
        if (index >= 0 && index < _history.length) {
          _historyCurrentIndex = index;
          // Clear current state
          Object.keys(_currentState).forEach(key => delete _currentState[key]);
          // Assign the historical state
          Object.assign(_currentState, JSON.parse(JSON.stringify(_history[_historyCurrentIndex])));
      }
      return this.getState();
      },
      getHistory() { return _history.map(s => JSON.parse(JSON.stringify(s))); },
      getCurrentIndex() { return _historyCurrentIndex; }
    };
  }

  /**
   * The execution context provided to each node's implementation function (`this` context).
   * `self`, `input`, and `flowInstanceId` are dynamically set or are instance-specific.
   * `steps` and `nodes` provide broader flow context.
   * `state` provides state management capabilities.
   * `emit`/`on`/`humanInput` provide interaction capabilities.
   */
  const baseExecutionContext = {
      state: fmState,
      steps,
      nodes,
      self: null, // Dynamically set in _nextStepInternal before each node execution
      input: null, // Dynamically set in _nextStepInternal before each node execution
      flowInstanceId: flowInstanceId, // Set once for the FlowManager instance
      /**
       * Requests human input, pausing the flow execution until input is provided via FlowHub.
       * Uses `currentNode` and `currentIndex` from FlowManager's lexical scope to identify the calling node.
       * @param {object} details - Details about the required input (passed to UI/responder).
       * @param {string} [customPauseId] - A custom ID for this pause request.
       * @returns {Promise<any>} A promise that resolves with the human-provided data.
       */
      humanInput: async function(details, customPauseId) {
         // console.log(`[FlowManager:${this.flowInstanceId}] Node (idx: ${currentIndex-1}, def: ${JSON.stringify(currentNode).substring(0,50)}...) requests human input. Details:`, details, "Pause ID hint:", customPauseId);
          const resumeData = await FlowHub.requestPause({
              pauseId: customPauseId,
              details,
              flowInstanceId: this.flowInstanceId
          });
         // console.log(`[FlowManager:${this.flowInstanceId}] Human input received for node (idx: ${currentIndex-1}):`, resumeData);
          return resumeData;
      },
      /**
       * Emits a custom event globally via FlowHub.
       * Uses `currentNode` and `currentIndex` from FlowManager's lexical scope to identify the emitting node.
       * @param {string} customEventName - The custom name of the event.
       * @param {any} data - The payload for the event.
       */
      emit: async function(customEventName, data) {
          const emittingNodeMeta = {
              index: currentIndex - 1,
              definition: currentNode
          };
          FlowHub._emitEvent('flowManagerNodeEvent', {
              flowInstanceId: this.flowInstanceId,
              emittingNode: {
                  index: emittingNodeMeta.index,
                  definition: JSON.parse(JSON.stringify(emittingNodeMeta.definition))
              },
              customEventName: customEventName,
              eventData: data,
              timestamp: Date.now()
          });
      },
      /**
       * Registers a listener on FlowHub for a custom node event.
       * Uses `currentNode` and `currentIndex` from FlowManager's lexical scope to identify the listening node.
       * The listener will be automatically cleaned up when this FlowManager instance is re-run.
       * @param {string} customEventName - The custom name of the event to listen for.
       * @param {Function} nodeCallback - The function to call when the event occurs.
       *                              It receives (data, meta) arguments.
       *                              'this' inside the callback is the `baseExecutionContext` of the listening node,
       *                              with 'self' and 'input' captured at the time of listener registration.
       */
      on: function(customEventName, nodeCallback) {
        if (typeof nodeCallback !== 'function') {
            console.error(`[FlowManager:${this.flowInstanceId}] Node 'on' listener: callback must be a function for event '${customEventName}'.`);
            return;
        }
    
        // Capture critical parts of the context AT THE TIME OF LISTENER REGISTRATION
        const capturedSelf = JSON.parse(JSON.stringify(this.self));
        const capturedInput = (typeof this.input === 'object' && this.input !== null)
                              ? JSON.parse(JSON.stringify(this.input))
                              : this.input;
        const flowInstanceId = this.flowInstanceId;
        const state = this.state;
        const emit = this.emit.bind(this);
        const humanInput = this.humanInput.bind(this);
        const steps = this.steps;
        const nodes = this.nodes;
    
        const listeningNodeMeta = {
            index: currentIndex - 1,
            definition: capturedSelf,
            flowInstanceId: flowInstanceId
        };
    
        const effectiveHubCallback = (flowHubEventData) => {
            if (flowHubEventData.customEventName === customEventName) {
                const meta = {
                    eventName: flowHubEventData.customEventName,
                    emittingNodeMeta: {
                        index: flowHubEventData.emittingNode.index,
                        definition: flowHubEventData.emittingNode.definition,
                        flowInstanceId: flowHubEventData.flowInstanceId
                    },
                    listeningNodeMeta: listeningNodeMeta
                };
    
                // Create a fresh context object with captured values
                const callbackThisContext = {
                    self: capturedSelf,
                    input: capturedInput,
                    flowInstanceId: flowInstanceId,
                    state: state,
                    emit: emit,
                    humanInput: humanInput,
                    steps: steps,
                    nodes: nodes,
                    on: function() {
                        console.warn(`[FlowManager:${flowInstanceId}] Cannot register new listeners from within an event callback`);
                    }
                };
    
                try {
                    nodeCallback.call(callbackThisContext, flowHubEventData.eventData, meta);
                } catch (e) {
                    console.error(`[FlowManager:${flowInstanceId}] Error in node event listener callback for '${customEventName}' (listener idx: ${listeningNodeMeta.index} in FM: ${listeningNodeMeta.flowInstanceId}):`, e);
                }
            }
        };
    
        FlowHub.addEventListener('flowManagerNodeEvent', effectiveHubCallback);
        _registeredHubListeners.push({
            hubEventName: 'flowManagerNodeEvent',
            effectiveHubCallback: effectiveHubCallback
        });
    }
  };

  /**
   * Finds a full NodeDefinition object or a synthetic definition from the scope.
   * This is primarily used to populate `this.self` in the node execution context.
   * It prioritizes finding full NodeDefinitions (objects with an `id`, `name`, `implementation`, etc.).
   * If the identifier points to a simple function in scope, a synthetic definition is returned.
   * @param {string} nodeIdentifier - The string identifier for the node.
   * @returns {object | null} The NodeDefinition object, a synthetic definition, or null if not suitably found.
   */
  function findNodeDefinitionInScope(nodeIdentifier) {
    if (!scope || typeof nodeIdentifier !== 'string') {
      return null;
    }

    const directMatch = scope[nodeIdentifier];

    // Case 1: Direct match is a full NodeDefinition (e.g., "id:name" key from NodeRegistry.getScope())
    if (directMatch && typeof directMatch === 'object' && directMatch !== null && typeof directMatch.implementation === 'function') {
      return directMatch;
    }

    // Case 2: Resolve by ID from "id:name" keys (e.g., "text.analysis.sentiment")
    for (const key in scope) {
      if (Object.prototype.hasOwnProperty.call(scope, key) && key.startsWith(nodeIdentifier + ":")) {
        const entry = scope[key];
        // Check if it's a valid NodeDefinition structure
        if (entry && typeof entry === 'object' && typeof entry.implementation === 'function') {
          return entry;
        }
      }
    }

    // Case 3: Resolve by Name from "id:name" keys (e.g., "Sentiment Analyzer")
    for (const key in scope) {
      if (Object.prototype.hasOwnProperty.call(scope, key) && key.endsWith(":" + nodeIdentifier)) {
        const entry = scope[key];
        // Check if it's a valid NodeDefinition structure
        if (entry && typeof entry === 'object' && typeof entry.implementation === 'function') {
          return entry;
        }
      }
    }

    // Case 4: Direct match was a simple function (user-added function to scope)
    // Create a synthetic definition for `this.self`.
    if (directMatch && typeof directMatch === 'function') {
        return {
            id: nodeIdentifier, // The key used to find it in scope
            name: nodeIdentifier, // Use identifier as name
            description: 'A custom function provided directly in the FlowManager scope.',
            // The actual implementation is resolved separately by `resolveNodeFromScope`.
            // `self` is primarily metadata.
            _isScopeProvidedFunction: true
        };
    }

    // If not found as a full NodeDefinition or a direct function in scope
    return null;
  }

  /**
   * Resolves a node identifier string to its executable implementation function
   * using the FlowManager's 'scope' object.
   * (Original logic for resolving implementation remains unchanged)
   * @param {string} nodeIdentifier - The string identifier for the node.
   * @returns {Function | null} The executable function or null if not found.
   */
  function resolveNodeFromScope(nodeIdentifier) {
    if (!scope || typeof nodeIdentifier !== 'string') {
      return null;
    }
    const directMatch = scope[nodeIdentifier];
    if (directMatch) {
      if (typeof directMatch === 'function') {
        return directMatch;
      }
      if (typeof directMatch.implementation === 'function') {
        return directMatch.implementation;
      }
    }
    for (const key in scope) {
      if (Object.prototype.hasOwnProperty.call(scope, key) && key.startsWith(nodeIdentifier + ":")) {
        const entry = scope[key];
        if (entry && typeof entry.implementation === 'function') {
          return entry.implementation;
        }
      }
    }
    for (const key in scope) {
      if (Object.prototype.hasOwnProperty.call(scope, key) && key.endsWith(":" + nodeIdentifier)) {
        const entry = scope[key];
        if (entry && typeof entry.implementation === 'function') {
          return entry.implementation;
        }
      }
    }
    return null;
  }

  /**
   * Processes the value returned by a node's implementation into a standard output format.
   * (Original logic remains unchanged)
   * @param {any} returnedValue - The value returned by the node's implementation.
   * @param {object} context - The execution context (`baseExecutionContext`), enabling edge functions to use `this`.
   * @returns {Promise<object>} A promise that resolves to the standard output object {edges: string[], results?: any[]}.
   */
  async function processReturnedValue(returnedValue, context) {
    let output = null;
    if (Array.isArray(returnedValue)) {
      if (returnedValue.every(item => typeof item === 'string') && returnedValue.length > 0) {
        output = { edges: returnedValue };
      } else {
        output = { edges: ['pass'], results: [returnedValue] };
      }
    } else if (typeof returnedValue === 'object' && returnedValue !== null) {
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
        for (const k of edgeNames) {
          try {
            const edgeFn = edgeFunctions[k];
            // Pass the full context to edge functions, allowing them to use this.state, this.input etc.
            let result = await Promise.resolve(edgeFn.apply(context, []));
            results.push(result);
          } catch (e) {
            console.error(`[FlowManager:${flowInstanceId}] Error executing edge function for '${k}':`, e);
            results.push({ error: e.message });
          }
        }
        output = {
          edges: edgeNames,
          results: results
        };
      } else {
        output = { edges: ['pass'], results: [returnedValue] };
      }
    } else if (typeof returnedValue === 'string') {
      output = { edges: [returnedValue], results: [returnedValue] }; // <<< MODIFIED to include results
    } else {
      output = { edges: ['pass'], results: [returnedValue] };
    }

    if (!output.edges || output.edges.length === 0) {
        output.edges = ['pass'];
    }
    return output;
  }

  /**
   * Manages the execution of a loop construct within the flow.
   * @param {Array} loopNodesConfig - The array defining the loop's controller and actions.
   * @param {any} loopInitialInput - The input to the loop construct for the first iteration.
   * @returns {Promise<object>} A promise resolving to { internalSteps: Array, finalOutput: object }.
   */
  async function loopManager(loopNodesConfig, loopInitialInput) { // <<< ADDED loopInitialInput
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

      const controllerFM = FlowManager({
        initialState: fmState.getState(),
        nodes: [controllerNode],
        instanceId: `${loopIterationInstanceId}-ctrl`,
        scope: scope,
        initialInput: (iterationCount === 1) ? loopInitialInput : (lastLoopIterationOutput?.results ? lastLoopIterationOutput.results[0] : null) // <<< MODIFIED to use loopInitialInput
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
        console.warn(`[FlowManager:${flowInstanceId}] Loop controller (iter ${iterationCount}) did not produce output. Defaulting to 'exit'.`);
        controllerOutput = { edges: ['exit'] };
        loopInternalSteps.push({
          nodeDetail: `Loop Iter ${iterationCount}: Controller Error or No Output`, outputFromController: controllerOutput,
        });
      }

      lastLoopIterationOutput = controllerOutput;

      if (controllerOutput.edges.includes('exit') || controllerOutput.edges.includes('exit_forced')) {
        break;
      }

      if (actionNodes.length > 0) {
        const actionsFM = FlowManager({
          initialState: fmState.getState(),
          nodes: actionNodes,
          instanceId: `${loopIterationInstanceId}-actions`,
          scope: scope,
          initialInput: (controllerOutput?.results && controllerOutput.results.length > 0) ? controllerOutput.results[0] : null // <<< ADDED initialInput for actions
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

  /**
   * Evaluates a single node in the workflow.
   * This function determines the node type and executes it accordingly.
   * It relies on `baseExecutionContext` (accessible via `this` in node implementations and edge functions)
   * having been pre-populated with `self` and `input` by `_nextStepInternal`.
   * @param {any} nodeDefinitionFromWorkflow - The node definition from the `nodes` array to evaluate.
   * @returns {Promise<void>}
   */
  async function evaluateNode(nodeDefinitionFromWorkflow) {
    let output = null;
    let returnedValue;
    const nodeToRecord = nodeDefinitionFromWorkflow;
    let subStepsToRecord = null;

    // Helper to execute a node's implementation function with the correct context and arguments.
    // `baseExecutionContext` is used as `this`, so it has `self`, `input`, `state`, etc.
    async function executeFunc(fn, context, ...args) {
        return await Promise.resolve(fn.apply(context, args));
    }

    if (typeof nodeDefinitionFromWorkflow === 'function') {
      returnedValue = await executeFunc(nodeDefinitionFromWorkflow, baseExecutionContext);
    } else if (typeof nodeDefinitionFromWorkflow === 'string') {
      const implementation = resolveNodeFromScope(nodeDefinitionFromWorkflow);
      if (implementation) {
        returnedValue = await executeFunc(implementation, baseExecutionContext);
      } else {
        console.error(`[FlowManager:${flowInstanceId}] Node/Function '${nodeDefinitionFromWorkflow}' not found in scope. Treating as error.`);
        output = { edges: ['error'], errorDetails: `Node/Function '${nodeDefinitionFromWorkflow}' not found in scope` };
      }
    } else if (Array.isArray(nodeDefinitionFromWorkflow)) {
      if (nodeDefinitionFromWorkflow.length === 1 && Array.isArray(nodeDefinitionFromWorkflow[0]) && nodeDefinitionFromWorkflow[0].length > 0) {
        // Loop construct: [[controller, ...actions]]
        const loopRun = await loopManager(nodeDefinitionFromWorkflow[0], baseExecutionContext.input); // <<< PASSED input to loopManager
        output = loopRun.finalOutput;
        subStepsToRecord = loopRun.internalSteps;
      } else if (nodeDefinitionFromWorkflow.length > 0) {
        // Sub-flow construct: [node1, node2, ...]
        // Each sub-FlowManager will manage its own `input` and `self` context for its nodes.
        const subflowFM = FlowManager({
          initialState: fmState.getState(),
          nodes: nodeDefinitionFromWorkflow,
          instanceId: `${flowInstanceId}-subflow-idx${currentIndex-1}`,
          scope: scope,
          initialInput: baseExecutionContext.input // <<< ADDED: Pass current input as initial for sub-flow
        });
        const subflowResultSteps = await subflowFM.run();
        fmState.set(null, subflowFM.getStateManager().getState());
        output = subflowResultSteps?.at(-1)?.output || { edges: ['pass'] };
        subStepsToRecord = subflowResultSteps;
      } else {
        // Empty array as a node: considered a pass-through
        output = {edges: ['pass']};
      }
    } else if (typeof nodeDefinitionFromWorkflow === 'object' && nodeDefinitionFromWorkflow !== null) {
      if (Object.keys(nodeDefinitionFromWorkflow).length === 0) {
        // Empty object as a node: considered a pass-through
        output = { edges: ['pass'] };
      } else {
        const nodeKey = Object.keys(nodeDefinitionFromWorkflow)[0];
        const nodeValue = nodeDefinitionFromWorkflow[nodeKey];

        const implementation = resolveNodeFromScope(nodeKey);

        if (implementation && Object.keys(nodeDefinitionFromWorkflow).length === 1 && ( (typeof nodeValue === 'object' && !Array.isArray(nodeValue)) || nodeValue === undefined) ) {
          // Case 1: Parameterized function call: { "nodeNameOrId": {param1: value1, ...} }
          returnedValue = await executeFunc(implementation, baseExecutionContext, nodeValue || {});
        } else {
          // Case 2: Branching construct: { "edgeName1": nodeA, "edgeName2": nodeB, ... }
          const prevStepOutput = steps.at(-1)?.output; // Output of the node *before this branch object* in the current flow
          const prevEdges = (prevStepOutput && prevStepOutput.edges) ? prevStepOutput.edges : [];
          let branchTaken = false;

          for (const edgeKey of Object.keys(nodeDefinitionFromWorkflow)) {
            if (prevEdges.includes(edgeKey)) {
              const branchNodeDefinition = nodeDefinitionFromWorkflow[edgeKey];
              const branchFM = FlowManager({
                initialState: fmState.getState(),
                nodes: Array.isArray(branchNodeDefinition) ? branchNodeDefinition : [branchNodeDefinition],
                instanceId: `${flowInstanceId}-branch-${edgeKey}-idx${currentIndex-1}`,
                scope: scope,
                initialInput: baseExecutionContext.input // <<< ADDED: Pass current input (from node before branch)
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
      console.warn(`[FlowManager:${flowInstanceId}] Unknown node type or unhandled case:`, nodeDefinitionFromWorkflow);
      output = { edges: ['error', 'pass'], errorDetails: 'Unknown node type' };
    }

    if (returnedValue !== undefined && output === null) {
      output = await processReturnedValue(returnedValue, baseExecutionContext);
    }

    if (!output || typeof output.edges === 'undefined' || !Array.isArray(output.edges) || output.edges.length === 0) {
      output = { ...(output || {}), edges: ['pass'] };
    }

    steps.push({ node: nodeToRecord, output, ...(subStepsToRecord && { subSteps: subStepsToRecord }) });

    FlowHub._emitEvent('flowManagerStep', {
      flowInstanceId: flowInstanceId,
      stepIndex: currentIndex - 1, // 0-based index of the node just processed (currentIndex was already incremented for the next step)
      stepData: JSON.parse(JSON.stringify(steps.at(-1))),
      currentState: fmState.getState()
    });
  }

  /**
   * Internal recursive function to process the next node in the `nodes` array.
   * Crucially, it sets up `baseExecutionContext.input` and `baseExecutionContext.self`
   * before each call to `evaluateNode`.
   * @returns {Promise<void>}
   */
  async function _nextStepInternal() {
    if (currentIndex < nodes.length) {
      // `currentNode` (lexical scope) is set to the node definition that is *about to be processed*.
      // This is used by `emit`, `on`, `humanInput` in `baseExecutionContext` to identify their source.
      currentNode = nodes[currentIndex];
      const nodeToEvaluate = nodes[currentIndex]; // The actual node definition from the workflow `nodes` array.

      // 1. Set `baseExecutionContext.input` from the output of the previous step in *this* FlowManager instance
      //    OR from _initialInput if this is the first step.
      if (currentIndex === 0 && _initialInput !== null) { // <<< MODIFIED: Check _initialInput for the very first node
          baseExecutionContext.input = _initialInput;
      } else {
          const previousStep = steps.at(-1);
          if (previousStep && previousStep.output && Array.isArray(previousStep.output.results)) {
              if (previousStep.output.results.length === 1) {
                  baseExecutionContext.input = previousStep.output.results[0];
              } else if (previousStep.output.results.length > 0) {
                  baseExecutionContext.input = previousStep.output.results; // Pass array if multiple results
              } else {
                  baseExecutionContext.input = null; // Empty results array
              }
          } else {
              // No previous step, or previous step had no `results` array (e.g. only edges).
              baseExecutionContext.input = null;
          }
      }


      // 2. Set `baseExecutionContext.self` with the definition/structure of the current node.
      let nodeDefinitionForSelfContext;
      if (typeof nodeToEvaluate === 'string') {
        nodeDefinitionForSelfContext = findNodeDefinitionInScope(nodeToEvaluate);
        if (!nodeDefinitionForSelfContext) {
          // If string identifier isn't a known NodeDefinition or scoped function,
          // `self` becomes a minimal object representing this unresolved identifier.
          nodeDefinitionForSelfContext = {
            id: nodeToEvaluate,
            name: nodeToEvaluate,
            description: "An identifier for a node or function that could not be fully resolved from scope for the 'self' context.",
            source:scope[nodeToEvaluate] ? scope[nodeToEvaluate].toString() : '',
            _unresolvedIdentifier: true
          }
        } else if (scope[nodeToEvaluate] && typeof scope[nodeToEvaluate] === 'function' && !nodeDefinitionForSelfContext._isScopeProvidedFunction) {
             // This case handles if findNodeDefinitionInScope returns a full NodeDef, but the original string
             // was actually a direct function key in scope (e.g. "myDirectScopeFunc" instead of "myDirectScopeFunc:My Custom Function")
             // We still want `self` to reflect the direct function call in this case if findNodeDefinitionInScope didn't already mark it.
             nodeDefinitionForSelfContext = { // Overwrite/refine if necessary
                id: nodeToEvaluate,
                name: nodeToEvaluate,
                description: 'A custom function provided directly in the FlowManager scope.',
                source: scope[nodeToEvaluate].toString(),
                _isScopeProvidedFunction: true
            };
        } else if (nodeDefinitionForSelfContext && nodeDefinitionForSelfContext.implementation) {
            // Ensure source is correctly captured for resolved NodeDefinitions too.
            nodeDefinitionForSelfContext = {
                ...nodeDefinitionForSelfContext,
                source: nodeDefinitionForSelfContext.implementation.toString()
            };
        }

      } else if (typeof nodeToEvaluate === 'function') {
        // For a direct function in the nodes array, `self` is a synthetic definition.
        nodeDefinitionForSelfContext = {
          id: `workflow-function-${currentIndex}`,
          name: `Workflow-Defined Function @ index ${currentIndex}`,
          description: 'A function provided directly within the workflow nodes definition.',
          source: nodeToEvaluate.toString(), // Store the function source code for reference
          _isWorkflowProvidedFunction: true
        };
      } else if (typeof nodeToEvaluate === 'object' && nodeToEvaluate !== null && !Array.isArray(nodeToEvaluate)) {
        // OBJECT CASE: Could be a parameterized call, a branch structure, or an empty object.
        const keys = Object.keys(nodeToEvaluate);

        if (keys.length === 1) {
          const nodeIdentifier = keys[0];
          const nodeParams = nodeToEvaluate[nodeIdentifier];

          // Attempt to resolve the key as a function to see if it's a callable node.
          const implementation = resolveNodeFromScope(nodeIdentifier);

          // Check if the structure matches a parameterized call:
          // - An implementation function must exist for the identifier.
          // - The value associated with the identifier (nodeParams) must be an object (but not an array) or undefined.
          const isParameterizedCallStructure = implementation &&
                                               ((typeof nodeParams === 'object' && !Array.isArray(nodeParams) && nodeParams !== null) || nodeParams === undefined);

          if (isParameterizedCallStructure) {
            // This node is a parameterized function call.
            // Construct 'self' with details about the function being called.
            const selfDefCandidate = findNodeDefinitionInScope(nodeIdentifier);

            if (selfDefCandidate && typeof selfDefCandidate === 'object' && !selfDefCandidate._unresolvedIdentifier) {
                // A definition (full NodeDefinition or synthetic for a scope function) was found.
                // Use it as the base for 'self'.
                nodeDefinitionForSelfContext = {
                    ...selfDefCandidate, // Spread the properties of the found definition
                    description: selfDefCandidate.description || `A parameterized call to '${nodeIdentifier}'.`, // Ensure description exists
                    source: implementation.toString(), // Actual source code of the implementation
                    parametersProvided: nodeParams,    // Parameters passed in the workflow
                    _isParameterizedCall: true         // Flag indicating this type of 'self'
                    // _isScopeProvidedFunction will be preserved if selfDefCandidate had it.
                };
            } else {
                 // Fallback: Implementation was found, but findNodeDefinitionInScope didn't return a rich/resolved object.
                 // Create a more basic synthetic 'self'.
                 nodeDefinitionForSelfContext = {
                    id: nodeIdentifier,
                    name: nodeIdentifier, // Default name to the identifier
                    description: `A parameterized call to the function '${nodeIdentifier}'.`,
                    source: implementation.toString(),
                    parametersProvided: nodeParams,
                    _isParameterizedCall: true
                };
            }
          } else {
            // Not a parameterized call (e.g., implementation not found for the key,
            // or the value 'nodeParams' is an array, suggesting a branch).
            // 'self' is the object structure itself (e.g., for a branch).
            nodeDefinitionForSelfContext = nodeToEvaluate;
          }
        } else {
          // Object with multiple keys (likely a branch) or an empty object (pass-through).
          // 'self' is the object structure itself.
          nodeDefinitionForSelfContext = nodeToEvaluate;
        }
      } else if (Array.isArray(nodeToEvaluate)) {
        // ARRAY CASE: This is a sub-flow or a loop construct.
        // 'self' is the array structure itself as defined in the workflow.
        nodeDefinitionForSelfContext = nodeToEvaluate;
      } else {
        // FALLBACK: For any other unexpected node types.
        console.warn(`[FlowManager:${flowInstanceId}] Unhandled node type for 'self' context construction:`, nodeToEvaluate);
        // Default to setting 'self' as the node itself, though its handling might be undefined.
        nodeDefinitionForSelfContext = nodeToEvaluate;
      }

      baseExecutionContext.self = nodeDefinitionForSelfContext;

      // Increment `currentIndex` *before* calling `evaluateNode` for the current node.
      // This means `currentIndex` in the lexical scope (used by emit/on) will point to the *next* node's slot,
      // so `currentIndex - 1` correctly refers to the 0-based index of the node currently being evaluated.
      currentIndex++;

      await evaluateNode(nodeToEvaluate); // Pass the original node definition from the `nodes` array

      await _nextStepInternal(); // Recurse for the next step
    } else {
      // All nodes in this FlowManager instance processed
      if (_resolveRunPromise) {
        _resolveRunPromise(JSON.parse(JSON.stringify(steps)));
        _resolveRunPromise = null; _rejectRunPromise = null;
      }
    }
  }

  // Public API for the FlowManager instance
  return {
    /**
     * Starts or re-runs the flow execution from the beginning.
     * @returns {Promise<Array>} A promise that resolves with an array of all executed steps.
     */
    async run() {
      currentIndex = 0;
      steps.length = 0;

      _registeredHubListeners.forEach(listenerRegistration => {
          FlowHub.removeEventListener(listenerRegistration.hubEventName, listenerRegistration.effectiveHubCallback);
      });
      _registeredHubListeners.length = 0;

      return new Promise(async (resolve, reject) => {
        _resolveRunPromise = resolve;
        _rejectRunPromise = reject;

        if (!nodes || nodes.length === 0) {
        //  console.log(`[FlowManager:${flowInstanceId}] No nodes to execute.`);
          resolve([]);
          _resolveRunPromise = null; _rejectRunPromise = null;
          return;
        }

        try {
         // console.log(`[FlowManager:${flowInstanceId}] Starting execution. Total nodes: ${nodes.length}. Scope keys: ${Object.keys(scope).length}`);
          await _nextStepInternal();
       //   console.log(`[FlowManager:${flowInstanceId}] Execution finished. Total steps executed: ${steps.length}.`);
        } catch (error) {
          console.error(`[FlowManager:${flowInstanceId}] Error during flow execution:`, error);
          if(_rejectRunPromise) _rejectRunPromise(error);
          _resolveRunPromise = null; _rejectRunPromise = null;
        }
      });
    },
    /**
     * Retrieves a deep copy of all steps executed so far in the current or last run.
     * @returns {Array} An array of step objects.
     */
    getSteps: () => JSON.parse(JSON.stringify(steps)),
    /**
     * Retrieves the StateManager instance for this FlowManager.
     * @returns {object} The StateManager instance.
     */
    getStateManager: () => fmState,
    /**
     * Retrieves the unique instance ID of this FlowManager.
     * @returns {string} The instance ID.
     */
    getInstanceId: () => flowInstanceId
  };
}
```

File: /Users/narcisbrindusescu/cod/Narcissus/agent/flow-engine/core/NodeRegistry.js
```js
// src/flow-engine/core/NodeRegistry.js

const _nodes = new Map(); // Key: nodeId (string), Value: NodeDefinition

export const NodeRegistry = {
    /**
     * Registers a node definition.
     * @param {import('../types/flow-types.jsdoc.js').NodeDefinition} nodeDefinition - The node definition object.
     * @returns {boolean} True if registration was successful, false otherwise.
     */
    register(nodeDefinition) {
        if (!nodeDefinition || !nodeDefinition.id || typeof nodeDefinition.implementation !== 'function' || !nodeDefinition.description) {
            console.error("[NodeRegistry] Invalid node definition: Requires id, implementation, and description.", nodeDefinition);
            return false;
        }
        if (_nodes.has(nodeDefinition.id)) {
            console.warn(`[NodeRegistry] Node with id '${nodeDefinition.id}' (from ${nodeDefinition._sourcePath || 'unknown'}) is being re-registered. Overwriting previous (from ${_nodes.get(nodeDefinition.id)?._sourcePath || 'unknown'}).`);
        }
        _nodes.set(nodeDefinition.id, nodeDefinition);
        return true;
    },

    /**
     * Retrieves a node definition by its ID.
     * @param {string} nodeId - The ID of the node to retrieve.
     * @returns {import('../types/flow-types.jsdoc.js').NodeDefinition | undefined} The node definition or undefined if not found.
     */
    get(nodeId) {
        return _nodes.get(nodeId);
    },

    /**
     * Finds nodes based on specified criteria.
     * AI agents will heavily use this for tool discovery.
     * @param {object} criteria - The search criteria.
     * @param {string} [criteria.text] - Free-text search across name, description, tags, AI hints.
     * @param {string[]} [criteria.categories] - An array of categories to match (AND logic).
     * @param {string[]} [criteria.tags] - An array of tags to match (AND logic).
     * @param {string} [criteria.inputNeeds] - A description of an input the agent has/needs to provide.
     * @param {string} [criteria.outputProvides] - A description of an output the agent is looking for.
     * @returns {import('../types/flow-types.jsdoc.js').NodeDefinition[]} An array of matching node definitions.
     */
    find({ text, categories, tags, inputNeeds, outputProvides }) {
        let results = Array.from(_nodes.values());

        if (text) {
            const lowerText = text.toLowerCase();
            results = results.filter(node =>
                (node.name && node.name.toLowerCase().includes(lowerText)) || // Added check for node.name existence
                node.description.toLowerCase().includes(lowerText) ||
                (node.tags && node.tags.some(tag => tag.toLowerCase().includes(lowerText))) ||
                (node.aiPromptHints && (
                    (node.aiPromptHints.summary && node.aiPromptHints.summary.toLowerCase().includes(lowerText)) ||
                    (node.aiPromptHints.useCase && node.aiPromptHints.useCase.toLowerCase().includes(lowerText)) ||
                    (node.aiPromptHints.toolName && node.aiPromptHints.toolName.toLowerCase().includes(lowerText))
                ))
            );
        }
        if (categories && categories.length) {
            results = results.filter(node => node.categories && categories.every(cat => node.categories.includes(cat)));
        }
        if (tags && tags.length) {
            results = results.filter(node => node.tags && tags.every(tag => node.tags.includes(tag)));
        }

        // Basic conceptual search for input/output needs (can be made more sophisticated with NLP/embeddings)
        if (inputNeeds) {
            const lowerInputNeeds = inputNeeds.toLowerCase();
            results = results.filter(node =>
                node.inputs && node.inputs.some(input => input.description.toLowerCase().includes(lowerInputNeeds))
            );
        }
        if (outputProvides) {
            const lowerOutputProvides = outputProvides.toLowerCase();
            results = results.filter(node =>
                (node.outputs && node.outputs.some(output => output.description.toLowerCase().includes(lowerOutputProvides))) ||
                (node.edges && node.edges.some(edge => edge.description.toLowerCase().includes(lowerOutputProvides)))
            );
        }
        return results;
    },

    /**
     * Retrieves all registered node definitions.
     * @returns {import('../types/flow-types.jsdoc.js').NodeDefinition[]} An array of all node definitions.
     */
    getAll() {
        return Array.from(_nodes.values());
    },

    /**
     * Retrieves a scope object containing full node definitions, keyed by "id:name".
     * The keys are in the format "node.id:node.name" (e.g., "text.transform.toUpperCase:Convert to Uppercase").
     * The values are the full node definition objects.
     * This scope can be augmented and then used by FlowManager (e.g., by assigning to globalThis.scope)
     * to execute nodes.
     * @returns {Object.<string, import('../types/flow-types.jsdoc.js').NodeDefinition>} 
     *          An object mapping "id:name" strings to their full node definitions.
     *          User-added functions will be directly functions, not NodeDefinition objects.
     */
    getScope() {
        const scopeObject = {};
        for (const [nodeId, nodeDefinition] of _nodes) {
            // Ensure essential properties for forming the key and for the definition to be useful
            if (nodeDefinition && nodeDefinition.id && nodeDefinition.name && typeof nodeDefinition.implementation === 'function') {
                const qualifiedKey = `${nodeDefinition.id}:${nodeDefinition.name}`;
                scopeObject[qualifiedKey] = nodeDefinition; // Store the whole definition
            } else {
                console.warn(`[NodeRegistry.getScope] Skipping node due to missing id, name, or implementation:`, nodeDefinition.id || nodeDefinition);
            }
        }
        return scopeObject;
    }
};
```

File: /Users/narcisbrindusescu/cod/Narcissus/agent/flow-engine/core/TriggerManager.js
```js
import FlowHub from './FlowHub.js';
import { FlowManager } from './FlowManager.js'; // Assuming FlowManager is a named export


/**
 * TriggerManager: Manages the registration, activation, and execution of workflows
 * based on external triggers.
 *
 * @param {object} options
 * @param {NodeRegistryType} options.nodeRegistry - The NodeRegistry instance.
 * @returns {object} An API to manage triggers.
 */
export function TriggerManager({ nodeRegistry }) {
    if (!nodeRegistry) {
        throw new Error("[TriggerManager] NodeRegistry instance is required.");
    }

    /** @type {Map<string, TriggerDefinition>} */
    const _triggers = new Map();
    /** @type {Map<string, TriggerTypeHandler>} */
    const _triggerTypeHandlers = new Map();
    /** @type {Map<string, any>} */ // Stores context returned by handler's activate (e.g., interval IDs)
    const _activeListeners = new Map();
    const _nodeRegistryInstance = nodeRegistry; // Store the provided NodeRegistry

    console.log("[TriggerManager] Initialized.");

    /**
     * Handles an event fired by an active trigger.
     * This is an internal helper function.
     * @param {string} triggerId - The ID of the trigger that fired.
     * @param {any} eventData - The data associated with the event.
     */
    async function _handleTriggerEvent(triggerId, eventData) {
        const triggerDef = _triggers.get(triggerId);
        if (!triggerDef) {
            console.error(`[TriggerManager] Received event for unknown triggerId '${triggerId}'.`);
            return;
        }

        console.log(`[TriggerManager] Trigger '${triggerId}' fired. Event data:`, eventData);

        let initialState = {};
        if (typeof triggerDef.initialStateFunction === 'function') {
            try {
                initialState = triggerDef.initialStateFunction(eventData) || {};
            } catch (e) {
                console.error(`[TriggerManager] Error executing initialStateFunction for trigger '${triggerId}':`, e);
                FlowHub._emitEvent('trigger:error', { triggerId, error: e.message, type: 'initialStateFunction', eventData, timestamp: Date.now() });
                // Potentially abort or proceed with empty/default state
            }
        } else {
            initialState = { triggerEvent: eventData }; // Default behavior
        }
        
        const currentScope = _nodeRegistryInstance.getScope(); // Get fresh scope
        const flowInstanceId = `fm-trigger-${triggerId}-${Date.now()}`;

        FlowHub._emitEvent('trigger:fired', {
            triggerId,
            eventData,
            initialStatePrepared: initialState,
            flowInstanceIdToRun: flowInstanceId,
            timestamp: Date.now()
        });
        
        const fm = FlowManager({
            initialState,
            nodes: triggerDef.workflowNodes,
            instanceId: flowInstanceId,
            scope: currentScope
        });

        console.log(`[TriggerManager] Starting workflow for trigger '${triggerId}' with FlowManager ID: ${flowInstanceId}`);
        FlowHub._emitEvent('workflow:startedByTrigger', {
            triggerId,
            flowInstanceId,
            workflowNodes: triggerDef.workflowNodes,
            initialState,
            timestamp: Date.now()
        });

        try {
            const results = await fm.run();
            console.log(`[TriggerManager] Workflow for trigger '${triggerId}' (FM: ${flowInstanceId}) completed. Steps: ${results.length}`);
            FlowHub._emitEvent('workflow:completedByTrigger', {
                triggerId,
                flowInstanceId,
                results,
                finalState: fm.getStateManager().getState(),
                timestamp: Date.now()
            });
        } catch (error) {
            console.error(`[TriggerManager] Workflow for trigger '${triggerId}' (FM: ${flowInstanceId}) failed:`, error);
            FlowHub._emitEvent('workflow:failedByTrigger', {
                triggerId,
                flowInstanceId,
                error: error.message, // Use error.message to avoid complex objects in event
                timestamp: Date.now()
            });
        }
    }

    // Public API
    return {
        /**
         * Adds a handler for a specific trigger type.
         * @param {string} type - The trigger type (e.g., "email").
         * @param {TriggerTypeHandler} handler - The handler object.
         */
        addTriggerTypeHandler(type, handler) {
            if (_triggerTypeHandlers.has(type)) {
                console.warn(`[TriggerManager] Trigger type handler for '${type}' is being replaced.`);
            }
            if (typeof handler.activate !== 'function' || typeof handler.deactivate !== 'function') {
                console.error(`[TriggerManager] Invalid handler for type '${type}'. Must have 'activate' and 'deactivate' methods.`);
                return;
            }
            _triggerTypeHandlers.set(type, handler);
            console.log(`[TriggerManager] Added handler for trigger type: ${type}`);
        },

        /**
         * Registers a trigger definition.
         * @param {TriggerDefinition} triggerDefinition - The trigger definition.
         * @returns {boolean} True if registration was successful.
         */
        register(triggerDefinition) {
            if (!triggerDefinition || !triggerDefinition.triggerId || !triggerDefinition.type || !triggerDefinition.workflowNodes) {
                console.error("[TriggerManager] Invalid trigger definition.", triggerDefinition);
                return false;
            }
            if (!_triggerTypeHandlers.has(triggerDefinition.type)) {
                console.error(`[TriggerManager] No handler registered for trigger type '${triggerDefinition.type}' (for triggerId '${triggerDefinition.triggerId}'). Register a handler first.`);
                return false;
            }
            _triggers.set(triggerDefinition.triggerId, triggerDefinition);
            FlowHub._emitEvent('trigger:registered', {
                triggerId: triggerDefinition.triggerId,
                type: triggerDefinition.type,
                config: triggerDefinition.config,
                timestamp: Date.now()
            });
            console.log(`[TriggerManager] Registered trigger: ${triggerDefinition.triggerId} (type: ${triggerDefinition.type})`);
            return true;
        },

        /**
         * Activates a registered trigger, making it listen for events.
         * @param {string} triggerId - The ID of the trigger to activate.
         * @returns {Promise<boolean>} True if activation was successful.
         */
        async activate(triggerId) {
            if (_activeListeners.has(triggerId)) {
                console.warn(`[TriggerManager] Trigger '${triggerId}' is already active.`);
                return true;
            }
            const triggerDef = _triggers.get(triggerId);
            if (!triggerDef) {
                console.error(`[TriggerManager] Trigger '${triggerId}' not found for activation.`);
                return false;
            }
            const handler = _triggerTypeHandlers.get(triggerDef.type);
            if (!handler) {
                console.error(`[TriggerManager] No handler for trigger type '${triggerDef.type}' (triggerId '${triggerId}').`);
                return false;
            }

            try {
                console.log(`[TriggerManager] Activating trigger: ${triggerId}`);
                const onTriggerFired = async (eventData) => {
                    // Call the internal _handleTriggerEvent
                    await _handleTriggerEvent(triggerId, eventData);
                };

                const activationContext = await handler.activate(triggerDef.config, onTriggerFired, triggerId, FlowHub);
                _activeListeners.set(triggerId, activationContext);
                FlowHub._emitEvent('trigger:activated', { triggerId, timestamp: Date.now() });
                console.log(`[TriggerManager] Activated trigger: ${triggerId}`);
                return true;
            } catch (error) {
                console.error(`[TriggerManager] Error activating trigger '${triggerId}':`, error);
                FlowHub._emitEvent('trigger:error', { triggerId, error: error.message, type: 'activation', timestamp: Date.now() });
                return false;
            }
        },

        /**
         * Deactivates an active trigger.
         * @param {string} triggerId - The ID of the trigger to deactivate.
         * @returns {Promise<boolean>} True if deactivation was successful.
         */
        async deactivate(triggerId) {
            const triggerDef = _triggers.get(triggerId);
            const activationContext = _activeListeners.get(triggerId);

            if (!triggerDef || !_activeListeners.has(triggerId)) {
                console.warn(`[TriggerManager] Trigger '${triggerId}' not found or not active for deactivation.`);
                return false;
            }
            const handler = _triggerTypeHandlers.get(triggerDef.type);
            if (!handler) {
                console.error(`[TriggerManager] No handler for trigger type '${triggerDef.type}' (triggerId '${triggerId}') during deactivation.`);
                return false;
            }

            try {
                console.log(`[TriggerManager] Deactivating trigger: ${triggerId}`);
                await handler.deactivate(activationContext, triggerDef.config, triggerId, FlowHub);
                _activeListeners.delete(triggerId);
                FlowHub._emitEvent('trigger:deactivated', { triggerId, timestamp: Date.now() });
                console.log(`[TriggerManager] Deactivated trigger: ${triggerId}`);
                return true;
            } catch (error) {
                console.error(`[TriggerManager] Error deactivating trigger '${triggerId}':`, error);
                FlowHub._emitEvent('trigger:error', { triggerId, error: error.message, type: 'deactivation', timestamp: Date.now() });
                return false;
            }
        },

        /**
         * Gets a list of all registered trigger definitions.
         * @returns {TriggerDefinition[]}
         */
        getAllTriggers() {
            return Array.from(_triggers.values());
        },

        /**
         * Gets a list of IDs of all active triggers.
         * @returns {string[]}
         */
        getActiveTriggerIds() {
            return Array.from(_activeListeners.keys());
        }
    };
}
```

File: /Users/narcisbrindusescu/cod/Narcissus/agent/flow-engine/nodes/text/analyze-sentiment.node.js
```js
/** @type {import('../../types/flow-types.jsdoc.js').NodeDefinition} */
export default {
    id: "text.analysis.sentiment",
    version: "1.0.0",
    name: "Sentiment Analyzer",
    description: "Analyzes the sentiment of a given text string and determines if it's positive, negative, or neutral. Useful for understanding user feedback or social media comments.",
    categories: ["Text Processing", "AI", "NLP"],
    tags: ["sentiment", "text analysis", "nlp"],
    inputs: [
        {
            name: "text",
            type: "string",
            description: "The text content to analyze for sentiment.",
            required: true,
            example: "I love this product, it's amazing!"
        },
        {
            name: "language",
            type: "string",
            description: "The language of the text (e.g., 'en', 'es'). Default is 'en'.",
            required: false,
            defaultValue: "en",
            example: "en"
        }
    ],
    outputs: [
        { name: "analyzedSentiment", type: "string", description: "The detected sentiment: 'positive', 'negative', or 'neutral'."},
        { name: "sentimentConfidence", type: "number", description: "A confidence score (0-1) for the detected sentiment, if available from the underlying engine."}
    ],
    edges: [
        { name: "positive", description: "The text has a positive sentiment." },
        { name: "negative", description: "The text has a negative sentiment." },
        { name: "neutral", description: "The text has a neutral sentiment." },
        { name: "error", description: "An error occurred during sentiment analysis." }
    ],
    implementation: async function(params) {
        // 'this' provides: this.state, this.humanInput, this.emit, this.on
        // In a real scenario, this would call an NLP library or API
        console.log("Analyzing sentiment for text:", params.text,this.self,this.input);
        const text = String(params.text || "").toLowerCase();
        if (text.includes("error")) return { error: () => "Simulated analysis error." };

        let sentiment = "neutral";
        if (text.includes("love") || text.includes("amazing") || text.includes("great")) sentiment = "positive";
        else if (text.includes("hate") || text.includes("terrible") || text.includes("bad")) sentiment = "negative";

        this.state.set('lastSentimentAnalysis', { text: params.text, sentiment: sentiment, confidence: 0.9 });
        return { [sentiment]: () => sentiment }; // Dynamically use edge name
    },
    aiPromptHints: {
        toolName: "sentiment_analyzer",
        summary: "Detects if text is positive, negative, or neutral.",
        useCase: "Use this tool when you need to understand the emotional tone of a piece of text. For example, to analyze customer reviews or social media posts.",
        expectedInputFormat: "Provide the 'text' input as the string to analyze. 'language' is optional, defaults to 'en'.",
        outputDescription: "Returns an edge named 'positive', 'negative', or 'neutral' indicating the sentiment. Sets 'lastSentimentAnalysis' in state."
    }
};
```

File: /Users/narcisbrindusescu/cod/Narcissus/agent/flow-engine/nodes/text/string-uppercase.node.js
```js
/** @type {import('../../types/flow-types.jsdoc.js').NodeDefinition} */
export default {
    id: "text.transform.toUpperCase",
    version: "1.0.0",
    name: "Convert to Uppercase",
    description: "Converts a given string to all uppercase letters.",
    categories: ["Text Processing", "Utilities"],
    tags: ["string", "transform", "case"],
    inputs: [
        { name: "inputValue", type: "string", description: "The string to convert.", required: true, example: "hello world" }
    ],
    outputs: [
        { name: "uppercasedValue", type: "string", description: "The input string converted to uppercase." }
    ],
    edges: [
        { name: "success", description: "String successfully converted to uppercase.", outputType: "string" }
    ],
    implementation: async function(params) {
        const result = String(params.inputValue || "").toUpperCase();
        this.state.set('lastUppercasedString', result);
        return { success: () => result };
    },
    aiPromptHints: {
        toolName: "string_to_uppercase",
        summary: "Changes text to all capital letters.",
        useCase: "Use this when you need to standardize text to uppercase, for example, before a comparison or for display purposes.",
        expectedInputFormat: "Provide 'inputValue' as the string.",
        outputDescription: "Returns 'success' edge with the uppercased string. Sets 'lastUppercasedString' in state."
    }
};
```

File: /Users/narcisbrindusescu/cod/Narcissus/agent/flow-engine/nodes/utils/log-message.node.js
```js
/** @type {import('../../types/flow-types.jsdoc.js').NodeDefinition} */
export default {
    id: "utils.debug.logMessage",
    version: "1.0.0",
    name: "Log Message",
    description: "Logs a message to the console. Useful for debugging workflows.",
    categories: ["Utilities", "Debugging"],
    tags: ["log", "print", "debug"],
    inputs: [
        { name: "message", type: "any", description: "The message or data to log.", required: true, example: "Current step completed." },
        { name: "level", type: "string", description: "Log level (e.g., 'info', 'warn', 'error', 'debug').", defaultValue: "info", enum: ["info", "warn", "error", "debug"], example: "info" }
    ],
    edges: [
        { name: "pass", description: "Message logged successfully." }
    ],
    implementation: async function(params) {
        const level = params.level || "info";
        const message = params.message;
        const flowInstanceId = this.flowInstanceId || 'N/A'; // Assuming flowInstanceId is added to 'this' context

        switch(level) {
            case "warn": console.warn(`[FlowLog FW:${flowInstanceId}]:`, message); break;
            case "error": console.error(`[FlowLog FW:${flowInstanceId}]:`, message); break;
            case "debug": console.debug(`[FlowLog FW:${flowInstanceId}]:`, message); break;
            default: console.log(`[FlowLog FW:${flowInstanceId}]:`, message);
        }
        return "pass"; // Simple string return implies { edges: ["pass"] }
    },
    aiPromptHints: {
        toolName: "log_message_to_console",
        summary: "Prints a message to the system console.",
        useCase: "Use this for debugging or to output informational messages during flow execution. It does not affect the flow's state or primary output.",
        expectedInputFormat: "Provide 'message' with the content to log. 'level' is optional (info, warn, error, debug).",
        outputDescription: "Returns a 'pass' edge. The message is printed to the console."
    }
};
```

File: /Users/narcisbrindusescu/cod/Narcissus/agent/flow-engine/triggers/types/emailTriggerHandler.js
```js
/**
 * @typedef {import('../../types/flow-types.jsdoc.js').TriggerHandlerCallback} TriggerHandlerCallback
 * @typedef {typeof import('../../core/FlowHub.js').default} FlowHubType
 */

/**
 * Mock Email Trigger Handler.
 * In a real scenario, this would connect to an email service.
 * @type {import('../../types/flow-types.jsdoc.js').TriggerTypeHandler}
 */
const emailTriggerHandler = {
    /**
     * @param {object} triggerConfig - Config for this email trigger (e.g., { account, folder, checkIntervalSeconds }).
     * @param {TriggerHandlerCallback} callback - Function to call when a "new email" is detected.
     * @param {string} triggerId - The ID of the trigger being activated.
     * @param {FlowHubType} flowHub - Instance of FlowHub for emitting events.
     * @returns {Promise<{intervalId: number}>} Returns context for deactivation.
     */
    async activate(triggerConfig, callback, triggerId, flowHub) {
        const { account, folder, checkIntervalSeconds = 20 } = triggerConfig;
        console.log(`[EmailTriggerHandler:${triggerId}] Activating for account '${account}', folder '${folder}'. Checking every ${checkIntervalSeconds}s.`);

        // Mock: Simulate checking for emails periodically
        const intervalId = setInterval(() => {
            // Simulate finding a new email
            const shouldSimulateNewEmail = Math.random() < 0.6; // 10% chance per interval
            if (shouldSimulateNewEmail) {
                const mockEmail = {
                    id: `email-${Date.now()}`,
                    from: "sender@example.com",
                    to: account,
                    subject: `Mock Email Subject ${Math.floor(Math.random() * 100)}`,
                    body: "This is the body of a new mock email.",
                    receivedAt: new Date().toISOString(),
                    folder: folder
                };
                console.log(`[EmailTriggerHandler:${triggerId}] Simulated new email:`, mockEmail.subject);
                flowHub._emitEvent('trigger:handler:event', {
                    triggerId,
                    handlerType: 'email',
                    message: 'Simulated new email detected',
                    emailId: mockEmail.id,
                    timestamp: Date.now()
                });
                callback(mockEmail); // Pass the mock email data to the TriggerManager
            } else {
                // console.debug(`[EmailTriggerHandler:${triggerId}] No new emails (simulated).`);
            }
        }, checkIntervalSeconds * 1000);

        return { intervalId }; // Return intervalId so it can be cleared in deactivate
    },

    /**
     * @param {{intervalId: number}} activationContext - The context returned by activate.
     * @param {object} triggerConfig - The trigger's configuration.
     * @param {string} triggerId - The ID of the trigger being deactivated.
     * @param {FlowHubType} flowHub - Instance of FlowHub.
     * @returns {Promise<void>}
     */
    async deactivate(activationContext, triggerConfig, triggerId, flowHub) {
        if (activationContext && activationContext.intervalId) {
            clearInterval(activationContext.intervalId);
            console.log(`[EmailTriggerHandler:${triggerId}] Deactivated polling for account '${triggerConfig.account}'.`);
            flowHub._emitEvent('trigger:handler:event', {
                triggerId,
                handlerType: 'email',
                message: 'Polling deactivated',
                timestamp: Date.now()
            });
        }
    }
};

export default emailTriggerHandler;
```

File: /Users/narcisbrindusescu/cod/Narcissus/agent/flow-engine/triggers/types/eventTriggerHandler.js
```js

const eventTriggerHandler = {

    async activate(triggerConfig, callback, triggerId, flowHub) {
    
        console.log(`[EVENT TriggerHandler:${triggerId}] Event data ${triggerConfig}`);
               
               flowHub.addEventListener('start_the_flow', (event) => {
                callback(event); // Pass the event data to the TriggerManager
               })


                flowHub._emitEvent('trigger:handler:event', {
                    triggerId,
                    handlerType: 'event',
                    message: 'UI event detected',
                    timestamp: Date.now()
                });
            //    callback(); // Pass the mock email data to the TriggerManager
       return true;
    },


    async deactivate(activationContext, triggerConfig, triggerId, flowHub) {
        if (activationContext ) {

        }
    }
};

export default eventTriggerHandler;
```
</file_contents>