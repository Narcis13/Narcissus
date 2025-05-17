function FlowManager({initialState, nodes}={initialState:{}, nodes:[]}) {
  const steps = [];
  let currentNode = null;
  let currentIndex = 0;
  const fmState = StateManager(initialState); // Renamed to avoid conflict with context.state

  // --- StateManager ---
  function StateManager(_initialState = {}) {
    const _currentState = JSON.parse(JSON.stringify(_initialState));
    const _history = [JSON.parse(JSON.stringify(_initialState))];
    let _historyCurrentIndex = 0;

    return {
      withState(fn, paramNames) {
        return function(...args) {
          const params = paramNames.reduce((acc, name) => {
            if (name in this.getState()) {
              acc[name] = this.get(name);
            }
            return acc;
          }, {});
          return fn.call(this, params, ...args); // Ensure 'this' context for fn if it expects one from StateManager
        };
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
        // MODIFICATION: Allow replacing the whole state
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
          // Original logic for path-based set
          const newStateCopy = JSON.parse(JSON.stringify(_currentState)); // Work on a copy for path creation
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
          Object.assign(_currentState, newStateCopy); // Apply changes to the actual _currentState
          targetStateObject = current[lastKey]; // The value set
        }

        _history.splice(_historyCurrentIndex + 1);
        _history.push(JSON.parse(JSON.stringify(_currentState)));
        _historyCurrentIndex = _history.length - 1;
        return targetStateObject; // Return the value/object that was set/modified
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

  // --- processReturnedValue ---
  function processReturnedValue(returnedValue, context) {
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
      output = {
        edges: edgeNames,
        results: edgeNames.map(k => {
          try {
            return edgeFunctions[k].apply(context, []); // Apply context to edge functions
          } catch (e) {
            console.error(`Error executing edge function for '${k}':`, e);
            return { error: e.message };
          }
        })
      };
    } else if (typeof returnedValue === 'string') {
      output = { edges: [returnedValue] };
    } else {
      output = { edges: ['pass'] };
    }
    return output;
  }

  // --- loopManager (NEW for handling loop logic) ---
  function loopManager(loopNodesConfig) {
    const loopInternalSteps = [];
    if (!loopNodesConfig || loopNodesConfig.length === 0) {
      const passOutput = { edges: ['pass'] };
      return { internalSteps: [{ nodeDetail: "Empty Loop Body", output: passOutput }], finalOutput: passOutput };
    }

    const controllerNode = loopNodesConfig[0];
    const actionNodes = loopNodesConfig.slice(1);
    let maxIterations = 100; // Safety break for infinite loops
    let iterationCount = 0;
    let lastLoopIterationOutput = { edges: ['pass'] }; // Default if loop doesn't run meaningfully

    while (iterationCount < maxIterations) {
      iterationCount++;
      // console.log(`Loop iteration: ${iterationCount}, Controller: ${JSON.stringify(controllerNode)}`);

      const controllerFM = FlowManager({
        initialState: fmState.getState(),
        nodes: [controllerNode]
      });
      const controllerRunResult = controllerFM.run(); // Array of steps from controller's execution
      let controllerOutput;

      if (controllerRunResult && controllerRunResult.length > 0) {
        controllerOutput = controllerRunResult.at(-1).output;
        fmState.set(null, controllerFM.getStateManager().getState()); // Update main state
        loopInternalSteps.push({
          nodeDetail: `Loop Iter ${iterationCount}: Controller ${typeof controllerNode === 'string' ? controllerNode : 'Complex Controller'}`,
          outputFromController: controllerOutput,
          controllerSubSteps: controllerRunResult
        });
      } else {
        console.warn("Loop controller did not produce output. Exiting loop.");
        controllerOutput = { edges: ['exit'] };
        loopInternalSteps.push({
          nodeDetail: `Loop Iter ${iterationCount}: Controller Error`, outputFromController: controllerOutput,
        });
      }
      lastLoopIterationOutput = controllerOutput;

      if (controllerOutput.edges.includes('exit')) {
        // console.log("Loop exit condition met by controller.");
        break;
      }

      if (actionNodes.length > 0) {
        // console.log(`Loop Iter ${iterationCount}: Executing actions:`, actionNodes);
        const actionsFM = FlowManager({
          initialState: fmState.getState(),
          nodes: actionNodes
        });
        const actionsRunResult = actionsFM.run();
        fmState.set(null, actionsFM.getStateManager().getState()); // Update main state

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
    return { internalSteps: loopInternalSteps, finalOutput: lastLoopIterationOutput };
  }

  // --- evaluateNode (Modified) ---
  function evaluateNode(node) {
    let output = null;
    let returnedValue; // Not necessarily null initially
    const nodeToRecord = node;
    let subStepsToRecord = null;
    let executionContext;

    if (typeof node === 'function') {
      executionContext = { state: fmState };
      returnedValue = node.apply(executionContext, []);
    } else if (typeof node === 'string') {
      executionContext = { state: fmState, steps, nodes, currentIndex }; // Richer context for scope functions
      if (scope[node]) {
        returnedValue = scope[node].apply(executionContext, []);
      } else {
        console.error(`Function ${node} not found in scope.`);
        returnedValue = { error: () => `Function ${node} not found` };
      }
    } else if (Array.isArray(node)) {
      if (node.length === 1 && Array.isArray(node[0]) && node[0].length > 0) { // Loop: [['controller', ...actions]]
        // console.log('Loop construct detected:', node[0]);
        const loopRun = loopManager(node[0]);
        output = loopRun.finalOutput;
        subStepsToRecord = loopRun.internalSteps;
      } else if (node.length > 0) { // Sequential sub-flow: ['node1', 'node2'] or if [[empty_loop_nodes]]
        // console.log('Sequential sub-flow detected:', node);
        const subflowFM = FlowManager({
          initialState: fmState.getState(),
          nodes: node
        });
        const subflowResultSteps = subflowFM.run();
        fmState.set(null, subflowFM.getStateManager().getState());
        output = subflowResultSteps?.at(-1)?.output || { edges: ['pass'] };
        subStepsToRecord = subflowResultSteps;
      } else { // Empty array node
        output = {edges: ['pass']};
      }
    } else if (typeof node === 'object' && node !== null) {
      if (Object.keys(node).length === 0) {
        output = { edges: ['pass'] };
      } else {
        const nodeKey = Object.keys(node)[0];
        const nodeValue = node[nodeKey];
        // Check for Parameterized function call: { 'FunctionName': {param1: value1} }
        if (typeof nodeValue === 'object' && !Array.isArray(nodeValue) && scope[nodeKey]) {
          // console.log(`Parameterized call: ${nodeKey} with params:`, nodeValue);
          executionContext = { state: fmState, steps, nodes, currentIndex };
          returnedValue = scope[nodeKey].apply(executionContext, [nodeValue]);
        } else { // Structural/Conditional node: { 'edge1': 'nodeA', 'edge2': 'nodeB' }
          // console.log('Conditional/Structural node detected:', node);
          const prevStepOutput = steps.at(-1)?.output;
          const prevEdges = (prevStepOutput && prevStepOutput.edges) ? prevStepOutput.edges : [];
          let branchTaken = false;

          for (const edgeKey of Object.keys(node)) { // Iterate over defined branches in current node
            if (prevEdges.includes(edgeKey)) {
              // console.log(`Conditional branch: '${edgeKey}' matched. Executing:`, node[edgeKey]);
              const branchNode = node[edgeKey];
              const branchFM = FlowManager({
                initialState: fmState.getState(),
                nodes: Array.isArray(branchNode) ? branchNode : [branchNode]
              });
              const branchResultSteps = branchFM.run();
              fmState.set(null, branchFM.getStateManager().getState());
              
              output = branchResultSteps?.at(-1)?.output || { edges: ['pass'] };
              subStepsToRecord = branchResultSteps;
              branchTaken = true;
              break; 
            }
          }
          if (!branchTaken) {
            // console.log('No matching edge for conditional node:', node, 'Previous output:', prevStepOutput);
            output = { edges: ['pass'] };
          }
        }
      }
    } else {
      console.warn('Unknown node type or unhandled case:', node);
      output = { edges: ['error', 'pass'] };
    }

    // Process returnedValue if a node function was called and output wasn't directly set by array/object logic
    if (returnedValue !== undefined && output === null) {
      output = processReturnedValue(returnedValue, executionContext);
    }
    
    if (!output || typeof output.edges === 'undefined' || !Array.isArray(output.edges)) {
      // console.warn('Output was malformed or missing for node:', nodeToRecord, 'Original output:', output);
      output = { edges: ['pass'] };
    }
  
    steps.push({ node: nodeToRecord, output, ...(subStepsToRecord && { subSteps: subStepsToRecord }) });
    nextStep();
  }

  // --- nextStep ---
  function nextStep() {
    if (currentIndex < nodes.length) {
      currentNode = nodes[currentIndex];
      currentIndex++;
      evaluateNode(currentNode);
    }
  }

  // --- Returned API ---
  return {
    run() {
      // Reset for a fresh run if called multiple times on the same instance (optional)
      // currentIndex = 0; 
      // steps.length = 0;
      // fmState = StateManager(initialState); // Full reset including state
      nextStep();
      return steps; // Or getSteps() for a copy
    },
    loop() { // Implement the top-level loop method
      // console.log("Running FlowManager in top-level loop mode.");
      if (!nodes || nodes.length === 0) {
        // console.warn("Top-level loop called with no nodes.");
        const emptyLoopRes = { node: "EmptyTopLevelLoop", output: { edges: ['pass'] }, subSteps: [] };
        steps.push(emptyLoopRes);
        return [emptyLoopRes];
      }
      // currentIndex = 0; // Reset internal flow progression for the loop
      // steps.length = 0;   // Clear previous steps for this specific `loop` invocation

      const loopResult = loopManager(nodes); // Use all configured nodes for the loop
      steps.push({
        node: "TopLevelLoopOverAllNodes",
        output: loopResult.finalOutput,
        subSteps: loopResult.internalSteps
      });
      return steps; // Or getSteps()
    },
    getSteps: () => JSON.parse(JSON.stringify(steps)), // Deep copy
    getStateManager: () => fmState // Expose StateManager for direct interaction if needed
  };
}

// --- Example Scope & Usage (Your existing examples + loop controller) ---
const scope = {
  pi(params){ // Example: {x: val, y: val}
    console.log('THIS in functia pi', this, 'Params:', params);
    return {
      pass: () => 3.14 * (params.x || 1) * (params.y || 1)
    };
  }
};

scope['Rezultat aleator'] = function() {
  const randomValue = Math.random();
  let edge = randomValue > 0.5 ? 'big' : 'small';
  // console.log('Rezultat aleator:', randomValue, 'Edge:', edge);
  return {
    [edge]: () => { // This edge function will have `this.state` available
      this.state.set('rezultatAleator', randomValue); // Example of using state in edge fn
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

scope['Mesaj Intimpinare'] = function greet({mesaj, postfix}){ // Destructures params
  console.log(this.state.get('name') + '::' + mesaj + ' ' + postfix); // Example using this.state
  return { stop: () => "Salutari!" }; // 'stop' is an edge name
};

scope['print'] = function(){
  console.log( 'PRINT FN::' + Math.ceil(Math.random()*100), 'State:', this.state.getState());
  return { pass: () => true };
};

scope['With elements'] = function({of}){
  this.state.set('elements', of);
  console.log('With elements - set:', of);
  return { do: () => true }; // Edge 'do'
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

// --- Loop Controller Example ---
scope['Loop Controller'] = function() {
  let count = this.state.get('loopCounter') || 0;
  count++;
  this.state.set('loopCounter', count);
  console.log('Loop Controller: count =', count);
  if (count >= 3) {
    this.state.set('loopMessage', 'Loop finished by controller');
    return {
      exit: () => 'Exited at ' + count
    };
  } else {
    return {
      continue: () => 'Continuing at ' + count // 'continue' or any non-'exit' edge
    };
  }
};
scope['Loop Action'] = function() {
  console.log('Loop Action: Executing. Count from state:', this.state.get('loopCounter'));
  this.state.set('actionDoneInLoop', true);
  return { pass: () => 'Action completed' };
};
scope['Reset Counter'] = function() {
  this.state.set('loopCounter', 0);
  console.log('Counter Reset');
  return "pass";
}

// --- Test Flow ---
const flowManager = FlowManager({
  initialState:{
    name: 'Test Flow Initial',
    a: 8,
    b: 5,
    d: { x: 111, y: 200 },
    loopCounter: 0 // Initialize for loop controller
  }, 
  nodes:[
    'Reset Counter', // Reset counter before loop
    // Loop example: controller and one action. Will run 3 times.
    [['Loop Controller', 'Loop Action', 'print']], 
    'Rezultat aleator', 
    { // Conditional based on 'Rezultat aleator'
      'big': 'Afiseaza rezultat mare',
      'small': ['Afiseaza rezultat mic', 'print'] // Sub-flow for 'small' branch
    },
    {'Mesaj Intimpinare': {'mesaj': 'Salut Petru', 'postfix': '!!!'}},
    {'With elements': {'of': ['el1', 'el2', 'el3']}}, // Parameterized call
    { // Conditional based on output of 'With elements' (which is 'do')
      'do': 'Print elements', 
      'pass': 'print' // Fallback if 'do' wasn't the edge (though it will be)
    },
    ['print','print'], // Sequential sub-flow
    { // Conditional based on previous 'print' (which is 'pass')
      'pass': [ {'Mesaj Intimpinare': {'mesaj': 'Flow in FLOW', 'postfix': '!!'}} ] // Nested sub-flow in branch
    },
    // Example of a loop that will use maxIterations because 'print' doesn't 'exit'
    // [['print']] // This would be an infinite loop (stopped by maxIterations) if 'print' doesn't change to emit 'exit'
  ]
});

const executedSteps = flowManager.run();
console.log("--- FINAL EXECUTED STEPS ---");
// console.log(JSON.stringify(executedSteps, null, 2)); // Full dump can be very large
executedSteps.forEach((step, i) => {
    console.log(`Step ${i}: Node: ${typeof step.node === 'string' ? step.node : JSON.stringify(step.node).substring(0,50)}... Output Edges: ${step.output.edges}`);
    if(step.subSteps) {
        console.log(`    Contains ${step.subSteps.length} sub-steps.`);
    }
});

console.log("--- FINAL STATE ---");
console.log(JSON.stringify(flowManager.getStateManager().getState(), null, 2));

// Example of using the top-level loop() method (less common)
/*
const loopingFlow = FlowManager({
    initialState: { loopCounter: 0, name: "Top Level Looping Flow" },
    nodes: [ // These nodes will form a loop: node[0] is controller, rest are actions
        'Loop Controller', // Controller
        'Loop Action',     // Action
        {'Mesaj Intimpinare': {mesaj: "Inside top loop", postfix:"iteration!"}} // Action
    ]
});
console.log("\n--- TESTING TOP-LEVEL LOOP ---");
const loopingFlowSteps = loopingFlow.loop();
console.log(JSON.stringify(loopingFlow.getStateManager().getState(), null, 2));
// console.log(JSON.stringify(loopingFlowSteps, null, 2));
*/