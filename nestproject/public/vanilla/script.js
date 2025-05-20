/**
 * GlobalPauseResumeManager: A singleton manager for handling pause and resume operations
 * across all FlowManager instances. It allows workflows to request human intervention
 * and for an external UI layer (or any service) to respond and resume the flow.
 * This version uses a custom, environment-agnostic event bus.
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
         * @param {string} eventName - The name of the event (e.g., 'flowPaused').
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
         * Adds an event listener for pause/resume events.
         * @param {string} eventName - Event to listen for ('flowPaused', 'flowResumed', 'resumeFailed').
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
                // Emit event with relevant data
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
                // Emit event with relevant data
                this._emitEvent('flowResumed', { pauseId, resumeData, details, flowInstanceId });
                console.log(`[GlobalPauseResumeManager] Flow ${flowInstanceId} resumed. ID: ${pauseId} with data:`, resumeData);
                return true;
            } else {
                console.warn(`[GlobalPauseResumeManager] No active pause found for ID: ${pauseId}. Cannot resume.`);
                // Emit event with relevant data
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
    let maxIterations = 100;
    let iterationCount = 0;
    let lastLoopIterationOutput = { edges: ['pass'] };

    while (iterationCount < maxIterations) {
      iterationCount++;
      const loopIterationInstanceId = `${flowInstanceId}-loop${iterationCount}`;
      const controllerFM = FlowManager({
        initialState: fmState.getState(),
        nodes: [controllerNode],
        instanceId: `${loopIterationInstanceId}-ctrl`
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
      if (controllerOutput.edges.includes('exit')) break;

      if (actionNodes.length > 0) {
        const actionsFM = FlowManager({
          initialState: fmState.getState(),
          nodes: actionNodes,
          instanceId: `${loopIterationInstanceId}-actions`
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

  async function evaluateNode(node) {
    let output = null;
    let returnedValue;
    const nodeToRecord = node;
    let subStepsToRecord = null;

    const baseExecutionContext = {
        state: fmState,
        steps, nodes, currentIndex,
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
        return await Promise.resolve(fn.apply(context, args)); // Await as fn might call humanInput
    }

    if (typeof node === 'function') {
      returnedValue = await executeFunc(node, baseExecutionContext);
    } else if (typeof node === 'string') {
      if (scope && scope[node]) {
        returnedValue = await executeFunc(scope[node], baseExecutionContext);
      } else {
        console.error(`[FlowManager:${flowInstanceId}] Function ${node} not found in scope.`);
        output = { edges: ['error'], errorDetails: `Function ${node} not found` };
      }
    } else if (Array.isArray(node)) {
      if (node.length === 1 && Array.isArray(node[0]) && node[0].length > 0) {
        const loopRun = await loopManager(node[0]);
        output = loopRun.finalOutput;
        subStepsToRecord = loopRun.internalSteps;
      } else if (node.length > 0) {
        const subflowFM = FlowManager({
          initialState: fmState.getState(),
          nodes: node,
          instanceId: `${flowInstanceId}-subflow${currentIndex}`
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
          returnedValue = await executeFunc(scope[nodeKey], baseExecutionContext, nodeValue);
        } else {
          const prevStepOutput = steps.at(-1)?.output;
          const prevEdges = (prevStepOutput && prevStepOutput.edges) ? prevStepOutput.edges : [];
          let branchTaken = false;
          for (const edgeKey of Object.keys(node)) {
            if (prevEdges.includes(edgeKey)) {
              const branchNode = node[edgeKey];
              const branchFM = FlowManager({
                initialState: fmState.getState(),
                nodes: Array.isArray(branchNode) ? branchNode : [branchNode],
                instanceId: `${flowInstanceId}-branch-${edgeKey}-${currentIndex}`
              });
              const branchResultSteps = await branchFM.run();
              fmState.set(null, branchFM.getStateManager().getState());
              output = branchResultSteps?.at(-1)?.output || { edges: ['pass'] };
              subStepsToRecord = branchResultSteps;
              branchTaken = true;
              break;
            }
          }
          if (!branchTaken) output = { edges: ['pass'] };
        }
      }
    } else {
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
  }

  async function _nextStepInternal() {
    if (currentIndex < nodes.length) {
      currentNode = nodes[currentIndex];
      currentIndex++;
      await evaluateNode(currentNode);
      await _nextStepInternal();
    } else {
      if (_resolveRunPromise) {
        _resolveRunPromise(JSON.parse(JSON.stringify(steps)));
        _resolveRunPromise = null; _rejectRunPromise = null;
      }
    }
  }

  return {
    async run() {
      currentIndex = 0;
      steps.length = 0;
      return new Promise(async (resolve, reject) => {
        _resolveRunPromise = resolve; _rejectRunPromise = reject;
        if (!nodes || nodes.length === 0) {
          resolve([]); _resolveRunPromise = null; _rejectRunPromise = null; return;
        }
        try {
          console.log(`[FlowManager:${flowInstanceId}] Starting execution.`);
          await _nextStepInternal();
          console.log(`[FlowManager:${flowInstanceId}] Execution finished.`);
        } catch (error) {
          console.error(`[FlowManager:${flowInstanceId}] Error during flow execution:`, error);
          if(_rejectRunPromise) _rejectRunPromise(error);
          _resolveRunPromise = null; _rejectRunPromise = null;
        }
      });
    },
    getSteps: () => JSON.parse(JSON.stringify(steps)),
    getStateManager: () => fmState,
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
  console.log( 'PRINT FN::' + Math.ceil(Math.random()*100), 'State (partial):', {name: this.state.get('name'), loopCounter: this.state.get('loopCounter'), lastUserInput: this.state.get('lastUserInput') });
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

scope['Request User Input'] = async function(params) {
  const question = params.question || "Please provide your input:";
  console.log(`[Request User Input] Node is asking: "${question}"`);
  const userInput = await this.humanInput(
    { type: 'text_input', prompt: question, defaultValue: params.default || "" },
    params.pauseId || `user-input-${this.state.get('name') || 'generic'}`
  );
  console.log(`[Request User Input] Received input from human:`, userInput);
  this.state.set('lastUserInput', userInput);
  return {
    received: () => `Input received: ${userInput.text ? userInput.text.substring(0,50) : JSON.stringify(userInput)}`
  };
};

scope['Confirm Action'] = async function(params) {
    const confirmationDetails = {
        type: 'confirmation',
        message: params.message || "Are you sure you want to proceed?",
        options: ["Yes, Proceed", "No, Cancel"], // For browser `confirm`, these map to OK/Cancel
        payload: params.payload
    };
    console.log(`[Confirm Action] Requesting confirmation: "${confirmationDetails.message}"`);
    const decision = await this.humanInput(confirmationDetails, `confirm-${params.actionId || 'action'}`);
    // Browser mock's confirm() will return true for "Yes, Proceed" (OK) and false for "No, Cancel" (Cancel)
    // and we map this to a choice object.
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

// --- Test Flow Execution (Browser Focused) ---
async function runTestFlowBrowser() {
  const flowManager = FlowManager({
    initialState:{
      name: 'TestFlow_Browser',
      a: 8, b: 5, d: { x: 111, y: 200 }, loopCounter: 0
    },
    nodes:[
      'Reset Counter',
      { 'Request User Input': { question: "What is your favorite color for this browser test?", pauseId: "fav-color-query" } },
      { 'received': 'print'},
      [['Loop Controller',
        async function insideLoopPauseBrowser() {
            const loopCount = this.state.get('loopCounter');
            console.log(`Inside loop (iteration ${loopCount}), about to ask for HITL (browser).`);
            const approval = await this.humanInput(
                { type: 'confirmation', prompt: `Loop ${loopCount}: Approve this browser iteration?`, options: ['Approve Iteration', 'Skip Iteration'] },
                `loop-iter-approval-browser-${loopCount}`
            );
            // Browser mock will send { choice: 'Approve Iteration' } or { choice: 'Skip Iteration' }
            if (approval && approval.choice === 'Approve Iteration') {
                this.state.set(`loopIter${loopCount}Approval`, 'Approved');
                return "approved_iteration_browser";
            }
            this.state.set(`loopIter${loopCount}Approval`, 'Skipped');
            return "skipped_iteration_browser";
        },
       'Loop Action', 'print'
      ]],
      {
        'approved_iteration_browser': () => console.log("Browser loop iteration was approved."),
        'skipped_iteration_browser': () => console.log("Browser loop iteration was skipped.")
      },
      'Async Task',
      'Check Async Result',
      { 'Confirm Action': { message: "Finalize this browser flow example?", actionId: "browser-flow-end" } },
      {
        'confirmed': [ 'print', {'Mesaj Intimpinare': {mesaj: 'Browser Flow Confirmed & Finalized', postfix:'!!'}} ],
        'cancelled': [ 'print', {'Mesaj Intimpinare': {mesaj: 'Browser Flow Cancelled by User', postfix:'...'}} ]
      },
    ]
  });
  console.log(`--- STARTING BROWSER FLOW EXECUTION (Instance ID: ${flowManager.getInstanceId()}) ---`);
  try {
    const executedSteps = await flowManager.run();
    console.log("--- FINAL EXECUTED STEPS (Browser Workflow Audit Trail) ---");
    executedSteps.forEach((step, i) => {
        const nodeString = typeof step.node === 'string' ? step.node : JSON.stringify(step.node);
        console.log(`Step ${i}: Node: ${nodeString.substring(0,70)}${nodeString.length > 70 ? '...' : ''} -> Output Edges: ${step.output.edges}`);
        if(step.subSteps) {
            console.log(`    Contains ${step.subSteps.length} sub-steps.`);
        }
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
    GlobalPauseResumeManager.addEventListener('flowPaused', (eventData) => {
        const { pauseId, details, flowInstanceId } = eventData;
        console.log(`%c[Browser Mock] Event: flowPaused`, 'color: blue; font-weight: bold;',
                    `Instance: ${flowInstanceId}, Pause ID: ${pauseId}, Details:`, details);

        // Simulate UI interaction based on details.type using browser's prompt/confirm
        setTimeout(() => { // Simulate user taking some time to respond
            if (details.type === 'text_input') {
                const response = prompt(`[Browser Mock for ${flowInstanceId} | ${pauseId}]\n${details.prompt}`, details.defaultValue || "");
                GlobalPauseResumeManager.resume(pauseId, { text: response, respondedAt: new Date() });
            } else if (details.type === 'confirmation' && details.options && details.options.length >= 1) {
                // Browser's confirm is binary (OK/Cancel).
                // We use the first option for OK, second for Cancel if available, otherwise first for Cancel too.
                const okOption = details.options[0];
                const cancelOption = details.options.length > 1 ? details.options[1] : details.options[0];

                const userChoseOk = confirm(`[Browser Mock for ${flowInstanceId} | ${pauseId}]\n${details.message || details.prompt}\n\nOK = ${okOption}\nCancel = ${cancelOption}`);
                const choice = userChoseOk ? okOption : cancelOption;
                GlobalPauseResumeManager.resume(pauseId, { choice: choice, confirmationTime: new Date(), payload: details.payload });
            } else { // Generic pause
                if (confirm(`[Browser Mock for ${flowInstanceId} | ${pauseId}]\nFlow paused with details: ${JSON.stringify(details)}\nClick OK to provide generic resume, Cancel to leave paused.`)) {
                    GlobalPauseResumeManager.resume(pauseId, { acknowledged: true, resumeTime: new Date() });
                } else {
                    console.log(`[Browser Mock] User chose not to resume pauseId ${pauseId} immediately. Manually resume via console: GlobalPauseResumeManager.resume('${pauseId}', { someData: 'your_data' })`);
                }
            }
        }, 500); // Simulate 0.5 second delay for user response
    });

    GlobalPauseResumeManager.addEventListener('flowResumed', (eventData) => {
        const { pauseId, resumeData, flowInstanceId } = eventData;
        console.log(`%c[Browser Mock] Event: flowResumed`, 'color: green; font-weight: bold;',
                    `Instance: ${flowInstanceId}, Pause ID: ${pauseId}, Resumed with:`, resumeData);
    });

    GlobalPauseResumeManager.addEventListener('resumeFailed', (eventData) => {
        const { pauseId, reason } = eventData;
        console.error(`%c[Browser Mock] Event: resumeFailed`, 'color: red; font-weight: bold;',
                    `Pause ID: ${pauseId}, Reason: ${reason}`);
    });
    console.log('[Browser Mock Responder] Initialized. Waiting for flow pause events...');
}


// --- COMMENTED OUT: Node.js Specific CLI Responder Mock ---
/*
const readline = require('readline'); // Only if actually running in Node and want interactive prompts

function createMockCliResponder() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    function askQuestion(query, defaultValue) {
        return new Promise(resolve => rl.question(`${query} ${defaultValue ? `(${defaultValue})` : ''}: `, answer => {
            resolve(answer || defaultValue || '');
        }));
    }

    async function handleFlowPaused(eventData) { // eventData is the { pauseId, details, flowInstanceId }
        const { pauseId, details, flowInstanceId } = eventData;
        console.log(`\n%c[CLI Responder] Event: flowPaused`, 'color: blue; font-weight: bold;',
                    `Instance: ${flowInstanceId}, Pause ID: ${pauseId}`);
        console.log(`%c[CLI Responder] Details:`, 'color: blue;', details);

        if (details.type === 'text_input') {
            const response = await askQuestion(`[CLI for ${flowInstanceId} | ${pauseId}] ${details.prompt}`, details.defaultValue);
            GlobalPauseResumeManager.resume(pauseId, { text: response, respondedAt: new Date() });
        } else if (details.type === 'confirmation' || (details.options && details.options.length > 0)) {
            console.log(`[CLI for ${flowInstanceId} | ${pauseId}] ${details.message || details.prompt}`);
            details.options.forEach((opt, i) => console.log(`  ${i + 1}. ${opt}`));
            const choiceIndexStr = await askQuestion(`Enter your choice (number)`, '1');
            const choiceIndex = parseInt(choiceIndexStr, 10) - 1;
            let choice = details.options[0];
            if (choiceIndex >= 0 && choiceIndex < details.options.length) {
                choice = details.options[choiceIndex];
            } else {
                console.log(`[CLI Responder] Invalid choice, defaulting to '${choice}'.`);
            }
            GlobalPauseResumeManager.resume(pauseId, { choice: choice, decision: choice, confirmationTime: new Date(), payload: details.payload });
        } else {
            const genericResponse = await askQuestion(`[CLI for ${flowInstanceId} | ${pauseId}] Flow paused. Enter data to resume (JSON string or simple text)`, '{"acknowledged": true}');
            let resumePayload;
            try {
                resumePayload = JSON.parse(genericResponse);
            } catch (e) {
                resumePayload = { text: genericResponse };
            }
            GlobalPauseResumeManager.resume(pauseId, { ...resumePayload, resumeTime: new Date() });
        }
    }
    GlobalPauseResumeManager.addEventListener('flowPaused', handleFlowPaused);


    GlobalPauseResumeManager.addEventListener('flowResumed', (eventData) => {
        const { pauseId, resumeData, flowInstanceId } = eventData;
        console.log(`\n%c[CLI Responder] Event: flowResumed`, 'color: green; font-weight: bold;',
                    `Instance: ${flowInstanceId}, Pause ID: ${pauseId}, Resumed with:`, resumeData);
    });

    GlobalPauseResumeManager.addEventListener('resumeFailed', (eventData) => {
        const { pauseId, reason } = eventData;
        console.error(`\n%c[CLI Responder] Event: resumeFailed`, 'color: red; font-weight: bold;',
                    `Pause ID: ${pauseId}, Reason: ${reason}`);
    });

    console.log('[CLI Responder] Initialized. Waiting for flow pause events...');
}
*/

// --- Run the Test (Browser Focus) ---

// Check if we are in a browser environment.
// `window` is a common check for browser.
if (typeof window !== 'undefined' && typeof window.document !== 'undefined') {
    console.log("Running in Browser environment. Initializing Browser mock responder.");
    initializeBrowserMockResponder();
    runTestFlowBrowser();
} else if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    console.log("Running in Node.js environment. The Node.js CLI responder is currently commented out.");
    console.log("To test Node.js HITL, uncomment the 'createMockCliResponder' section and its call.");
    // To run the flow in Node.js without HITL, or if HITL is handled by another service:
    // runTestFlowBrowser(); // This will run, HITL steps will pause indefinitely unless resumed programmatically.
    console.log("Node.js flow execution without interactive HITL mock (unless resumed programmatically):");
    // If you want to run the flow and have it pause, waiting for programmatic resume:
    GlobalPauseResumeManager.addEventListener('flowPaused', (eventData) => {
         console.log(`NODE_SILENT_PAUSE: Flow ${eventData.flowInstanceId} paused. ID: ${eventData.pauseId}. Details: ${JSON.stringify(eventData.details)}`);
         console.log(`To resume, call: GlobalPauseResumeManager.resume('${eventData.pauseId}', { your_data: 'value' })`);
    });
    runTestFlowBrowser(); // The flow itself is environment agnostic.
} else {
    console.log("Running in an unrecognized JavaScript environment.");
    // Fallback or specific handling for other environments can be added here.
    runTestFlowBrowser(); // Attempt to run the flow.
}

// The `runTestFlowBrowser().finally(...)` block for Node.js readline management is removed
// as the focus is now on browser testing, and readline management is commented out.s