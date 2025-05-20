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
 * @returns {object} An API to run and interact with the flow.
 */
function FlowManager({initialState, nodes}={initialState:{}, nodes:[]}) {
  // `steps`: An array to record each executed node and its output.
  // This provides a full audit trail of the workflow's execution, crucial for debugging
  // and understanding an agent's decision-making process.
  const steps = [];
  let currentNode = null; // The node currently being processed.
  let currentIndex = 0;   // The index of the current node in the `nodes` array.

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
   *
   * @param {*} returnedValue - The raw value returned by a node's function.
   * @param {object} context - The execution context (often `{ state: fmState }`) for edge functions.
   * @returns {Promise<object>} A promise resolving to the standardized output object (e.g., `{ edges: ['next'], results: [...] }`).
   */
  async function processReturnedValue(returnedValue, context) {
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
      // This ensures that any state modifications or side effects from these functions
      // occur in a defined order.
      for (const k of edgeNames) {
        try {
          const edgeFn = edgeFunctions[k];
          let result;
          if (isAsyncFunction(edgeFn)) {
            result = await edgeFn.apply(context, []);
          } else {
            result = edgeFn.apply(context, []);
          }
          results.push(result);
        } catch (e) {
          console.error(`Error executing edge function for '${k}':`, e);
          results.push({ error: e.message }); // Capture errors from edge functions.
        }
      }
      output = {
        edges: edgeNames, // The names of the edges determined by the object keys.
        results: results  // The results of executing the associated edge functions.
      };
    } else if (typeof returnedValue === 'string') {
      // A single string is treated as a single edge.
      output = { edges: [returnedValue] };
    } else {
      // Default fallback for any other type of returned value.
      output = { edges: ['pass'] };
    }
    return output;
  }

  // --- loopManager (Becomes async) ---
  /**
   * `loopManager`: Handles the execution of loop constructs within the workflow.
   * A loop is defined by a 'controller' node and a sequence of 'action' nodes.
   * The controller determines if the loop should continue or exit.
   * This enables iterative processes, essential for tasks like retrying operations,
   * processing lists of items, or polling for conditions in agentic workflows.
   * The loop has a `maxIterations` safeguard to prevent infinite loops.
   * Each iteration of the loop (controller + actions) is itself a sub-flow,
   * potentially involving asynchronous operations.
   *
   * @param {Array} loopNodesConfig - An array where the first element is the controller node
   *                                  and subsequent elements are action nodes for the loop body.
   *                                  Example: `[['MyLoopController', 'MyLoopAction1', 'MyLoopAction2']]`
   * @returns {Promise<object>} A promise resolving to an object containing `internalSteps` (audit trail for the loop)
   *                            and `finalOutput` (the output of the last meaningful operation in the loop).
   */
  async function loopManager(loopNodesConfig) {
    const loopInternalSteps = []; // Records steps *within* this loop execution.
    if (!loopNodesConfig || loopNodesConfig.length === 0) {
      const passOutput = { edges: ['pass'] }; // Handle empty loop definition.
      return { internalSteps: [{ nodeDetail: "Empty Loop Body", output: passOutput }], finalOutput: passOutput };
    }

    const controllerNode = loopNodesConfig[0]; // The first node is the loop controller.
    const actionNodes = loopNodesConfig.slice(1); // Remaining nodes are actions in the loop body.
    let maxIterations = 100; // Safety break to prevent runaway loops.
    let iterationCount = 0;
    let lastLoopIterationOutput = { edges: ['pass'] }; // Default output if loop doesn't run meaningfully.

    while (iterationCount < maxIterations) {
      iterationCount++;

      // Execute the controller node. It's a mini-flow itself.
      // The controller's state is inherited from the main flow's current state.
      const controllerFM = FlowManager({
        initialState: fmState.getState(),
        nodes: [controllerNode] // The controller runs as a single-node sub-flow.
      });
      const controllerRunResult = await controllerFM.run(); // Await if controller is async.
      let controllerOutput;

      if (controllerRunResult && controllerRunResult.length > 0) {
        controllerOutput = controllerRunResult.at(-1).output;
        // Crucially, update the main flow's state with any changes made by the controller.
        // This allows the controller to influence the broader agent context.
        fmState.set(null, controllerFM.getStateManager().getState());
        loopInternalSteps.push({
          nodeDetail: `Loop Iter ${iterationCount}: Controller ${typeof controllerNode === 'string' ? controllerNode : 'Complex Controller'}`,
          outputFromController: controllerOutput,
          controllerSubSteps: controllerRunResult
        });
      } else {
        console.warn("Loop controller did not produce output. Exiting loop.");
        controllerOutput = { edges: ['exit'] }; // Force exit if controller fails.
        loopInternalSteps.push({
          nodeDetail: `Loop Iter ${iterationCount}: Controller Error`, outputFromController: controllerOutput,
        });
      }
      lastLoopIterationOutput = controllerOutput; // Track the last significant output from the loop.

      // The controller signals 'exit' to break the loop.
      // This is a key mechanism for agentic control flow within iterative processes.
      if (controllerOutput.edges.includes('exit')) {
        break;
      }

      // If there are action nodes and the loop hasn't exited, execute them.
      if (actionNodes.length > 0) {
        const actionsFM = FlowManager({
          initialState: fmState.getState(), // Actions also inherit and can modify the main state.
          nodes: actionNodes // Actions run as a sequential sub-flow.
        });
        const actionsRunResult = await actionsFM.run(); // Await if actions are async.
        // Update main state with changes from action nodes.
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
        console.warn(`Loop reached max iterations (${maxIterations}). Forcing exit.`);
        lastLoopIterationOutput = { edges: ['exit_forced'] };
        loopInternalSteps.push({ nodeDetail: "Loop Max Iterations Reached", output: lastLoopIterationOutput });
        break;
      }
    }
    // The loop manager returns its internal execution steps and the final determining output.
    return { internalSteps: loopInternalSteps, finalOutput: lastLoopIterationOutput };
  }

  // --- evaluateNode (Becomes async) ---
  /**
   * `evaluateNode`: The heart of the FlowManager's execution engine.
   * This function is responsible for interpreting and executing a single node from
   * the workflow definition. It's highly versatile, capable of handling various
   * node types:
   *  - Direct function calls (inline or from `scope`).
   *  - String references to functions in the `scope` (a library of reusable agent capabilities).
   *  - Arrays, interpreted as sequential sub-flows or loop constructs.
   *  - Objects, interpreted as conditional branches (routing based on previous node's output edge)
   *    or as parameterized calls to `scope` functions.
   *
   * This polymorphic evaluation is key to the framework's power, allowing complex,
   * dynamic, and serializable workflow definitions. It manages asynchronous operations
   * by `await`ing them where necessary. The state `fmState` is passed as context,
   * allowing nodes to read and write to the agent's shared memory.
   *
   * @param {*} node - The node definition to evaluate. This can be a string, function, array, or object.
   * @returns {Promise<void>} A promise that resolves when the node (and any sub-flows it triggers)
   *                          has completed execution.
   */
  async function evaluateNode(node) {
    let output = null;        // The standardized output of the node.
    let returnedValue;      // The raw value returned by the node's primary logic.
    const nodeToRecord = node;// The original node definition for logging.
    let subStepsToRecord = null; // If the node expands into a sub-flow (like a loop or conditional branch).
    let executionContext;   // Context passed to functions, typically `{ state: fmState, ... }`.

    /**
     * Helper to execute a function (node's own function or a scope function)
     * and correctly await it if it's an async function.
     * This centralizes the logic for calling potentially async user-defined code.
     */
    async function executeFunc(fn, context, ...args) {
        if (isAsyncFunction(fn)) {
            return await fn.apply(context, args);
        } else {
            return fn.apply(context, args);
        }
    }

    // --- Node Type Interpretation ---
    if (typeof node === 'function') {
      // Case 1: Node is a direct JavaScript function.
      // The function is executed with `fmState` available in its `this.state`.
      // This is useful for inline, dynamic logic within the workflow definition.
      executionContext = { state: fmState }; // Provide state access.
      returnedValue = await executeFunc(node, executionContext);
    } else if (typeof node === 'string') {
      // Case 2: Node is a string, representing a named function in the `scope`.
      // The `scope` acts as a library of predefined actions or capabilities for the agent.
      // This promotes reusability and modularity in agent design.
      executionContext = { state: fmState, steps, nodes, currentIndex }; // Richer context for scope functions.
      if (scope && scope[node]) { // Ensure `scope` is defined and the function exists.
        returnedValue = await executeFunc(scope[node], executionContext);
      } else {
        console.error(`Function ${node} not found in scope.`);
        // If a scope function is missing, it's an error in the workflow definition.
        // Output an 'error' edge to allow the flow to potentially handle this.
        output = { edges: ['error'], errorDetails: `Function ${node} not found` };
      }
    } else if (Array.isArray(node)) {
      // Case 3: Node is an array, indicating a structural pattern.
      if (node.length === 1 && Array.isArray(node[0]) && node[0].length > 0) {
        // Sub-case 3a: Loop construct, e.g., `[['LoopController', 'LoopAction']]`.
        // This delegates to `loopManager` for iterative execution.
        // Loops are fundamental for many agentic tasks (e.g., polling, retries, processing sequences).
        const loopRun = await loopManager(node[0]); // Await the asynchronous loop.
        output = loopRun.finalOutput;
        subStepsToRecord = loopRun.internalSteps; // Capture loop's internal execution for audit.
      } else if (node.length > 0) {
        // Sub-case 3b: Sequential sub-flow, e.g., `['Action1', 'Action2']`.
        // This creates a new FlowManager instance to run the sub-flow, inheriting current state.
        // Enables hierarchical task decomposition, a key pattern for complex agent plans.
        const subflowFM = FlowManager({
          initialState: fmState.getState(), // Sub-flow inherits and can modify state.
          nodes: node
        });
        const subflowResultSteps = await subflowFM.run(); // Recursively run the sub-flow.
        fmState.set(null, subflowFM.getStateManager().getState()); // Sync state back.
        output = subflowResultSteps?.at(-1)?.output || { edges: ['pass'] };
        subStepsToRecord = subflowResultSteps;
      } else {
        // Sub-case 3c: Empty array node, treated as a no-op, defaults to 'pass'.
        output = {edges: ['pass']};
      }
    } else if (typeof node === 'object' && node !== null) {
      // Case 4: Node is an object, indicating conditional logic or a parameterized call.
      if (Object.keys(node).length === 0) {
        // Sub-case 4a: Empty object, treated as a no-op.
        output = { edges: ['pass'] };
      } else {
        const nodeKey = Object.keys(node)[0]; // Typically, the function name or first edge.
        const nodeValue = node[nodeKey];

        // Sub-case 4b: Parameterized function call, e.g., `{ 'MyFunction': {param1: 'val'} }`.
        // The `nodeKey` is the function name in `scope`, and `nodeValue` is the parameters object.
        // This allows passing dynamic arguments to reusable agent capabilities.
        if (typeof nodeValue === 'object' && !Array.isArray(nodeValue) && scope && scope[nodeKey]) {
          executionContext = { state: fmState, steps, nodes, currentIndex };
          // The parameters (`nodeValue`) are passed as the first argument to the scope function.
          returnedValue = await executeFunc(scope[nodeKey], executionContext, nodeValue);
        } else {
          // Sub-case 4c: Conditional/Structural node (branching), e.g., `{ 'edgeFromPrev': 'NextNode' }`.
          // The keys of the object are expected edge names from the *previous* node's output.
          // The flow transitions to the node specified by the value of the matched edge.
          // This is the primary mechanism for decision-making and routing in the agent's workflow.
          const prevStepOutput = steps.at(-1)?.output;
          const prevEdges = (prevStepOutput && prevStepOutput.edges) ? prevStepOutput.edges : [];
          let branchTaken = false;

          for (const edgeKey of Object.keys(node)) { // Iterate over defined branches in this conditional node.
            if (prevEdges.includes(edgeKey)) { // Check if any previous output edge matches a branch.
              const branchNode = node[edgeKey]; // The node or sub-flow to execute for this branch.
              // Execute the branch as a new sub-flow.
              const branchFM = FlowManager({
                initialState: fmState.getState(),
                nodes: Array.isArray(branchNode) ? branchNode : [branchNode] // Branch can be single node or array (sub-flow).
              });
              const branchResultSteps = await branchFM.run();
              fmState.set(null, branchFM.getStateManager().getState()); // Sync state.

              output = branchResultSteps?.at(-1)?.output || { edges: ['pass'] };
              subStepsToRecord = branchResultSteps;
              branchTaken = true;
              break; // Only take the first matched branch.
            }
          }
          if (!branchTaken) {
            // If no edge from the previous step matches any branch in this conditional node,
            // it's a "no-match" scenario. Default to 'pass' to allow flow to potentially continue.
            // For agentic systems, this might indicate a need for a default path or error handling.
            output = { edges: ['pass'] };
          }
        }
      }
    } else {
      // Case 5: Unknown node type. This is an unhandled case in the workflow definition.
      console.warn('Unknown node type or unhandled case:', node);
      output = { edges: ['error', 'pass'] }; // Signal an error but also 'pass' to potentially recover.
    }

    // If `returnedValue` was set (typically by a function-like node) and `output` wasn't directly
    // set by structural logic (array/object handling), then process `returnedValue` to get a standard output.
    if (returnedValue !== undefined && output === null) {
      output = await processReturnedValue(returnedValue, executionContext || { state: fmState });
    }

    // Ensure output is always a valid structure with an 'edges' array.
    // This guarantees consistency for subsequent conditional branching logic.
    if (!output || typeof output.edges === 'undefined' || !Array.isArray(output.edges)) {
      output = { edges: ['pass'] }; // Default to 'pass' if output is malformed.
    }

    // Record the completed step: the node itself, its processed output, and any sub-steps.
    // This audit trail is invaluable for understanding and debugging agent behavior.
    steps.push({ node: nodeToRecord, output, ...(subStepsToRecord && { subSteps: subStepsToRecord }) });
    // The call to the next step is handled by `_nextStepInternal`'s recursive loop.
  }

  // --- _nextStepInternal (Handles the flow asynchronously) ---
  /**
   * `_nextStepInternal`: The recursive asynchronous function that drives the workflow execution.
   * It picks the next node from the `nodes` array, calls `evaluateNode` for it,
   * and then calls itself to process the subsequent node. This continues until all
   * nodes in the current flow (or sub-flow) are processed.
   * This is the engine's main execution loop, ensuring sequential (but potentially async)
   * processing of the defined workflow graph.
   *
   * @returns {Promise<void>}
   */
  async function _nextStepInternal() {
    if (currentIndex < nodes.length) {
      // If there are more nodes to process in the current list:
      currentNode = nodes[currentIndex];
      currentIndex++;
      await evaluateNode(currentNode); // Evaluate the current node (this may be async).
      await _nextStepInternal();     // Recursively call to process the next node.
    } else {
      // All nodes in the current `nodes` list have been processed.
      // Resolve the main promise returned by `run()`.
      if (_resolveRunPromise) {
        // Return a deep copy of the steps to the caller.
        _resolveRunPromise(JSON.parse(JSON.stringify(steps)));
        // Clear promise handlers to prevent multiple resolutions.
        _resolveRunPromise = null;
        _rejectRunPromise = null;
      }
    }
  }

  // --- Returned API ---
  // This is the public interface of the FlowManager instance.
  return {
    /**
     * `run`: Initiates the execution of the configured workflow.
     * This method is asynchronous and returns a Promise that resolves with an array
     * of all executed steps once the entire flow has completed.
     * This is the primary entry point for an agent to start its defined task sequence.
     *
     * The `run` method resets internal pointers, allowing the same FlowManager instance
     * to be run multiple times if needed (though typically a new instance is created for
     * each top-level workflow execution to ensure clean state).
     *
     * @returns {Promise<Array<object>>} A promise that resolves with the array of executed steps.
     *                                    Each step object contains details about the node, its output,
     *                                    and any sub-steps if it was a complex construct like a loop.
     */
    async run() {
      // Reset internal state for a fresh run.
      currentIndex = 0;
      steps.length = 0;
      // Optional: For a full reset including state, uncomment:
      // fmState = StateManager(initialState);

      // Return a new Promise that will be resolved/rejected by `_nextStepInternal`.
      return new Promise(async (resolve, reject) => {
        _resolveRunPromise = resolve;
        _rejectRunPromise = reject; // Store reject for global error handling within the flow.

        if (!nodes || nodes.length === 0) {
          // If no nodes are defined, resolve immediately with an empty array.
          resolve([]);
          _resolveRunPromise = null;
          _rejectRunPromise = null;
          return;
        }
        try {
          await _nextStepInternal(); // Start the asynchronous execution chain.
        } catch (error) {
          // Catch any unhandled synchronous or asynchronous errors propagated up
          // from `evaluateNode` or other internal functions.
          console.error("Error during flow execution:", error);
          if(_rejectRunPromise) _rejectRunPromise(error); // Reject the main promise.
          _resolveRunPromise = null;
          _rejectRunPromise = null;
        }
      });
    },

    /**
     * `getSteps`: Returns a deep copy of the steps executed so far.
     * Useful for inspecting the progress or history of an agent's execution.
     * @returns {Array<object>} A deep copy of the recorded steps.
     */
    getSteps: () => JSON.parse(JSON.stringify(steps)),

    /**
     * `getStateManager`: Exposes the internal StateManager instance.
     * Allows for more direct or advanced interaction with the agent's state,
     * such as subscribing to state changes or complex queries, if needed.
     * @returns {object} The StateManager instance.
     */
    getStateManager: () => fmState
  };
}

// --- Example Scope & Usage ---
/**
 * `scope`: A globally accessible object that serves as a library of reusable functions (capabilities)
 * for the FlowManager. When a node is defined as a string (e.g., 'print'), the FlowManager
 * looks up this string in the `scope` and executes the corresponding function.
 * This is crucial for defining agentic behaviors: `scope` functions can represent tools,
 * API calls, complex reasoning steps, or any other action an agent might perform.
 * Functions in the scope are executed with a `this` context that includes `this.state`
 * (pointing to the FlowManager's StateManager instance), allowing them to interact
 * with the agent's shared memory.
 */
const scope = {
  pi(params){ // Example: receives parameters if called like {'pi': {x:2, y:3}}
    console.log('THIS in functia pi (scope function context):', this, 'Params:', params);
    // This function returns an object where 'pass' is an edge name,
    // and its value is an "edge function" that calculates the result.
    return {
      pass: () => 3.14 * (params.x || 1) * (params.y || 1)
    };
  }
};

// This function demonstrates dynamic edge determination based on a random value.
// An agent might use such a pattern for probabilistic decision-making.
scope['Rezultat aleator'] = function() {
  const randomValue = Math.random();
  let edge = randomValue > 0.5 ? 'big' : 'small'; // Dynamically choose 'big' or 'small' edge.
  console.log(`Rezultat aleator: ${randomValue}, Edge chosen: ${edge}`);
  return {
    [edge]: () => { // The chosen edge ('big' or 'small')
      // This edge function can modify state.
      this.state.set('rezultatAleator', randomValue);
      return randomValue; // This value becomes part of the step's output.results.
    }
  };
};

scope['Afiseaza rezultat mare'] = function() {
  // Accesses state set by a previous node.
  console.log('E MARE! Valoare:', this.state.get('rezultatAleator'));
  return { pass: () => "Mare afisat" }; // Simple 'pass' edge.
};

scope['Afiseaza rezultat mic'] = function() {
  console.log('E MIC! Valoare:', this.state.get('rezultatAleator'));
  return { pass: () => "Mic afisat" };
};

// Demonstrates a scope function receiving destructured parameters.
// If called as: {'Mesaj Intimpinare': {mesaj: 'Hello', postfix: 'World'}},
// `mesaj` and `postfix` will be available directly.
scope['Mesaj Intimpinare'] = function greet({mesaj, postfix}){
  // Accesses 'name' from the initial state and combines with passed params.
  console.log(this.state.get('name') + '::' + mesaj + ' ' + postfix);
  return { stop: () => "Salutari!" }; // Example of an edge named 'stop'.
};

scope['print'] = function(){
  // A simple utility function, often used for debugging or logging state.
  console.log( 'PRINT FN::' + Math.ceil(Math.random()*100), 'State (partial):', {name: this.state.get('name'), loopCounter: this.state.get('loopCounter') });
  return { pass: () => true }; // Signals successful completion with a 'pass' edge.
};

// Example of a function that takes parameters and modifies state.
scope['With elements'] = function({of}){ // Expects `of` parameter, e.g. {'With elements': {of: [1,2,3]}}
  this.state.set('elements', of); // Stores the provided elements in the agent's state.
  console.log('With elements - set these elements in state:', of);
  return { do: () => true }; // Returns a 'do' edge, potentially for conditional branching.
};

scope['Print elements'] = function(){
  const elements = this.state.get('elements'); // Retrieves elements from state.
  if (elements && elements.length > 0) {
    elements.forEach((element, index) => {
      console.log('Element ' + index + ':', element);
    });
  } else {
    console.log('Print elements: No elements found in state.');
  }
  return { pass: () => "Elements printed" };
};

// --- Loop Controller Example ---
// This function acts as a controller for a loop.
// It checks a counter in the state and decides whether to 'continue' or 'exit' the loop.
// This pattern is fundamental for agentic iteration and condition-based processing.
scope['Loop Controller'] = function() {
  let count = this.state.get('loopCounter') || 0;
  count++;
  this.state.set('loopCounter', count); // Update the counter in the shared state.
  console.log('Loop Controller: iteration count =', count);
  if (count >= 3) { // Loop termination condition.
    this.state.set('loopMessage', 'Loop finished by controller');
    return {
      exit: () => 'Exited at ' + count // Signal 'exit' edge to terminate the loop.
    };
  } else {
    return {
      continue: () => 'Continuing at ' + count // Signal 'continue' (or any non-'exit' edge) to proceed.
    };
  }
};

// An action performed within each iteration of a loop.
scope['Loop Action'] = function() {
  console.log('Loop Action: Executing. Current count from state:', this.state.get('loopCounter'));
  this.state.set('actionDoneInLoop', true); // Example state modification within a loop.
  return { pass: () => 'Action completed' };
};

// Resets a counter in the state, useful for re-running loops or resetting agent state.
scope['Reset Counter'] = function() {
  this.state.set('loopCounter', 0);
  console.log('Counter Reset');
  return "pass"; // Can simply return a string for a single edge.
}

// --- Asynchronous Task Example ---
// This demonstrates an asynchronous scope function. The FlowManager will `await` its completion.
// Essential for AI agents that need to perform non-blocking operations like API calls,
// database queries, or waiting for external events.
scope['Async Task'] = async function() {
  console.log('Async Task: Starting (simulating a 1-second delay)...');
  // `await new Promise` simulates a real asynchronous operation.
  await new Promise(resolve => setTimeout(resolve, 1000));
  this.state.set('asyncResult', 'Async task successfully completed'); // Store result in state.
  console.log('Async Task: Finished.');
  return { pass: () => 'Async Done' }; // Signal completion.
};

scope['Check Async Result'] = function() {
    // This node would typically run after 'Async Task' to verify or use its result.
    console.log('Check Async Result (from state):', this.state.get('asyncResult'));
    return 'pass';
};


// --- Test Flow Execution ---
// This function demonstrates how to instantiate and run the FlowManager.
// It must be `async` because `flowManager.run()` is asynchronous.
async function runTestFlow() {
  /**
   * This `flowManager` instance is configured with an initial state and a `nodes` array.
   * The `nodes` array is the core, serializable definition of the workflow graph.
   * It showcases various node types:
   *  - String references to `scope` functions (e.g., 'Reset Counter').
   *  - Array defining a loop: `[['Loop Controller', 'Loop Action', 'print']]`.
   *  - Array defining a sequential sub-flow: `['Afiseaza rezultat mic', 'print']`.
   *  - Object for conditional branching: `{'big': 'Afiseaza rezultat mare', ...}`.
   *  - Object for parameterized calls: `{'Mesaj Intimpinare': {mesaj: 'Salut', ...}}`.
   * This declarative structure is ideal for AI agents where workflows might be
   * dynamically generated, loaded from a configuration, or adapted at runtime.
   */
  const flowManager = FlowManager({
    initialState:{ // The agent's initial memory/context.
      name: 'Test Flow Initial',
      a: 8,
      b: 5,
      d: { x: 111, y: 200 },
      loopCounter: 0 // Initialized for the loop example.
    },
    nodes:[ // The "program" or "plan" for the agent.
      'Reset Counter', // Simple scope function call.
      // Loop construct: The inner array `['Loop Controller', 'Loop Action', 'print']`
      // defines the controller and actions for the loop. The outer array `[...]`
      // makes it a loop node in the main flow.
      [['Loop Controller', 'Loop Action', 'print']],
      'Async Task',         // Call the asynchronous task.
      'Check Async Result', // Check the result after the async task completes.
      'Rezultat aleator',   // Scope function that returns a dynamic edge.
      { // Conditional node: branches based on the output edge of 'Rezultat aleator'.
        'big': 'Afiseaza rezultat mare', // If 'Rezultat aleator' outputs 'big'.
        'small': ['Afiseaza rezultat mic', 'print'] // If 'small', run this sub-flow.
      },
      // Parameterized call to a scope function.
      {'Mesaj Intimpinare': {'mesaj': 'Salut Petru', 'postfix': '!!!'}},
      {'With elements': {'of': ['el1', 'el2', 'el3']}}, // Another parameterized call.
      { // Conditional branch based on the output of 'With elements'.
        'do': 'Print elements',
        'pass': 'print' // Fallback if 'do' wasn't the edge.
      },
      ['print','print'], // Sequential sub-flow: two 'print' calls.
      { // Conditional branch based on the output of the last 'print' (which is 'pass').
        'pass': [ {'Mesaj Intimpinare': {'mesaj': 'Flow in FLOW', 'postfix': '!!'}} ] // Nested sub-flow in a branch.
      },
    ]
  });

  console.log("--- STARTING FLOW EXECUTION ---");
  try {
    // `await flowManager.run()` executes the entire defined workflow.
    const executedSteps = await flowManager.run();
    console.log("--- FINAL EXECUTED STEPS (Workflow Audit Trail) ---");
    // The `executedSteps` array provides a detailed history of the agent's operations.
    executedSteps.forEach((step, i) => {
        const nodeString = typeof step.node === 'string' ? step.node : JSON.stringify(step.node);
        // Displaying a summary of each step.
        console.log(`Step ${i}: Node: ${nodeString.substring(0,70)}${nodeString.length > 70 ? '...' : ''} -> Output Edges: ${step.output.edges}`);
        if(step.subSteps) { // If a step involved sub-steps (e.g., a loop or sub-flow).
            console.log(`    Contains ${step.subSteps.length} sub-steps (details omitted for brevity).`);
        }
    });

    console.log("--- FINAL STATE (Agent's Memory After Execution) ---");
    // The final state reflects all modifications made by the workflow nodes.
    console.log(JSON.stringify(flowManager.getStateManager().getState(), null, 2));
  } catch (error) {
    console.error("--- FLOW EXECUTION FAILED ---");
    console.error(error);
  }
}

// Execute the example test flow.
runTestFlow();