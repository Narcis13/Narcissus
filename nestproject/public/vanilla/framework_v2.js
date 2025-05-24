//i have this framework for orchestrating complex agentic workflows suitable for AI workflows and automations: 
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
         * @param {string} eventName - Event to listen for ('flowPaused', 'flowResumed', 'resumeFailed', 'flowManagerStep').
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
                console.log(`[FlowHub] Flow ${flowInstanceId} paused. ID: ${pauseId}. Details: ${JSON.stringify(details)}. Waiting for resume...`);
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
                console.log(`[FlowHub] Flow ${flowInstanceId} resumed. ID: ${pauseId} with data:`, resumeData);
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


/**
 * FlowManager: A powerful and flexible engine for orchestrating complex workflows,
 * particularly well-suited for AI agentic systems. It allows workflows to be defined
 * as serializable JSON-like structures, enabling dynamic generation, persistence,
 * and execution of directed graphs of tasks and decisions.
 *
 * Emits a 'flowManagerStep' event via FlowHub after each step is executed.
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

  // No instance-specific event listeners here anymore. All events go through FlowHub.

  function StateManager(_initialState = {}) {
    const _currentState = JSON.parse(JSON.stringify(_initialState));
    const _history = [JSON.parse(JSON.stringify(_initialState))];
    let _historyCurrentIndex = 0;

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
      // 'flowManagerStep' events from this sub-FM will be emitted to FlowHub
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
            const resumeData = await FlowHub.requestPause({
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

    // Emit 'flowManagerStep' event via FlowHub
    FlowHub._emitEvent('flowManagerStep', {
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

// --- Example Scope & Usage ---
const scope = { // Global scope for function nodes
  pi(params){
    console.log('[Scope:pi] PARAMS:', params, 'STATE (loopCounter):', this.state.get('loopCounter'));
    return {
      pass: () => 3.14 * (params.x || 1) * (params.y || 1)
    };
  }
};

scope['Rezultat aleator'] = function() {
  const randomValue = Math.random();
  let edge = randomValue > 0.5 ? 'big' : 'small';
  console.log(`[Scope:Rezultat aleator] Value: ${randomValue}, Edge: ${edge}`);
  return {
    [edge]: () => {
      this.state.set('rezultatAleator', randomValue);
      return randomValue;
    }
  };
};

scope['Afiseaza rezultat mare'] = function() {
  console.log('[Scope:Afiseaza rezultat mare] Valoare:', this.state.get('rezultatAleator'));
  return { pass: () => "Mare afisat" };
};

scope['Afiseaza rezultat mic'] = function() {
  console.log('[Scope:Afiseaza rezultat mic] Valoare:', this.state.get('rezultatAleator'));
  return { pass: () => "Mic afisat" };
};

scope['Mesaj Intimpinare'] = function greet({mesaj, postfix}){
  console.log(`[Scope:Mesaj Intimpinare] ${this.state.get('name')}::${mesaj} ${postfix}`);
  return { stop: () => "Salutari!" }; // 'stop' is an example edge
};

scope['print'] = function(){
  const stateSnapshot = {
      name: this.state.get('name'),
      loopCounter: this.state.get('loopCounter'),
      lastUserInput: this.state.get('lastUserInput'),
      rezultatAleator: this.state.get('rezultatAleator')
  };
  console.log('[Scope:print] Random number:', Math.ceil(Math.random()*100), 'Partial State:', stateSnapshot);
  return { pass: () => true };
};

scope['With elements'] = function({of}){
  this.state.set('elements', of);
  console.log('[Scope:With elements] Set elements in state:', of);
  return { do: () => true }; // 'do' is an example edge
};

scope['Print elements'] = function(){
  const elements = this.state.get('elements');
  if (elements && elements.length > 0) {
    elements.forEach((element, index) => {
      console.log(`[Scope:Print elements] Element ${index}:`, element);
    });
  } else {
    console.log('[Scope:Print elements] No elements found.');
  }
  return { pass: () => "Elements printed" };
};

scope['Loop Controller'] = function() {
  let count = this.state.get('loopCounter') || 0;
 count++;
  this.state.set('loopCounter', count);
   
  console.log(`[Scope:Loop Controller] Iteration: ${count}`);
  if (count > 3) { // Loop 3 times (1, 2, 3)
    this.state.set('loopMessage', 'Loop finished by controller after 3 iterations');
    return {
      exit: () => `Exited at iteration ${count}`
    };
  } else {
    return {
      continue: () => `Continuing at iteration ${count}`
    };
  }
};

scope['Loop Action'] = function() {
  console.log('[Scope:Loop Action] Executing. Loop counter from state:', this.state.get('loopCounter'));
  this.state.set('actionDoneInLoop', `Iteration ${this.state.get('loopCounter')}`);
  return { pass: () => 'Action completed for iteration' };
};

scope['Reset Counter'] = function() {
  this.state.set('loopCounter', 0);
  this.state.set('loopMessage', null); // Clear previous loop messages
  this.state.set('actionDoneInLoop', null);
  console.log('[Scope:Reset Counter] Counter reset to 0.');
  return "pass"; // Simple string return means { edges: ['pass'] }
}

scope['Async Task'] = async function() {
  console.log('[Scope:Async Task] Starting (simulating 1s delay)...');
  await new Promise(resolve => setTimeout(resolve, 1000));
  this.state.set('asyncResult', 'Async task successfully completed at ' + new Date().toLocaleTimeString());
  console.log('[Scope:Async Task] Finished.');
  return { pass: () => 'Async Done' };
};

scope['Check Async Result'] = function() {
    console.log('[Scope:Check Async Result] From state:', this.state.get('asyncResult'));
    return 'pass';
};

scope['Request User Input'] = async function(params) {
  const question = params.question || "Please provide your input:";
  console.log(`[Scope:Request User Input] Asking: "${question}"`);
  const userInput = await this.humanInput(
    { type: 'text_input', prompt: question, defaultValue: params.default || "" },
    params.pauseId || `user-input-${this.state.get('name') || 'generic'}-${Date.now()%10000}` // More unique pauseId
  );
  console.log(`[Scope:Request User Input] Received:`, userInput);
  this.state.set('lastUserInput', userInput);
  return {
    received: () => `Input: ${userInput.text ? userInput.text.substring(0,50) : JSON.stringify(userInput)}`
  };
};

scope['Confirm Action'] = async function(params) {
    const confirmationDetails = {
        type: 'confirmation',
        message: params.message || "Are you sure you want to proceed?",
        options: params.options || ["Yes, Proceed", "No, Cancel"],
        payload: params.payload
    };
    const pauseIdSuffix = params.actionId || 'action';
    console.log(`[Scope:Confirm Action] Requesting confirmation: "${confirmationDetails.message}" for ${pauseIdSuffix}`);
    const decision = await this.humanInput(confirmationDetails, `confirm-${pauseIdSuffix}-${Date.now()%10000}`);

    if (decision && decision.choice === (confirmationDetails.options[0] || "Yes, Proceed")) {
        this.state.set(`confirmation.${pauseIdSuffix}`, 'confirmed');
        console.log(`[Scope:Confirm Action] Action '${pauseIdSuffix}' Confirmed by user.`);
        return { confirmed: () => "Action confirmed" };
    } else {
        this.state.set(`confirmation.${pauseIdSuffix}`, 'cancelled');
        console.log(`[Scope:Confirm Action] Action '${pauseIdSuffix}' Cancelled by user.`);
        return { cancelled: () => "Action cancelled" };
    }
};
scope['insideLoopPauseBrowser'] = async function() {
  const loopCount = this.state.get('loopCounter');
            console.log(`[Node:InsideLoopPause] Iteration ${loopCount}, asking for HITL (browser).`);
            const approval = await this.humanInput(
                { type: 'confirmation', prompt: `Loop ${loopCount}: Approve browser iteration?`, options: ['Approve Iteration', 'Skip Iteration'] },
                `loop-iter-approval-browser-${loopCount}`
            );
            if (approval && approval.choice === 'Approve Iteration') {
                this.state.set(`loopIter${loopCount}Approval`, 'Approved');
                return "approved_iteration_browser"; // Edge for next step in *this loop iteration* if any, or influences loop's overall output if it's the last action.
            }
            this.state.set(`loopIter${loopCount}Approval`, 'Skipped');
            return "skipped_iteration_browser";
}
// --- Test Flow Execution (Browser Focused) ---
async function runTestFlowBrowser() {
  const flowManager = FlowManager({
    initialState:{
      name: 'TestFlow_Browser',
      a: 8, b: 5, d: { x: 111, y: 200 }, loopCounter: 0
    },
    nodes:[
      'Reset Counter',
      { 'Request User Input': { question: "Favorite color for browser test?", pauseId: "fav-color-query" } },
      { 'received': 'print' }, // Branch based on 'received' edge from previous step
      [['Loop Controller', // This is a loop node: [[controller, action1, action2, ...]]
        'insideLoopPauseBrowser', // Action in the loop
       'Loop Action', // Another action in the loop
     // 'print'        // Yet another action in the loop
      ]], // End of loop node definition
      { // This is a branch node, reacting to the *final output* of the loop node above
        'exit': {'Mesaj Intimpinare': {mesaj: 'Exit from loop', postfix:'!!'}}, // 'exit' edge from Loop Controller
        'exit_forced': {'Mesaj Intimpinare': {mesaj: 'Forced Exit from loop', postfix:'!!'}}, // 'exit_forced' edge from Loop Manager
        // If the loop's last action emits 'approved_iteration_browser' or 'skipped_iteration_browser' and the loop *also* exits
        // (e.g., controller says 'exit' after the last action), then 'exit' takes precedence for branching *after* the loop.
        // If the loop *continues* after such an edge, that edge is internal to the loop's iteration.
        // For simplicity, we assume 'exit' or 'exit_forced' are the primary edges from the loop for post-loop branching.
        // A 'pass' edge can be a fallback if the loop structure is more complex.
        'pass': {'Mesaj Intimpinare': {mesaj: 'Pass Exit from loop', postfix:'!!'}}
      },
      'Async Task',
      'Check Async Result',
      { 'Confirm Action': { message: "Finalize this browser flow example?", actionId: "browser-flow-end" } },
      { // This is a branch node
        'confirmed': [ 'print', {'Mesaj Intimpinare': {mesaj: 'Browser Flow Confirmed & Finalized', postfix:'!!'}} ], // Subflow
        'cancelled': [ 'print', {'Mesaj Intimpinare': {mesaj: 'Browser Flow Cancelled by User', postfix:'...'}} ]  // Subflow
      },
    ]
  });

  // Add listener for 'flowManagerStep' event to FlowHub
  FlowHub.addEventListener('flowManagerStep', (eventData) => {
    const nodeRepresentation = typeof eventData.stepData.node === 'string' ?
        eventData.stepData.node :
        (typeof eventData.stepData.node === 'function' ? eventData.stepData.node.name || 'anonymous function' : JSON.stringify(eventData.stepData.node));

    console.groupCollapsed(
        `%c[FlowTracer - ${eventData.flowInstanceId}] Step ${eventData.stepIndex}: ${nodeRepresentation.substring(0,70)}${nodeRepresentation.length > 70 ? '...' : ''}`,
        'color: purple; font-weight: normal;'
    );
    console.log(`  Flow Instance ID: ${eventData.flowInstanceId}`);
    console.log(`  Step Index: ${eventData.stepIndex}`);
    console.log(`  Node Definition:`, eventData.stepData.node);
    console.log(`  Output Edges:`, eventData.stepData.output.edges);
    if (eventData.stepData.output.results && eventData.stepData.output.results.length > 0) {
      console.log(`  Output Results:`, eventData.stepData.output.results);
    }
    if (eventData.stepData.subSteps && eventData.stepData.subSteps.length > 0) {
        console.log(`  Sub-steps count: ${eventData.stepData.subSteps.length}`);
        // console.log(`  Sub-steps details:`, eventData.stepData.subSteps); // Can be very verbose
    }
    // console.log(`  Current State (after step):`, eventData.currentState); // Can be very verbose
    console.groupEnd();
  });


  console.log(`--- STARTING BROWSER FLOW EXECUTION (Instance ID: ${flowManager.getInstanceId()}) ---`);
  try {
    const executedSteps = await flowManager.run();
    console.log("--- FINAL EXECUTED STEPS (Browser Workflow Audit Trail from flowManager.getSteps()) ---");
    // This loop now provides a summary; detailed step-by-step is logged by the 'flowManagerStep' event.
    executedSteps.forEach((step, i) => {
        const nodeString = typeof step.node === 'string' ? step.node :
                           (typeof step.node === 'function' ? step.node.name || 'anonymous fn' : JSON.stringify(step.node));
        let logMsg = `Step ${i} (Instance: ${flowManager.getInstanceId()}): Node: ${nodeString.substring(0,70)}${nodeString.length > 70 ? '...' : ''} -> Output Edges: ${step.output.edges}`;
        if(step.subSteps && step.subSteps.length > 0) {
            logMsg += ` (Contains ${step.subSteps.length} sub-steps)`;
        }
        console.log(logMsg);
    });
    console.log("--- FINAL STATE (Browser Agent's Memory After Execution) ---");
    console.log(JSON.stringify(flowManager.getStateManager().getState(), null, 2));
  } catch (error) {
    console.error("--- BROWSER FLOW EXECUTION FAILED ---");
    console.error(error);
  }
}

// --- Browser UI Mock Interaction (using prompt/confirm) ---
function initializeBrowserMockResponder() {
    FlowHub.addEventListener('flowPaused', (eventData) => {
        const { pauseId, details, flowInstanceId } = eventData;
        console.log(`%c[Browser Mock] Event: flowPaused`, 'color: blue; font-weight: bold;',
                    `Instance: ${flowInstanceId}, Pause ID: ${pauseId}, Details:`, details);

        setTimeout(() => { // Simulate user taking some time to respond
            if (details.type === 'text_input') {
                const response = prompt(`[Browser Mock for ${flowInstanceId} | ${pauseId}]\n${details.prompt}`, details.defaultValue || "");
                FlowHub.resume(pauseId, { text: response, respondedAt: new Date() });
            } else if (details.type === 'confirmation' && details.options && details.options.length >= 1) {
                const okOption = details.options[0];
                const cancelOption = details.options.length > 1 ? details.options[1] : details.options[0];

                const userChoseOk = confirm(`[Browser Mock for ${flowInstanceId} | ${pauseId}]\n${details.message || details.prompt}\n\nOK = ${okOption}\nCancel = ${cancelOption}`);
                const choice = userChoseOk ? okOption : cancelOption;
                FlowHub.resume(pauseId, { choice: choice, confirmationTime: new Date(), payload: details.payload });
            } else { // Generic pause
                if (confirm(`[Browser Mock for ${flowInstanceId} | ${pauseId}]\nFlow paused with details: ${JSON.stringify(details)}\nClick OK to provide generic resume, Cancel to leave paused.`)) {
                    FlowHub.resume(pauseId, { acknowledged: true, resumeTime: new Date() });
                } else {
                    console.log(`[Browser Mock] User chose not to resume pauseId ${pauseId} immediately. Manually resume via console: FlowHub.resume('${pauseId}', { someData: 'your_data' })`);
                }
            }
        }, 500);
    });

    FlowHub.addEventListener('flowResumed', (eventData) => {
        const { pauseId, resumeData, flowInstanceId } = eventData;
        console.log(`%c[Browser Mock] Event: flowResumed`, 'color: green; font-weight: bold;',
                    `Instance: ${flowInstanceId}, Pause ID: ${pauseId}, Resumed with:`, resumeData);
    });

    FlowHub.addEventListener('resumeFailed', (eventData) => {
        const { pauseId, reason } = eventData;
        console.error(`%c[Browser Mock] Event: resumeFailed`, 'color: red; font-weight: bold;',
                    `Pause ID: ${pauseId}, Reason: ${reason}`);
    });
    console.log('[Browser Mock Responder] Initialized. Waiting for flow pause events...');
}


    initializeBrowserMockResponder();
    runTestFlowBrowser();
