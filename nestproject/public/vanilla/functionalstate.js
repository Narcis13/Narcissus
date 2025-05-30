function FlowManager({initialState, nodes}={initialState:{}, nodes:[]}) {
  const steps=[]
  let currentNode = null
  let currentIndex = 0
  const state = StateManager(initialState)
  function StateManager(initialState = {}) {
  // Private state
      const _currentState = JSON.parse(JSON.stringify(initialState));
      const _history = [JSON.parse(JSON.stringify(initialState))];
      let _currentIndex = 0;

      // Return the public API
      return {
        withState(fn, paramNames) {
            return function(...args) {
                // Get the parameter names the function expects
                const params = paramNames.reduce((params, name) => {
                    if (name in this.getState()) {
                        params[name] = this.get(name);
                    }
                    return params;
                }, {}); 
                
                // Call the original function with state parameters and any additional arguments
                return fn(params, ...args);
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
          if (!path) return _currentState;

          const newState = JSON.parse(JSON.stringify(_currentState));
          
          const keys = path.split('.');
          let current = newState;
        
          for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];

            if (!current[key] || typeof current[key] !== 'object') {
              current[key] = {};
            }
            current = current[key];
          }

          const lastKey = keys[keys.length - 1];
          current[lastKey] = value;

          // Update state
          Object.assign(_currentState, newState);

          // Update history
          _history.splice(_currentIndex + 1);
          _history.push(JSON.parse(JSON.stringify(_currentState)));
          _currentIndex = _history.length - 1;
          
          return value;
        },

        getState() {
          return JSON.parse(JSON.stringify(_currentState));
        },

        canUndo() {
          return _currentIndex > 0;
        },

        canRedo() {
          return _currentIndex < _history.length - 1;
        },

        undo() {
          if (this.canUndo()) {
            _currentIndex--;
            Object.assign(_currentState, JSON.parse(JSON.stringify(_history[_currentIndex])));
          }
          return this.getState();
        },

        redo() {
          if (this.canRedo()) {
            _currentIndex++;
            Object.assign(_currentState, JSON.parse(JSON.stringify(_history[_currentIndex])));
          }
          return this.getState();
        },

        goToState(index) {
          if (index >= 0 && index < _history.length) {
            _currentIndex = index;
            Object.assign(_currentState, JSON.parse(JSON.stringify(_history[_currentIndex])));
          }
          return this.getState();
        },

        getHistory() {
          return _history.map(state => JSON.parse(JSON.stringify(state)));
        },

        getCurrentIndex() {
          return _currentIndex;
        }
      };
    }
  
    function processReturnedValue(returnedValue){
      let output = null;
      if (Array.isArray(returnedValue)) {
        if(returnedValue.every(item => typeof item === 'string') && returnedValue.length > 0){
          output = {edges: returnedValue};
        } else {
          output = {edges: ['pass']};
        }
      } else if (typeof returnedValue === 'object' && returnedValue !== null) {
        output = {
          edges: Object.keys(returnedValue).filter(key => typeof returnedValue[key] === 'function'),
          results: Object.keys(returnedValue).filter(key => typeof returnedValue[key] === 'function').map(k => {
            return returnedValue[k]();
          })
        };
      } else if (typeof returnedValue === 'string') {
        output = {edges: [returnedValue]};
      } else {
        output = {edges: ['pass']};
      } 
      return output;
    }
    
    function evaluateNode(node){
    let output = null;
    let returnedValue = null;
    
    if (typeof node === 'function' || typeof node === 'string') {
      returnedValue = typeof node === 'function' ? node.apply(state, []) : scope[node].apply({state, steps,nodes,currentIndex}, []);
      
      output = processReturnedValue(returnedValue);

    } else if (typeof node === 'object' && !Array.isArray(node)) {
      if (Object.keys(node).length > 0) {
        if(typeof node[Object.keys(node)[0]] === 'object' && !Array.isArray(node[Object.keys(node)[0]])){
          // call node with params
          returnedValue = scope[Object.keys(node)[0]].apply({state, steps,nodes,currentIndex}, [node[Object.keys(node)[0]]]);
          output = processReturnedValue(returnedValue)//{edges: ['pass']}; // Set default output for object nodes
        } else {
          // here we have a structure node (decision or loop)
          Object.keys(node).forEach(key => {
            // FIX: Check if steps.at(-1) exists and has an output with edges
            const edges = (steps.at(-1) && steps.at(-1).output && steps.at(-1).output.edges) ? steps.at(-1).output.edges : [];
            
            if(typeof node[key] === 'string' || typeof node[key] === 'function' || Array.isArray(node[key])){
              if (edges.includes(key)) {
                console.log('rezultat anterior', steps.at(-1).output);// de aici poate ma leg sa fac loop!
                if(Array.isArray(node[key])){
                      const res=  FlowManager({
                        initialState: state.getState(),
                        nodes: node[key]
                      }).run();
                      output = res.at(-1)? res.at(-1).output : {edges: ['pass']};
                } else {  
                      evaluateNode(node[key]);
                }
              }
            }
          });
        }
      }
      // Ensure output is defined for all object nodes
      if (!output) {
       // console.log('output is not defined for object node', node);
        output = {edges: ['pass']};
      }
    } else if(Array.isArray(node)){
      let res=null
      if(node.length==1&&Array.isArray(node[0])){
          console.log('loop', node[0]);
          // here is the loop implemenetation of the flow manager
          res=  FlowManager({
            initialState: state.getState(),
            nodes: node[0]
          }).loop();
      } else {
           res=  FlowManager({
              initialState: state.getState(),
              nodes: node
            }).run();
          
      }
       output = res&&res.at(-1)? res.at(-1).output : {edges: ['pass']};
     // console.log('rezultatul din flow manager', res);
    }
  
    // Always ensure output has an edges property
    if (!output) {
     console.log('!!!output is not defined', node);
      output = {edges: ['pass']};
    }
  
    steps.push({node, output});
    nextStep();
  }

  function nextStep(){
    if (currentIndex < nodes.length) {
      currentNode = nodes[currentIndex];
      currentIndex++;
      evaluateNode(currentNode);
    } 
  }
  
  return {
   loop() {
      // Implement loop logic here

    },
    run(){
      nextStep();
      return steps;
    }
  };
}

const scope = {
  pi(x, y){
    console.log('THIS in functia pi', this);
    return {
      pass: () => 3.14
    };
  }
};

scope['Rezultat aleator'] = function() {
  const randomValue = Math.random();
  let edge = randomValue > 0.5 ? 'big' : 'small';

  return {
    [edge]: () => {
      // return this.state.set('rezultatAleator', randomValue);
    }
  };
};

scope['Afiseaza rezultat mare'] = function() {
  console.log('E MARE!');
  return {
    pass: () => {
      // Function content
    }         
  };
};

scope['Afiseaza rezultat mic'] = function() {
  console.log('E MIC!');
  return {
    pass: () => {
      // Function content
    }         
  };
};


function suma(a, b) {
  // Determine the key name dynamically based on the values of a and b
  let edge = 'start';
  edge = (a + b) % 2 === 0 ? 'pass' : 'mult';
  console.log('in functia suma', this, a, b);
  return {
    pass: () => {
      return this.state.set('rezultatSuma', this.state.get('a') + this.state.get('b'));
    }
  };
}

scope['Mesaj Intimpinare'] = function greet({mesaj, postfix}){
  console.log(this, '::' + mesaj + ' ' + postfix);
  return {
    stop: () => {return true}
  };
};

scope['print'] = function(){
  console.log( 'PRINT::' + Math.ceil(Math.random()*100),this,this.state.getState());
  return {
    pass: () => {return true}
  };
};

scope['With elements'] =function({of}){
  this.state.set('elements',of)
  return {
    do: () => {
      console.log('in do function',this)
      return [true]
    }         
  };
};
scope['Print elements'] = function(){
  const elements = this.state.get('elements');

 elements.forEach((element, index) => {
    console.log('Element ' + index + ':', element);
  });
  return {
    pass: () => {
      // Function content
    }         
  };    
}
const flowManager = FlowManager({
  initialState:{
    name: 'test flow',
    a: 8,
    b: 5,
    d: {
      x: 111,
      y: 200
    }
  }, 
  nodes:[
    [['print']],
    'Rezultat aleator', 
    {
      'big': 'Afiseaza rezultat mare',
      'small': 'Afiseaza rezultat mic'
    },

    {'Mesaj Intimpinare': {'mesaj': 'Salut Petru', 'postfix': '!!!'}},
    {'With elements': {'of': ['1', '2', '3']}},
                             {'do': 'Print elements'},
    ['print','print'],
    {'pass': [{'Mesaj Intimpinare': {'mesaj': 'Flow in FLOW', 'postfix': '!!'}}]}
  ]
});

flowManager.run();
//console.log(flowManager.getSteps()); // Should now work without errors