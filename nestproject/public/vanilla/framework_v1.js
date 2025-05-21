/**
 * GlobalPauseResumeManager: A singleton manager for handling pause and resume operations
 * across all FlowManager instances. It allows workflows to request human intervention
 * and for an external UI layer (or any service) to respond and resume the flow.
 * This version uses a custom, environment-agnostic event bus and also handles
 * step events from FlowManager instances.
 */
const GlobalPauseResumeManager = (function() {
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
            // console.debug(`[GlobalPauseResumeManager] Emitting event: ${eventName}`, eventData);
            if (_listeners[eventName]) {
                _listeners[eventName].forEach(callback => {
                    try {
                        // Pass the eventData object directly to the callback
                        callback(eventData);
                    } catch (e) {
                        console.error(`[GlobalPauseResumeManager] Error in listener for ${eventName}:`, e);
                    }
                });
            }
        },

        /**
         * Adds an event listener for events.
         * @param {string} eventName - Event to listen for ('flowPaused', 'flowResumed', 'resumeFailed', 'flowManagerStep').
         * @param {Function} callback - The function to call when the event occurs. The callback will receive the eventData object.
         */
        addEventListener(eventName, callback) {
            if (typeof callback !== 'function') {
                console.error('[GlobalPauseResumeManager] addEventListener: callback must be a function.');
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
                    console.warn(`[GlobalPauseResumeManager] Pause ID ${pauseId} is already active. Overwriting the resolver for ${pauseId}.`);
                }
                _pausedFlows.set(pauseId, { resolve, details, flowInstanceId });
                this._emitEvent('flowPaused', { pauseId, details, flowInstanceId });
                console.log(`[GlobalPauseResumeManager] Flow ${flowInstanceId} paused. ID: ${pauseId}. Details: ${JSON.stringify(details)}. Waiting for resume...`);
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


/**
 * FlowManager: A powerful and flexible engine for orchestrating complex workflows,
 * particularly well-suited for AI agentic systems. It allows workflows to be defined
 * as serializable JSON-like structures, enabling dynamic generation, persistence,
 * and execution of directed graphs of tasks and decisions.
 *
 * Emits a 'flowManagerStep' event via GlobalPauseResumeManager after each step is executed.
 *
 * @param {object} config - Configuration for the FlowManager.
 * @param {object} [config.initialState={}] - The initial state for the workflow.
 * @param {Array} [config.nodes=[]] - An array defining the workflow's structure.
 * @param {string} [config.instanceId] - An optional ID for this FlowManager instance.
 * @returns {object} An API to run and interact with the flow.
 */
function FlowManager({initialState, nodes, instanceId}={initialState:{}, nodes:[], instanceId: undefined}) {
  const steps = [];
  let currentNode = null;
  let currentIndex = 0;
  const flowInstanceId = instanceId || `fm-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const fmState = StateManager(initialState);
  let _resolveRunPromise = null;
  let _rejectRunPromise = null;

  // No instance-specific event listeners here anymore. All events go through GlobalPauseResumeManager.

  function isAsyncFunction(fn) {
    if (!fn) return false;
    return fn.constructor && fn.constructor.name === 'AsyncFunction';
  }

  function StateManager(_initialState = {}) {
    const _currentState = JSON.parse(JSON.stringify(_initialState));
    const _history = [JSON.parse(JSON.stringify(_initialState))];
    let _historyCurrentIndex = 0;

    return {
      withState(fn, paramNames) {
        const smInstance = this;
        if (isAsyncFunction(fn)) {
          return async function(...args) {
            const params = (paramNames || []).reduce((acc, name) => {
              if (Object.prototype.hasOwnProperty.call(smInstance.getState(), name)) {
                acc[name] = smInstance.get(name);
              }
              return acc;
            }, {});
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
        let targetStateObject = _currentState;
        if (path === null || path === '') {
          const newStateParsed = JSON.parse(JSON.stringify(value));
          for (const key in _currentState) {
            if (Object.prototype.hasOwnProperty.call(_currentState, key)) {
              delete _currentState[key];
            }
          }
          for (const key in newStateParsed) {
            if (Object.prototype.hasOwnProperty.call(newStateParsed, key)) {
              _currentState[key] = newStateParsed[key];
            }
          }
        } else {
          const newStateCopy = JSON.parse(JSON.stringify(_currentState));
          let current = newStateCopy;
          const keys = path.split('.');
          for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!current[key] || typeof current[key] !== 'object') {
              current[key] = {};
            }
            current = current[key];
          }
          const lastKey = keys[keys.length - 1];
          current[lastKey] = value;
          Object.assign(_currentState, newStateCopy);
          targetStateObject = current[lastKey];
        }
        _history.splice(_historyCurrentIndex + 1);
        _history.push(JSON.parse(JSON.stringify(_currentState)));
        _historyCurrentIndex = _history.length - 1;
        return targetStateObject;
      },
      getState() { return JSON.parse(JSON.stringify(_currentState)); },
      canUndo() { return _historyCurrentIndex > 0; },
      canRedo() { return _historyCurrentIndex < _history.length - 1; },
      undo() {
        if (this.canUndo()) {
          _historyCurrentIndex--;
          Object.assign(_currentState, JSON.parse(JSON.stringify(_history[_historyCurrentIndex])));
        }
        return this.getState();
      },
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

  async function processReturnedValue(returnedValue, context) {
    let output = null;
    if (Array.isArray(returnedValue)) {
      if (returnedValue.every(item => typeof item === 'string') && returnedValue.length > 0) {
        output = { edges: returnedValue };
      } else {
        output = { edges: ['pass'] };
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
      const results = [];
      for (const k of edgeNames) {
        try {
          const edgeFn = edgeFunctions[k];
          let result = await Promise.resolve(edgeFn.apply(context, [])); // Await as it might call humanInput
          results.push(result);
        } catch (e) {
          console.error(`[FlowManager:${flowInstanceId}] Error executing edge function for '${k}':`, e);
          results.push({ error: e.message });
        }
      }
      output = {
        edges: edgeNames.length > 0 ? edgeNames : ['pass'],
        results: results
      };
    } else if (typeof returnedValue === 'string') {
      output = { edges: [returnedValue] };
    } else {
      output = { edges: ['pass'], results: [returnedValue] };
    }
    if (!output.edges || output.edges.length === 0) {
        output.edges = ['pass'];
    }
    return output;
  }

  async function loopManager(loopNodesConfig) {
    const loopInternalSteps = [];
    if (!loopNodesConfig || loopNodesConfig.length === 0) {
      const passOutput = { edges: ['pass'] };
      return { internalSteps: [{ nodeDetail: "Empty Loop Body", output: passOutput }], finalOutput: passOutput };
    }
    const controllerNode = loopNodesConfig[0];
    const actionNodes = loopNodesConfig.slice(1);
    let maxIterations = 100; // Default max iterations
    let iterationCount = 0;
    let lastLoopIterationOutput = { edges: ['pass'] };

    // Check if controllerNode has maxIterations specified (e.g. { 'Loop Controller': { maxIterations: 5 }})
    // This is an example of how one might pass configurations to loop controllers.
    // For simplicity, this specific example doesn't implement reading maxIterations from node config yet.

    while (iterationCount < maxIterations) {
      iterationCount++;
      const loopIterationInstanceId = `${flowInstanceId}-loop${iterationCount}`;
      const controllerFM = FlowManager({
        initialState: fmState.getState(),
        nodes: [controllerNode],
        instanceId: `${loopIterationInstanceId}-ctrl`
      });
      // 'flowManagerStep' events from this sub-FM will be emitted to GlobalPauseResumeManager
      const controllerRunResult = await controllerFM.run();
      let controllerOutput;
      if (controllerRunResult && controllerRunResult.length > 0) {
        controllerOutput = controllerRunResult.at(-1).output;
        fmState.set(null, controllerFM.getStateManager().getState()); // Update parent state
        loopInternalSteps.push({
          nodeDetail: `Loop Iter ${iterationCount}: Controller ${typeof controllerNode === 'string' ? controllerNode : 'Complex Controller'}`,
          outputFromController: controllerOutput,
          controllerSubSteps: controllerRunResult
        });
      } else {
        console.warn(`[FlowManager:${flowInstanceId}] Loop controller did not produce output. Exiting loop.`);
        controllerOutput = { edges: ['exit'] }; // Default to exit if no output
        loopInternalSteps.push({
          nodeDetail: `Loop Iter ${iterationCount}: Controller Error`, outputFromController: controllerOutput,
        });
      }
      lastLoopIterationOutput = controllerOutput; // Track the latest output from this iteration
      if (controllerOutput.edges.includes('exit')) break; // Controller signals loop termination

      if (actionNodes.length > 0 && controllerOutput.edges.some(edge => edge !== 'exit' && edge !== 'exit_forced')) { // Only run actions if not exiting
        const actionsFM = FlowManager({
          initialState: fmState.getState(),
          nodes: actionNodes,
          instanceId: `${loopIterationInstanceId}-actions`
        });
        const actionsRunResult = await actionsFM.run();
        fmState.set(null, actionsFM.getStateManager().getState()); // Update parent state
        if (actionsRunResult && actionsRunResult.length > 0) {
          lastLoopIterationOutput = actionsRunResult.at(-1).output; // Update last output with action's output
          loopInternalSteps.push({
            nodeDetail: `Loop Iter ${iterationCount}: Actions`, outputFromActions: lastLoopIterationOutput, actionSubSteps: actionsRunResult
          });
        } else {
           loopInternalSteps.push({ nodeDetail: `Loop Iter ${iterationCount}: Actions (no output/steps)`, actionSubSteps: actionsRunResult || [] });
        }
      } // else: skip actions if controller said 'exit' or if no actionNodes

      if (iterationCount >= maxIterations) {
        console.warn(`[FlowManager:${flowInstanceId}] Loop reached max iterations (${maxIterations}). Forcing exit.`);
        lastLoopIterationOutput = { edges: ['exit_forced'] }; // Special edge for max iterations
        loopInternalSteps.push({ nodeDetail: "Loop Max Iterations Reached", output: lastLoopIterationOutput });
        break;
      }
    }
    return { internalSteps: loopInternalSteps, finalOutput: lastLoopIterationOutput };
  }

  async function evaluateNode(node) {
    let output = null;
    let returnedValue;
    const nodeToRecord = node; // The original node definition
    let subStepsToRecord = null; // For sub-flows, loops, branches

    const baseExecutionContext = {
        state: fmState,
        // currentStep: steps.length, // steps array might not be fully updated for current node yet
        steps, // Provides access to *previous* steps' history
        nodes, // The full list of nodes for this FlowManager instance
        currentIndex, // The index of the *current* node being processed (1-based for user, 0-based internally)
        humanInput: async (details, customPauseId) => {
            console.log(`[FlowManager:${flowInstanceId}] Node (or edge function) requests human input. Details:`, details, "Pause ID hint:", customPauseId);
            const resumeData = await GlobalPauseResumeManager.requestPause({
                pauseId: customPauseId,
                details,
                flowInstanceId
            });
            console.log(`[FlowManager:${flowInstanceId}] Human input received:`, resumeData);
            return resumeData;
        }
    };

    async function executeFunc(fn, context, ...args) {
        return await Promise.resolve(fn.apply(context, args));
    }

    if (typeof node === 'function') {
      returnedValue = await executeFunc(node, baseExecutionContext);
    } else if (typeof node === 'string') {
      if (scope && scope[node]) { // Relies on global 'scope'
        returnedValue = await executeFunc(scope[node], baseExecutionContext);
      } else {
        console.error(`[FlowManager:${flowInstanceId}] Function ${node} not found in scope.`);
        output = { edges: ['error'], errorDetails: `Function ${node} not found` };
      }
    } else if (Array.isArray(node)) {
      if (node.length === 1 && Array.isArray(node[0]) && node[0].length > 0) { // Loop construct: [[controller, ...actions]]
        const loopRun = await loopManager(node[0]);
        output = loopRun.finalOutput;
        subStepsToRecord = loopRun.internalSteps;
      } else if (node.length > 0) { // Subflow construct: [node1, node2, ...]
        const subflowFM = FlowManager({
          initialState: fmState.getState(),
          nodes: node,
          instanceId: `${flowInstanceId}-subflow-idx${currentIndex-1}` // Subflow ID includes parent's current node index
        });
        const subflowResultSteps = await subflowFM.run();
        fmState.set(null, subflowFM.getStateManager().getState()); // Update parent state with subflow's final state
        output = subflowResultSteps?.at(-1)?.output || { edges: ['pass'] };
        subStepsToRecord = subflowResultSteps;
      } else { // Empty array
        output = {edges: ['pass']};
      }
    } else if (typeof node === 'object' && node !== null) { // Object node: branch or function call with params
      if (Object.keys(node).length === 0) { // Empty object
        output = { edges: ['pass'] };
      } else {
        const nodeKey = Object.keys(node)[0];
        const nodeValue = node[nodeKey];
        // Check if it's a function call with parameters: { 'funcName': {param1: value1} }
        if (typeof nodeValue === 'object' && !Array.isArray(nodeValue) && scope && scope[nodeKey]) {
          returnedValue = await executeFunc(scope[nodeKey], baseExecutionContext, nodeValue);
        } else { // Branching construct: { 'edgeName1': nodeA, 'edgeName2': nodeB }
          const prevStepOutput = steps.at(-1)?.output; // Output from the immediately preceding step
          const prevEdges = (prevStepOutput && prevStepOutput.edges) ? prevStepOutput.edges : [];
          let branchTaken = false;
          for (const edgeKey of Object.keys(node)) {
            if (prevEdges.includes(edgeKey)) {
              const branchNode = node[edgeKey];
              const branchFM = FlowManager({
                initialState: fmState.getState(),
                nodes: Array.isArray(branchNode) ? branchNode : [branchNode],
                instanceId: `${flowInstanceId}-branch-${edgeKey}-idx${currentIndex-1}` // Branch ID includes edge and parent's index
              });
              const branchResultSteps = await branchFM.run();
              fmState.set(null, branchFM.getStateManager().getState()); // Update parent state
              output = branchResultSteps?.at(-1)?.output || { edges: ['pass'] };
              subStepsToRecord = branchResultSteps;
              branchTaken = true;
              break; // Take the first matching branch
            }
          }
          if (!branchTaken) output = { edges: ['pass'] }; // No matching edge from previous step, default to 'pass' for the branch node itself
        }
      }
    } else { // Unknown node type
      console.warn(`[FlowManager:${flowInstanceId}] Unknown node type or unhandled case:`, node);
      output = { edges: ['error', 'pass'] };
    }

    if (returnedValue !== undefined && output === null) {
      output = await processReturnedValue(returnedValue, baseExecutionContext);
    }

    if (!output || typeof output.edges === 'undefined' || !Array.isArray(output.edges) || output.edges.length === 0) {
      output = { ...output, edges: ['pass'] };
    }
    steps.push({ node: nodeToRecord, output, ...(subStepsToRecord && { subSteps: subStepsToRecord }) });

    // Emit 'flowManagerStep' event via GlobalPauseResumeManager
    GlobalPauseResumeManager._emitEvent('flowManagerStep', {
      flowInstanceId: flowInstanceId,
      stepIndex: currentIndex - 1, // 0-based index of the node just processed
      stepData: JSON.parse(JSON.stringify(steps.at(-1))), // Deep copy of the last recorded step
      currentState: fmState.getState() // State *after* this step
    });
  }

  async function _nextStepInternal() {
    if (currentIndex < nodes.length) {
      currentNode = nodes[currentIndex];
      currentIndex++; // Increment current index *before* processing the node at this index
      await evaluateNode(currentNode);
      await _nextStepInternal(); // Recurse for the next step
    } else {
      // All nodes processed
      if (_resolveRunPromise) {
        _resolveRunPromise(JSON.parse(JSON.stringify(steps)));
        _resolveRunPromise = null; _rejectRunPromise = null;
      }
    }
  }

  return {
    async run() {
      currentIndex = 0;
      steps.length = 0; // Clear steps for a fresh run
      return new Promise(async (resolve, reject) => {
        _resolveRunPromise = resolve; _rejectRunPromise = reject;
        if (!nodes || nodes.length === 0) {
          resolve([]); _resolveRunPromise = null; _rejectRunPromise = null; return;
        }
        try {
          console.log(`[FlowManager:${flowInstanceId}] Starting execution. Total nodes: ${nodes.length}`);
          await _nextStepInternal();
          console.log(`[FlowManager:${flowInstanceId}] Execution finished.`);
        } catch (error) {
          console.error(`[FlowManager:${flowInstanceId}] Error during flow execution:`, error);
          // Emit an error event or log centrally if needed
          if(_rejectRunPromise) _rejectRunPromise(error);
          _resolveRunPromise = null; _rejectRunPromise = null;
        }
      });
    },
    getSteps: () => JSON.parse(JSON.stringify(steps)),
    getStateManager: () => fmState,
    getInstanceId: () => flowInstanceId
    // No addEventListener/removeEventListener on the instance directly
  };
}