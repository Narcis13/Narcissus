

function FlowManager(nodes){
  const steps=[]
  let currentNode = null
  let currentIndex = 0

  return {
      getSteps(){
        return steps
      },
      evaluateNode(node){
        let output=null;
        let returnedValue = null;
        if (typeof node === 'function'|| typeof node === 'string') {
          returnedValue = typeof node === 'function' ? node.apply(state, []):scope[node].apply(state, []);
          console.log('node is a ...', typeof node)
          if (Array.isArray(returnedValue)) {
            if(returnedValue.every(item => typeof item === 'string')&& returnedValue.length>0){
              output = {edges: returnedValue};

            } else {
              output = {edges: ['pass']};
            }
           
           
          } else if (typeof returnedValue === 'object' && returnedValue !== null) {
            output= {edges : Object.keys(returnedValue).filter(key => typeof returnedValue[key] === 'function'),results:Object.keys(returnedValue).filter(key => typeof returnedValue[key] === 'function').map(k=>{return returnedValue[k]()})}
          } else if (typeof returnedValue === 'number') { 
          } else if (typeof returnedValue === 'string') {
            output={edges : [returnedValue]}
           
          }
          else {
            output={edges : ['pass']} 
          } 


        } else if (typeof node === 'object' && node !== null) {
         // console.log('node is an object',node,Object.keys(node)[0],typeof node[Object.keys(node)[0]],Object.values(node[Object.keys(node)[0]]))
          if (Object.keys(node).length > 0 ) {
            if(typeof node[Object.keys(node)[0]] === 'object' && !Array.isArray(node[Object.keys(node)[0]])){
                // call node with params
                returnedValue = scope[Object.keys(node)[0]](node[Object.keys(node)[0]]);
            } else {
              // here i have a structure node (decision or loop)

            }
          }
        }
        steps.push({node, output})
        this.nextStep()

    },
      
     nextStep(){
        if (currentIndex < nodes.length) {
          currentNode = nodes[currentIndex];
          currentIndex++;
          this.evaluateNode(currentNode);

        } 
      }
     }

  }


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
/**
 * Parses a function's name and arguments from its source code
 * @param {string} functionString - The source code of the function to parse
 * @returns {string[]} Array where first element is function name and the rest are argument names
 */
function parseFunctionNameAndArgs(functionString) {
    // Create a regular expression to match function declaration patterns
    // This regex handles both traditional function declarations and arrow functions
    const functionRegex = /(?:function\s+([a-zA-Z_$][\w$]*)\s*\(([^)]*)\)|(?:const|let|var)?\s*([a-zA-Z_$][\w$]*)\s*=\s*(?:function\s*\(([^)]*)\)|(?:\(([^)]*)\)\s*=>)))/;
    
    // Execute the regex on the function string
    const matches = functionString.match(functionRegex);
    
    if (!matches) {
      return null; // Return null if no function declaration pattern was found
    }
    
    // Determine which pattern matched
    let functionName, argsString;
    
    if (matches[1]) {
      // Traditional function declaration: function name(args)
      functionName = matches[1];
      argsString = matches[2];
    } else if (matches[3]) {
      // Arrow function or function expression: const name = function(args) or const name = (args) =>
      functionName = matches[3];
      argsString = matches[4] || matches[5]; // Either from function(args) or (args) =>
    }
    
    // If no function name or args were found, return null
    if (!functionName) {
      return null;
    }
    
    // Process the arguments string to get individual argument names
    const args = argsString ? 
      argsString.split(',')
        .map(arg => arg.trim()) // Trim whitespace
        .filter(arg => arg.length > 0) : // Remove empty strings
      [];
    
    // Return the array with function name as first element followed by argument names
    return [functionName, ...args];
  }

  /**
 * Adds a parseNameAndArgs method to the Function prototype
 * This allows any function to parse its own name and arguments
 */
Function.prototype.parseNameAndArgs = function() {
    // Use toString() to get the function's source code and then parse it
    return parseFunctionNameAndArgs(this.toString());
  };







const scope={
  pi(x,y){
      
      return {
          pass: () => 3.14
      }
  } 
} 


const state= StateManager({
  name:'test flow',
  a: 8,
  b: 5,
  d: {
    x: 111,
    y: 200
  }
});


function suma(a, b) {
    // Determine the key name dynamically based on the values of a and b
    let edge='start'
     edge = (a + b) % 2 === 0 ? 'pass' : 'mult';
    console.log('in functia suma',this,a,b)
    return  {
      pass: () =>{
       
        return  this.set('rezultatSuma',this.get('a')+this.get('b'))
      }
    }
      
 
}

scope['Mesaj Intimpinare']= function greet({mesaj,postfix}){

  console.log('::'+mesaj+' '+postfix)
    return {
        stop: () => {return true}
    }
  }

  function flow ({nodes}){

    
      const flowManager = FlowManager(nodes);
   
     return {
       pass(){
  
        flowManager.nextStep();
        return flowManager.getSteps()
       }
     }
 }

 const flow1 = flow({nodes:[
                     {'Mesaj Intimpinare':{'mesaj':'Salut Narcis','postfix':'!'}},
                    'pi',
                    {'fn':['xzd']}
  ]})
 console.log(flow1.pass()) // 3.14
