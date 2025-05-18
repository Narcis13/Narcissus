// Helper function to check if a function is async


function FlowManager({initialState, nodes}={initialState:{}, nodes:[]}) {
  const steps = [];
  let currentNode = null;
  let currentIndex = 0;
  const fmState = StateManager(initialState);
  let _resolveRunPromise = null;
  let _rejectRunPromise = null;
  
  function isAsyncFunction(fn) {
    if (!fn) return false;
    return fn.constructor && fn.constructor.name === 'AsyncFunction';
  }

  // --- StateManager ---
  function StateManager(_initialState = {}) {
    const _currentState = JSON.parse(JSON.stringify(_initialState));
    const _history = [JSON.parse(JSON.stringify(_initialState))];
    let _historyCurrentIndex = 0;

    return {
      withState(fn, paramNames) {
        const smInstance = this; // Capture StateManager's 'this'
        // The returned function should be async if 'fn' is async.
        if (isAsyncFunction(fn)) {
          return async function(...args) { // Return an async function
            const params = (paramNames || []).reduce((acc, name) => {
              // Check if name is a top-level key in _currentState
              if (Object.prototype.hasOwnProperty.call(smInstance.getState(), name)) {
                acc[name] = smInstance.get(name);
              }
              return acc;
            }, {});
            return await fn.call(smInstance, params, ...args); // Ensure 'this' context for fn is StateManager
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

  // --- processReturnedValue (Becomes async) ---
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
      for (const k of edgeNames) { // Iterate to await async edge functions sequentially
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
          results.push({ error: e.message });
        }
      }
      output = {
        edges: edgeNames,
        results: results
      };
    } else if (typeof returnedValue === 'string') {
      output = { edges: [returnedValue] };
    } else {
      output = { edges: ['pass'] };
    }
    return output;
  }

  // --- loopManager (Becomes async) ---
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
      const controllerFM = FlowManager({
        initialState: fmState.getState(),
        nodes: [controllerNode]
      });
      const controllerRunResult = await controllerFM.run(); // Await async run
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
        console.warn("Loop controller did not produce output. Exiting loop.");
        controllerOutput = { edges: ['exit'] };
        loopInternalSteps.push({
          nodeDetail: `Loop Iter ${iterationCount}: Controller Error`, outputFromController: controllerOutput,
        });
      }
      lastLoopIterationOutput = controllerOutput;

      if (controllerOutput.edges.includes('exit')) {
        break;
      }

      if (actionNodes.length > 0) {
        const actionsFM = FlowManager({
          initialState: fmState.getState(),
          nodes: actionNodes
        });
        const actionsRunResult = await actionsFM.run(); // Await async run
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
    return { internalSteps: loopInternalSteps, finalOutput: lastLoopIterationOutput };
  }

  // --- evaluateNode (Becomes async) ---
  async function evaluateNode(node) {
    let output = null;
    let returnedValue;
    const nodeToRecord = node;
    let subStepsToRecord = null;
    let executionContext;

    // Helper to execute a function (node or scope function) and handle async
    async function executeFunc(fn, context, ...args) {
        if (isAsyncFunction(fn)) {
            return await fn.apply(context, args);
        } else {
            return fn.apply(context, args);
        }
    }

    if (typeof node === 'function') {
      executionContext = { state: fmState };
      returnedValue = await executeFunc(node, executionContext);
    } else if (typeof node === 'string') {
      executionContext = { state: fmState, steps, nodes, currentIndex };
      if (scope && scope[node]) { // Ensure scope exists
        returnedValue = await executeFunc(scope[node], executionContext);
      } else {
        console.error(`Function ${node} not found in scope.`);
        returnedValue = { error: () => `Function ${node} not found` }; // This structure might be problematic for processReturnedValue
                                                                     // Better to directly set output or throw
        output = { edges: ['error'], errorDetails: `Function ${node} not found` };
      }
    } else if (Array.isArray(node)) {
      if (node.length === 1 && Array.isArray(node[0]) && node[0].length > 0) { // Loop
        const loopRun = await loopManager(node[0]); // Await async loopManager
        output = loopRun.finalOutput;
        subStepsToRecord = loopRun.internalSteps;
      } else if (node.length > 0) { // Sequential sub-flow
        const subflowFM = FlowManager({
          initialState: fmState.getState(),
          nodes: node
        });
        const subflowResultSteps = await subflowFM.run(); // Await async run
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
        if (typeof nodeValue === 'object' && !Array.isArray(nodeValue) && scope && scope[nodeKey]) { // Param Call
          executionContext = { state: fmState, steps, nodes, currentIndex };
          returnedValue = await executeFunc(scope[nodeKey], executionContext, nodeValue);
        } else { // Structural/Conditional node
          const prevStepOutput = steps.at(-1)?.output;
          const prevEdges = (prevStepOutput && prevStepOutput.edges) ? prevStepOutput.edges : [];
          let branchTaken = false;

          for (const edgeKey of Object.keys(node)) {
            if (prevEdges.includes(edgeKey)) {
              const branchNode = node[edgeKey];
              const branchFM = FlowManager({
                initialState: fmState.getState(),
                nodes: Array.isArray(branchNode) ? branchNode : [branchNode]
              });
              const branchResultSteps = await branchFM.run(); // Await async run
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
      console.warn('Unknown node type or unhandled case:', node);
      output = { edges: ['error', 'pass'] };
    }

    if (returnedValue !== undefined && output === null) {
      output = await processReturnedValue(returnedValue, executionContext || { state: fmState }); // Await async processReturnedValue
    }

    if (!output || typeof output.edges === 'undefined' || !Array.isArray(output.edges)) {
      output = { edges: ['pass'] };
    }

    steps.push({ node: nodeToRecord, output, ...(subStepsToRecord && { subSteps: subStepsToRecord }) });
    // nextStep is no longer called here; it's handled by _nextStepInternal's loop
  }

  // --- _nextStepInternal (Handles the flow asynchronously) ---
  async function _nextStepInternal() {
    if (currentIndex < nodes.length) {
      currentNode = nodes[currentIndex];
      currentIndex++;
      await evaluateNode(currentNode); // Await async evaluateNode
      await _nextStepInternal();     // Continue to the next step
    } else {
      // All nodes processed
      if (_resolveRunPromise) {
        _resolveRunPromise(JSON.parse(JSON.stringify(steps)));
        _resolveRunPromise = null;
        _rejectRunPromise = null;
      }
    }
  }

  // --- Returned API ---
  return {
    async run() {
      currentIndex = 0;
      steps.length = 0;
      // fmState = StateManager(initialState); // Optional: reset state for each run

      return new Promise(async (resolve, reject) => {
        _resolveRunPromise = resolve;
        _rejectRunPromise = reject; // Store reject for error handling

        if (!nodes || nodes.length === 0) {
          resolve([]);
          _resolveRunPromise = null;
          _rejectRunPromise = null;
          return;
        }
        try {
          await _nextStepInternal(); // Start the chain
        } catch (error) {
          console.error("Error during flow execution:", error);
          if(_rejectRunPromise) _rejectRunPromise(error); // Reject the main promise
          _resolveRunPromise = null;
          _rejectRunPromise = null;
        }
      });
    },


    getSteps: () => JSON.parse(JSON.stringify(steps)),
    getStateManager: () => fmState
  };
}

// --- Example Scope & Usage ---
const scope = {
  pi(params){
    console.log('THIS in functia pi', this, 'Params:', params);
    return {
      pass: () => 3.14 * (params.x || 1) * (params.y || 1)
    };
  }
};

scope['Rezultat aleator'] = function() {
  const randomValue = Math.random();
  let edge = randomValue > 0.5 ? 'big' : 'small';
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
  console.log('With elements - set:', of);
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
  console.log('Loop Controller: count =', count);
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
  console.log('Loop Action: Executing. Count from state:', this.state.get('loopCounter'));
  this.state.set('actionDoneInLoop', true);
  return { pass: () => 'Action completed' };
};
scope['Reset Counter'] = function() {
  this.state.set('loopCounter', 0);
  console.log('Counter Reset');
  return "pass";
}

// New Async Task for testing
scope['Async Task'] = async function() {
  console.log('Async Task: Starting (will wait 1 second)...');
  await new Promise(resolve => setTimeout(resolve, 1000));
  this.state.set('asyncResult', 'Async task successfully completed');
  console.log('Async Task: Finished.');
  return { pass: () => 'Async Done' };
};

scope['Check Async Result'] = function() {
    console.log('Check Async Result:', this.state.get('asyncResult'));
    return 'pass';
};


// --- Test Flow (needs to be run in an async context) ---
async function runTestFlow() {
  const flowManager = FlowManager({
    initialState:{
      name: 'Test Flow Initial',
      a: 8,
      b: 5,
      d: { x: 111, y: 200 },
      loopCounter: 0
    },
    nodes:[
      'Reset Counter',
      ['Loop Controller', 'Loop Action', 'print'],
      'Async Task', // Add the async task
      'Check Async Result', // Check state after async task
      'Rezultat aleator',
      {
        'big': 'Afiseaza rezultat mare',
        'small': ['Afiseaza rezultat mic', 'print']
      },
      {'Mesaj Intimpinare': {'mesaj': 'Salut Petru', 'postfix': '!!!'}},
      {'With elements': {'of': ['el1', 'el2', 'el3']}},
      {
        'do': 'Print elements',
        'pass': 'print'
      },
      ['print','print'],
      {
        'pass': [ {'Mesaj Intimpinare': {'mesaj': 'Flow in FLOW', 'postfix': '!!'}} ]
      },
    ]
  });

  console.log("--- STARTING FLOW EXECUTION ---");
  try {
    const executedSteps = await flowManager.run(); // Await the run() method
    console.log("--- FINAL EXECUTED STEPS ---");
    executedSteps.forEach((step, i) => {
        const nodeString = typeof step.node === 'string' ? step.node : JSON.stringify(step.node);
        console.log(`Step ${i}: Node: ${nodeString.substring(0,70)}${nodeString.length > 70 ? '...' : ''} Output Edges: ${step.output.edges}`);
        if(step.subSteps) {
            console.log(`    Contains ${step.subSteps.length} sub-steps.`);
        }
    });

    console.log("--- FINAL STATE ---");
    console.log(JSON.stringify(flowManager.getStateManager().getState(), null, 2));
  } catch (error) {
    console.error("--- FLOW EXECUTION FAILED ---");
    console.error(error);
  }


}

// Execute the test flow
runTestFlow();