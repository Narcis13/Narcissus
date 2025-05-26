// File: /Users/narcisbrindusescu/cod/Narcissus/agent/flow-engine/core/FlowManager.js

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
 * @param {object} [config.scope={}] - The scope object containing node implementations (functions or NodeDefinition objects).
 * @returns {object} An API to run and interact with the flow.
 */
export function FlowManager({initialState, nodes, instanceId, scope: providedScope}={initialState:{}, nodes:[], instanceId: undefined, scope: {}}) {
  const steps = [];
  let currentNode = null;
  let currentIndex = 0;
  const flowInstanceId = instanceId || `fm-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const fmState = StateManager(initialState);
  let _resolveRunPromise = null;
  let _rejectRunPromise = null;
  
  // Use the scope passed in during instantiation.
  // This scope contains node implementations and can be augmented externally.
  const scope = providedScope; 

  // Stores listeners registered by nodes OF THIS INSTANCE on FlowHub, for cleanup.
  // Each item: { hubEventName: string, effectiveHubCallback: Function }
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
        if (!path) return ''; // Return empty string for empty path, consistent with original behavior
        const keys = path.split('.');
        let result = _currentState;
        for (const key of keys) {
          if (result === undefined || result === null || !Object.prototype.hasOwnProperty.call(result, key)) {
            return ''; // Return empty string if path is not found or leads to undefined/null
          }
          result = result[key];
        }
        // Return empty string if the final result is undefined or null, otherwise the value
        return result !== undefined && result !== null ? result : '';
      },
      set(path, value) {
        let targetStateObject = _currentState;
        if (path === null || path === '') { // Setting the entire state
          const newStateParsed = JSON.parse(JSON.stringify(value)); // Deep copy the new value
          // Clear existing state properties
          for (const key in _currentState) {
            if (Object.prototype.hasOwnProperty.call(_currentState, key)) {
              delete _currentState[key];
            }
          }
          // Assign new state properties
          for (const key in newStateParsed) {
            if (Object.prototype.hasOwnProperty.call(newStateParsed, key)) {
              _currentState[key] = newStateParsed[key];
            }
          }
        } else { // Setting a specific path
          const newStateCopy = JSON.parse(JSON.stringify(_currentState)); // Deep copy for modification
          let current = newStateCopy;
          const keys = path.split('.');
          for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!current[key] || typeof current[key] !== 'object') {
              current[key] = {}; // Create nested objects if they don't exist
            }
            current = current[key];
          }
          const lastKey = keys[keys.length - 1];
          current[lastKey] = value; // Set the value at the target path
          Object.assign(_currentState, newStateCopy); // Merge the changes back into the actual current state
          targetStateObject = current[lastKey]; // Reference to the actual object set (or its parent if primitive)
        }
        // Manage history
        _history.splice(_historyCurrentIndex + 1); // Clear redo history
        _history.push(JSON.parse(JSON.stringify(_currentState))); // Add new state to history
        _historyCurrentIndex = _history.length - 1;
        return targetStateObject; // May not be the value itself if primitive, but the object it was set on.
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

  /**
   * The execution context provided to each node's implementation function (`this` context).
   */
  const baseExecutionContext = {
      state: fmState,
      steps, // Provides access to *previous* steps' history (array of {node, output, subSteps?})
      nodes, // The full list of node definitions for this FlowManager instance
      // currentIndex and currentNode are accessed from FlowManager's lexical scope by emit/on for convenience
      /**
       * Requests human input, pausing the flow execution until input is provided via FlowHub.
       * @param {object} details - Details about the required input (passed to UI/responder).
       * @param {string} [customPauseId] - A custom ID for this pause request.
       * @returns {Promise<any>} A promise that resolves with the human-provided data.
       */
      humanInput: async function(details, customPauseId) {
          console.log(`[FlowManager:${flowInstanceId}] Node (idx: ${currentIndex-1}, def: ${JSON.stringify(currentNode).substring(0,50)}...) requests human input. Details:`, details, "Pause ID hint:", customPauseId);
          const resumeData = await FlowHub.requestPause({
              pauseId: customPauseId,
              details,
              flowInstanceId // This flowInstanceId is of the FM instance calling humanInput
          });
          console.log(`[FlowManager:${flowInstanceId}] Human input received for node (idx: ${currentIndex-1}):`, resumeData);
          return resumeData;
      },
      /**
       * Emits a custom event globally via FlowHub.
       * @param {string} customEventName - The custom name of the event.
       * @param {any} data - The payload for the event.
       */
      emit: async function(customEventName, data) {
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
       * The listener will be automatically cleaned up when this FlowManager instance is re-run or disposed.
       * @param {string} customEventName - The custom name of the event to listen for.
       * @param {Function} nodeCallback - The function to call when the event occurs.
       *                              It receives (data, meta) arguments.
       *                              'this' inside the callback is the `baseExecutionContext` of the listening node.
       */
      on: function(customEventName, nodeCallback) {
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
                  const meta = {
                      eventName: flowHubEventData.customEventName,
                      emittingNodeMeta: {
                          index: flowHubEventData.emittingNode.index,
                          definition: flowHubEventData.emittingNode.definition,
                          flowInstanceId: flowHubEventData.flowInstanceId
                      },
                      listeningNodeMeta: listeningNodeMeta
                  };
                  try {
                      nodeCallback.call(listeningNodeContext, flowHubEventData.eventData, meta);
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
          // console.debug(`[FlowManager:${flowInstanceId}] Node (idx: ${listeningNodeMeta.index}) registered FlowHub listener for custom event '${customEventName}'`);
      }
  };

  /**
   * Resolves a node identifier string to its executable implementation function
   * using the FlowManager's 'scope' object.
   * The nodeIdentifier can be:
   * 1. A direct key in 'scope' (e.g., "My Custom Function"). Value is the function.
   * 2. A fully qualified "id:name" string (e.g., "text.analysis.sentiment:Sentiment Analyzer"). Value in scope is NodeDefinition.
   * 3. A node ID string (e.g., "text.analysis.sentiment").
   * 4. A node Name string (e.g., "Sentiment Analyzer").
   * @param {string} nodeIdentifier - The string identifier for the node.
   * @returns {Function | null} The executable function or null if not found.
   */
  function resolveNodeFromScope(nodeIdentifier) {
    if (!scope || typeof nodeIdentifier !== 'string') {
      // console.warn(`[FlowManager:${flowInstanceId}] resolveNodeFromScope: Scope not available or invalid identifier:`, nodeIdentifier);
      return null;
    }

    const directMatch = scope[nodeIdentifier];

    // Case 1: Direct match in scope (could be a custom function or an "id:name" key from NodeRegistry.getScope())
    if (directMatch) {
      if (typeof directMatch === 'function') {
        // This is for user-added simple functions directly into the scope object.
        // e.g., scope["MyFunc"] = function() {...}
        return directMatch;
      }
      if (typeof directMatch.implementation === 'function') {
        // This is for nodes registered via NodeRegistry, where getScope() populates
        // scope with keys like "node.id:Node Name" and values as the full NodeDefinition.
        return directMatch.implementation;
      }
    }

    // Case 2: Resolve by ID (e.g., "text.analysis.sentiment")
    // It will look for keys in `scope` like "text.analysis.sentiment:Some Name"
    for (const key in scope) {
      if (Object.prototype.hasOwnProperty.call(scope, key) && key.startsWith(nodeIdentifier + ":")) {
        const entry = scope[key];
        if (entry && typeof entry.implementation === 'function') {
          return entry.implementation;
        }
      }
    }

    // Case 3: Resolve by Name (e.g., "Sentiment Analyzer")
    // It will look for keys in `scope` like "some.id:Sentiment Analyzer"
    // This is less specific and potentially ambiguous if names are not unique across IDs,
    // so it's checked after direct match and ID match.
    for (const key in scope) {
      if (Object.prototype.hasOwnProperty.call(scope, key) && key.endsWith(":" + nodeIdentifier)) {
        const entry = scope[key];
        if (entry && typeof entry.implementation === 'function') {
          return entry.implementation;
        }
      }
    }
    
    // console.warn(`[FlowManager:${flowInstanceId}] resolveNodeFromScope: Node identifier '${nodeIdentifier}' not resolved.`);
    return null; // Not found
  }

  /**
   * Processes the value returned by a node's implementation into a standard output format.
   * @param {any} returnedValue - The value returned by the node's implementation.
   * @param {object} context - The execution context (baseExecutionContext).
   * @returns {Promise<object>} A promise that resolves to the standard output object {edges: string[], results?: any[]}.
   */
  async function processReturnedValue(returnedValue, context) {
    let output = null;
    if (Array.isArray(returnedValue)) {
      // If an array of strings is returned, assume they are edge names.
      if (returnedValue.every(item => typeof item === 'string') && returnedValue.length > 0) {
        output = { edges: returnedValue };
      } else {
        // If not all strings or empty, default to 'pass' edge. The array itself could be a result.
        output = { edges: ['pass'], results: [returnedValue] };
      }
    } else if (typeof returnedValue === 'object' && returnedValue !== null) {
      // If an object is returned, check for edge functions.
      const edgeFunctions = {};
      const edgeNames = [];
      Object.keys(returnedValue).forEach(key => {
        if (typeof returnedValue[key] === 'function') {
          edgeNames.push(key);
          edgeFunctions[key] = returnedValue[key];
        }
      });

      if (edgeNames.length > 0) { // Node returned an object of edge_name: () => result_for_edge
        const results = [];
        for (const k of edgeNames) {
          try {
            const edgeFn = edgeFunctions[k];
            // Await as edge function might call humanInput or other async operations.
            let result = await Promise.resolve(edgeFn.apply(context, [])); 
            results.push(result);
          } catch (e) {
            console.error(`[FlowManager:${flowInstanceId}] Error executing edge function for '${k}':`, e);
            results.push({ error: e.message }); // Store error as part of results for this edge
          }
        }
        output = {
          edges: edgeNames,
          results: results
        };
      } else {
        // If no functions, the object itself is considered a result on the 'pass' edge.
        output = { edges: ['pass'], results: [returnedValue] };
      }
    } else if (typeof returnedValue === 'string') {
      // A single string returned is treated as an edge name.
      output = { edges: [returnedValue] };
    } else {
      // Any other type of returned value (number, boolean, undefined, null) goes to 'pass' edge with the value as a result.
      output = { edges: ['pass'], results: [returnedValue] };
    }

    // Ensure there's always at least a 'pass' edge if no other edges were determined.
    if (!output.edges || output.edges.length === 0) {
        output.edges = ['pass'];
    }
    return output;
  }

  /**
   * Manages the execution of a loop construct within the flow.
   * A loop construct is defined as an array: `[[controllerNode, actionNode1, actionNode2, ...]]`.
   * @param {Array} loopNodesConfig - The array defining the loop's controller and actions.
   * @returns {Promise<object>} A promise resolving to { internalSteps: Array, finalOutput: object }.
   */
  async function loopManager(loopNodesConfig) {
    const loopInternalSteps = [];
    if (!loopNodesConfig || loopNodesConfig.length === 0) {
      const passOutput = { edges: ['pass'] };
      return { internalSteps: [{ nodeDetail: "Empty Loop Body", output: passOutput }], finalOutput: passOutput };
    }
    const controllerNode = loopNodesConfig[0];
    const actionNodes = loopNodesConfig.slice(1);
    let maxIterations = 100; // Default max iterations, can be made configurable
    let iterationCount = 0;
    let lastLoopIterationOutput = { edges: ['pass'] }; // Initialize with a default

    while (iterationCount < maxIterations) {
      iterationCount++;
      const loopIterationInstanceId = `${flowInstanceId}-loop${iterationCount}`;
      
      // Execute the loop controller node in its own FlowManager instance
      const controllerFM = FlowManager({
        initialState: fmState.getState(), // Controller gets current state
        nodes: [controllerNode],
        instanceId: `${loopIterationInstanceId}-ctrl`,
        scope: scope // Pass down the scope
      });
      
      const controllerRunResult = await controllerFM.run();
      let controllerOutput;

      if (controllerRunResult && controllerRunResult.length > 0) {
        controllerOutput = controllerRunResult.at(-1).output;
        fmState.set(null, controllerFM.getStateManager().getState()); // Update parent state with controller's modifications
        loopInternalSteps.push({
          nodeDetail: `Loop Iter ${iterationCount}: Controller ${typeof controllerNode === 'string' ? controllerNode : 'Complex Controller'}`,
          outputFromController: controllerOutput,
          controllerSubSteps: controllerRunResult
        });
      } else {
        console.warn(`[FlowManager:${flowInstanceId}] Loop controller (iter ${iterationCount}) did not produce output. Defaulting to 'exit'.`);
        controllerOutput = { edges: ['exit'] }; // Default to exit if no output from controller
        loopInternalSteps.push({
          nodeDetail: `Loop Iter ${iterationCount}: Controller Error or No Output`, outputFromController: controllerOutput,
        });
      }
      
      lastLoopIterationOutput = controllerOutput; // Track the latest output from this iteration's controller

      // If controller signals 'exit' or 'exit_forced', terminate the loop
      if (controllerOutput.edges.includes('exit') || controllerOutput.edges.includes('exit_forced')) {
        break; 
      }

      // Execute action nodes if controller did not exit and actions exist
      if (actionNodes.length > 0) {
        const actionsFM = FlowManager({
          initialState: fmState.getState(), // Actions get state potentially modified by controller
          nodes: actionNodes,
          instanceId: `${loopIterationInstanceId}-actions`,
          scope: scope // Pass down the scope
        });
        
        const actionsRunResult = await actionsFM.run();
        fmState.set(null, actionsFM.getStateManager().getState()); // Update parent state with actions' modifications

        if (actionsRunResult && actionsRunResult.length > 0) {
          // The output of the last action node in the iteration becomes the iteration's effective output for branching/decision purposes.
          lastLoopIterationOutput = actionsRunResult.at(-1).output; 
          loopInternalSteps.push({
            nodeDetail: `Loop Iter ${iterationCount}: Actions`, outputFromActions: lastLoopIterationOutput, actionSubSteps: actionsRunResult
          });
        } else {
           loopInternalSteps.push({ nodeDetail: `Loop Iter ${iterationCount}: Actions (no output/steps)`, actionSubSteps: actionsRunResult || [] });
           // If actions run but produce no steps/output, retain controller's output as lastLoopIterationOutput
        }
      }

      if (iterationCount >= maxIterations) {
        console.warn(`[FlowManager:${flowInstanceId}] Loop reached max iterations (${maxIterations}). Forcing exit.`);
        lastLoopIterationOutput = { edges: ['exit_forced'] }; // Special edge for max iterations
        loopInternalSteps.push({ nodeDetail: "Loop Max Iterations Reached", output: lastLoopIterationOutput });
        break;
      }
    }
    // The finalOutput of the loop is the output of its last executed component (controller or last action)
    return { internalSteps: loopInternalSteps, finalOutput: lastLoopIterationOutput };
  }

  /**
   * Evaluates a single node in the workflow.
   * This function determines the node type and executes it accordingly,
   * handling functions, strings (resolved via scope), arrays (sub-flows/loops),
   * and objects (branches/parameterized calls).
   * @param {any} node - The node definition to evaluate.
   * @returns {Promise<void>}
   */
  async function evaluateNode(node) {
    let output = null;
    let returnedValue;
    const nodeToRecord = node; // Keep the original node definition for recording
    let subStepsToRecord = null; // For recording steps from sub-flows, loops, or branches

    // Helper to execute a node's implementation function with the correct context and arguments
    async function executeFunc(fn, context, ...args) {
        return await Promise.resolve(fn.apply(context, args));
    }

    if (typeof node === 'function') {
      // Direct function node
      returnedValue = await executeFunc(node, baseExecutionContext);
    } else if (typeof node === 'string') {
      // String node: resolve to an implementation function using the scope
      const implementation = resolveNodeFromScope(node);
      if (implementation) {
        returnedValue = await executeFunc(implementation, baseExecutionContext);
      } else {
        console.error(`[FlowManager:${flowInstanceId}] Node/Function '${node}' not found in scope. Treating as error.`);
        output = { edges: ['error'], errorDetails: `Node/Function '${node}' not found in scope` };
      }
    } else if (Array.isArray(node)) {
      // Array node: can be a loop or a sub-flow
      if (node.length === 1 && Array.isArray(node[0]) && node[0].length > 0) {
        // Loop construct: [[controller, ...actions]]
        const loopRun = await loopManager(node[0]);
        output = loopRun.finalOutput;
        subStepsToRecord = loopRun.internalSteps;
      } else if (node.length > 0) {
        // Sub-flow construct: [node1, node2, ...]
        const subflowFM = FlowManager({
          initialState: fmState.getState(),
          nodes: node,
          instanceId: `${flowInstanceId}-subflow-idx${currentIndex-1}`, // Unique ID for sub-flow instance
          scope: scope // Pass down the scope
        });
        const subflowResultSteps = await subflowFM.run();
        fmState.set(null, subflowFM.getStateManager().getState()); // Update parent state with sub-flow's final state
        output = subflowResultSteps?.at(-1)?.output || { edges: ['pass'] }; // Default to 'pass' if sub-flow has no output
        subStepsToRecord = subflowResultSteps;
      } else {
        // Empty array as a node: considered a pass-through
        output = {edges: ['pass']};
      }
    } else if (typeof node === 'object' && node !== null) {
      // Object node: can be a parameterized function call or a branch
      if (Object.keys(node).length === 0) {
        // Empty object as a node: considered a pass-through
        output = { edges: ['pass'] };
      } else {
        const nodeKey = Object.keys(node)[0]; // The first key determines behavior
        const nodeValue = node[nodeKey];
        
        const implementation = resolveNodeFromScope(nodeKey);

        if (implementation && Object.keys(node).length === 1 && ( (typeof nodeValue === 'object' && !Array.isArray(nodeValue)) || nodeValue === undefined) ) {
          // Case 1: Parameterized function call: { "nodeNameOrId": {param1: value1, ...} }
          // or { "nodeNameOrId": {} } or just { "nodeNameOrId" } (resolved, undefined value)
          returnedValue = await executeFunc(implementation, baseExecutionContext, nodeValue || {}); // Pass params or empty object
        } else {
          // Case 2: Branching construct: { "edgeName1": nodeA, "edgeName2": nodeB, ... }
          // This also handles the case where nodeKey was not a resolvable function, treating the object as a branch.
          const prevStepOutput = steps.at(-1)?.output;
          const prevEdges = (prevStepOutput && prevStepOutput.edges) ? prevStepOutput.edges : [];
          let branchTaken = false;

          for (const edgeKey of Object.keys(node)) { // Iterate over all keys in the object for potential branch matches
            if (prevEdges.includes(edgeKey)) {
              const branchNodeDefinition = node[edgeKey];
              const branchFM = FlowManager({
                initialState: fmState.getState(),
                nodes: Array.isArray(branchNodeDefinition) ? branchNodeDefinition : [branchNodeDefinition], // Branch can be single node or sub-flow
                instanceId: `${flowInstanceId}-branch-${edgeKey}-idx${currentIndex-1}`,
                scope: scope // Pass down the scope
              });
              const branchResultSteps = await branchFM.run();
              fmState.set(null, branchFM.getStateManager().getState()); // Update parent state
              output = branchResultSteps?.at(-1)?.output || { edges: ['pass'] };
              subStepsToRecord = branchResultSteps;
              branchTaken = true;
              break; // Take the first matching branch
            }
          }
          if (!branchTaken) {
            // If no edge from the previous step matched a key in this branch object,
            // the branch node itself defaults to a 'pass' output.
            output = { edges: ['pass'] }; 
          }
        }
      }
    } else {
      // Unknown node type
      console.warn(`[FlowManager:${flowInstanceId}] Unknown node type or unhandled case:`, node);
      output = { edges: ['error', 'pass'], errorDetails: 'Unknown node type' };
    }

    // If an implementation returned a value but `output` wasn't set directly (e.g., for errors), process it.
    if (returnedValue !== undefined && output === null) {
      output = await processReturnedValue(returnedValue, baseExecutionContext);
    }

    // Ensure output is always an object with an edges array, defaulting to 'pass'.
    if (!output || typeof output.edges === 'undefined' || !Array.isArray(output.edges) || output.edges.length === 0) {
      output = { ...(output || {}), edges: ['pass'] };
    }
    
    // Record the step
    steps.push({ node: nodeToRecord, output, ...(subStepsToRecord && { subSteps: subStepsToRecord }) });

    // Emit 'flowManagerStep' event via FlowHub for external listeners (e.g., UI, logging)
    FlowHub._emitEvent('flowManagerStep', {
      flowInstanceId: flowInstanceId,
      stepIndex: currentIndex - 1, // 0-based index of the node just processed
      stepData: JSON.parse(JSON.stringify(steps.at(-1))), // Deep copy of the last recorded step
      currentState: fmState.getState() // State *after* this step
    });
  }

  /**
   * Internal recursive function to process the next node in the `nodes` array.
   * @returns {Promise<void>}
   */
  async function _nextStepInternal() {
    if (currentIndex < nodes.length) {
      currentNode = nodes[currentIndex];
      currentIndex++; // Increment current index *before* processing the node at this (now previous) index
      await evaluateNode(currentNode);
      await _nextStepInternal(); // Recurse for the next step
    } else {
      // All nodes processed, resolve the main run promise
      if (_resolveRunPromise) {
        _resolveRunPromise(JSON.parse(JSON.stringify(steps))); // Resolve with a deep copy of steps
        _resolveRunPromise = null; _rejectRunPromise = null; // Clear promise handlers
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
      currentIndex = 0; // Reset current index for a fresh run
      steps.length = 0;   // Clear previous steps

      // Clean up event listeners registered by THIS FlowManager instance on FlowHub from previous runs.
      // This prevents duplicate listeners if `run()` is called multiple times on the same FM instance.
      _registeredHubListeners.forEach(listenerRegistration => {
          FlowHub.removeEventListener(listenerRegistration.hubEventName, listenerRegistration.effectiveHubCallback);
      });
      _registeredHubListeners.length = 0; // Clear the array for this run

      return new Promise(async (resolve, reject) => {
        _resolveRunPromise = resolve;
        _rejectRunPromise = reject;

        if (!nodes || nodes.length === 0) {
          console.log(`[FlowManager:${flowInstanceId}] No nodes to execute.`);
          resolve([]); // Resolve with empty array if no nodes
          _resolveRunPromise = null; _rejectRunPromise = null;
          return;
        }

        try {
          console.log(`[FlowManager:${flowInstanceId}] Starting execution. Total nodes: ${nodes.length}. Scope keys: ${Object.keys(scope).length}`);
          await _nextStepInternal(); // Start the recursive step processing
          console.log(`[FlowManager:${flowInstanceId}] Execution finished. Total steps executed: ${steps.length}.`);
        } catch (error) {
          console.error(`[FlowManager:${flowInstanceId}] Error during flow execution:`, error);
          if(_rejectRunPromise) _rejectRunPromise(error); // Reject the main run promise
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
    // No instance-specific event listeners (addEventListener/removeEventListener) directly on FlowManager.
    // All eventing (pause/resume, step notifications, custom node events) is handled via FlowHub.
  };
}