import FlowHub from './FlowHub.js';

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
export function FlowManager({initialState, nodes, instanceId}={initialState:{}, nodes:[], instanceId: undefined}) {
  const steps = [];
  let currentNode = null;
  let currentIndex = 0;
  const flowInstanceId = instanceId || `fm-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const fmState = StateManager(initialState);
  let _resolveRunPromise = null;
  let _rejectRunPromise = null;

  // No instance-specific event listeners here anymore. All events go through FlowHub.

  // Stores listeners registered by nodes OF THIS INSTANCE on FlowHub, for cleanup.
  // Each item: { hubEventName: string, effectiveHubCallback: Function }
  const _registeredHubListeners = [];

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

  const baseExecutionContext = {
      state: fmState,
      // currentStep: steps.length, // steps array might not be fully updated for current node yet
      steps, // Provides access to *previous* steps' history
      nodes, // The full list of nodes for this FlowManager instance
      // currentIndex, // The index of the *current* node being processed (1-based for user, 0-based internally)
      // currentIndex and currentNode are accessed from FlowManager's lexical scope by emit/on
      humanInput: async function(details, customPauseId) { // Added 'function' for explicit 'this' if it were ever unbound, though arrow function was fine here.
          console.log(`[FlowManager:${flowInstanceId}] Node (idx: ${currentIndex-1}, in FM: ${flowInstanceId}) requests human input. Details:`, details, "Pause ID hint:", customPauseId);
          const resumeData = await FlowHub.requestPause({
              pauseId: customPauseId,
              details,
              flowInstanceId // This flowInstanceId is of the FM instance calling humanInput
          });
          console.log(`[FlowManager:${flowInstanceId}] Human input received:`, resumeData);
          return resumeData;
      },
      /**
       * Emits an event globally via FlowHub.
       * @param {string} customEventName - The custom name of the event.
       * @param {any} data - The payload for the event.
       */
      emit: async function(customEventName, data) { // 'this' is baseExecutionContext. Async for consistency.
          const emittingNodeMeta = {
              index: currentIndex - 1, // 0-based index of the emitting node within its FlowManager
              definition: currentNode // Raw definition of the emitting node
          };
          // console.debug(`[FlowManager:${flowInstanceId}] Node (idx: ${emittingNodeMeta.index}) emitting event '${customEventName}' via FlowHub`, data);

          FlowHub._emitEvent('flowManagerNodeEvent', {
              flowInstanceId: flowInstanceId, // The FM instance ID of the EMITTER
              emittingNode: {
                  index: emittingNodeMeta.index,
                  definition: JSON.parse(JSON.stringify(emittingNodeMeta.definition)) // Serializable definition
              },
              customEventName: customEventName,
              eventData: data,
              timestamp: Date.now()
          });
      },
      /**
       * Registers a listener on FlowHub for a custom node event.
       * The listener will be automatically cleaned up when this FlowManager instance is re-run or disposed of (if such a method existed).
       * @param {string} customEventName - The custom name of the event to listen for.
       * @param {Function} nodeCallback - The function to call when the event occurs.
       *                              It receives (data, meta) arguments.
       *                              'this' inside the callback is the context of the listening node.
       */
      on: function(customEventName, nodeCallback) { // 'this' is baseExecutionContext of the node calling 'on'
          if (typeof nodeCallback !== 'function') {
              console.error(`[FlowManager:${flowInstanceId}] Node 'on' listener: callback must be a function for event '${customEventName}'.`);
              return;
          }
          const listeningNodeContext = this; // 'this' is the baseExecutionContext of the FM instance where .on is called.
          const listeningNodeMeta = {
              index: currentIndex - 1, // Index of the listening node within its FlowManager
              definition: currentNode, // Definition of the listening node
              flowInstanceId: flowInstanceId // The FM instance ID where this listener is defined
          };

          const effectiveHubCallback = (flowHubEventData) => {
              // flowHubEventData is what FlowHub broadcasts for 'flowManagerNodeEvent'
              // It includes { flowInstanceId (emitter's FM), emittingNode, customEventName, eventData, timestamp }

              if (flowHubEventData.customEventName === customEventName) {
                  // Event name matches. Now invoke the node's original callback.
                  const meta = {
                      eventName: flowHubEventData.customEventName,
                      emittingNodeMeta: { // Details of the node that EMITTED the event
                          index: flowHubEventData.emittingNode.index,
                          definition: flowHubEventData.emittingNode.definition, // This is already a copy from emit
                          flowInstanceId: flowHubEventData.flowInstanceId // FM instance of the emitter
                      },
                      listeningNodeMeta: listeningNodeMeta // Details of THIS node that is LISTENING
                  };
                  try {
                      // Call the original node's callback with its correct 'this' context (listeningNodeContext)
                      nodeCallback.call(listeningNodeContext, flowHubEventData.eventData, meta);
                  } catch (e) {
                      console.error(`[FlowManager:${flowInstanceId}] Error in node event listener callback for '${customEventName}' (listener idx: ${listeningNodeMeta.index} in FM: ${listeningNodeMeta.flowInstanceId}):`, e);
                  }
              }
          };

          FlowHub.addEventListener('flowManagerNodeEvent', effectiveHubCallback);
          _registeredHubListeners.push({
              hubEventName: 'flowManagerNodeEvent', // The FlowHub event type we attached to
              // originalCustomEventName: customEventName, // For debugging, if needed
              // originalNodeCallback: nodeCallback, // For debugging, if needed
              effectiveHubCallback: effectiveHubCallback // The actual function to remove
          });
          // console.debug(`[FlowManager:${flowInstanceId}] Node (idx: ${listeningNodeMeta.index}) registered FlowHub listener for custom event '${customEventName}'`);
      }
  };


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
      const controllerFM = FlowManager({ // This creates a new FlowManager instance for the controller
        initialState: fmState.getState(),
        nodes: [controllerNode],
        instanceId: `${loopIterationInstanceId}-ctrl`
      });
      // 'flowManagerStep' events from this sub-FM will be emitted to FlowHub
      // Custom node events emitted from within controllerFM will also go through FlowHub
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
        const actionsFM = FlowManager({ // This creates a new FlowManager instance for actions
          initialState: fmState.getState(),
          nodes: actionNodes,
          instanceId: `${loopIterationInstanceId}-actions`
        });
        // Custom node events emitted from within actionsFM will also go through FlowHub
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

    // baseExecutionContext is now defined in the FlowManager scope and passed as 'this'

    async function executeFunc(fn, context, ...args) {
        // The 'context' here is baseExecutionContext
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
        const loopRun = await loopManager(node[0]); // loopManager creates sub-FlowManager instances
        output = loopRun.finalOutput;
        subStepsToRecord = loopRun.internalSteps;
      } else if (node.length > 0) { // Subflow construct: [node1, node2, ...]
        const subflowFM = FlowManager({ // Creates a sub-FlowManager instance
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
              const branchFM = FlowManager({ // Creates a sub-FlowManager instance for the branch
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

      // Clean up listeners registered by THIS FlowManager instance on FlowHub from previous runs
      _registeredHubListeners.forEach(listenerRegistration => {
          FlowHub.removeEventListener(listenerRegistration.hubEventName, listenerRegistration.effectiveHubCallback);
      });
      _registeredHubListeners.length = 0; // Clear the array for this run

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