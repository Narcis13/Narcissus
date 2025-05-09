console.log("hello world");
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


  function getState(path) {
    if (!state || !path) return '';
    
    const keys = path.split('.');
    let result = state;
    
    for (const key of keys) {
      if (result === undefined || result === null || !Object.prototype.hasOwnProperty.call(result, key)) {
        return '';
      }
      result = result[key];
    }
    
    return result !== undefined && result !== null ? result : '';
  }

  function setState(path, value) {
    if (!state || !path) return value;
    
    const keys = path.split('.');
    let current = state;
    
    // Navigate through the object, creating keys as needed
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      // Create the property if it doesn't exist
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }
    
    // Set the final value
    const lastKey = keys[keys.length - 1];
    current[lastKey] = value;
    
    return value;
  }

 function wrap(func,...args){
     return function(){
          return func(...args)
     }
 }



/**
 * Wraps a function to automatically inject parameters from state
 * @param {Function} fn - The function to wrap
 * @param {string[]} paramNames - Names of parameters to inject from state
 * @returns {Function} Wrapped function that gets parameters from state
 */
function withState(fn, paramNames) {
    return function(...args) {
        // Get the parameter names the function expects
        const params = paramNames.reduce((params, name) => {
            if (name in state) {
                params[name] = getState(name);
            }
            return params;
        }, {}); 
        
        // Call the original function with state parameters and any additional arguments
        return fn(params, ...args);
    };
}



function pi(x,y){
   // console.log('this in pi',pi, typeof pi)
    
    return {
        //here i might post to shared state
        pass: () => 3.14
    }
} 

const state = {
    a: 5,
    b: 2,
    c: 3,
    d:{x:13},
    mesaj: 'hello world',
    postfix:'!'
}
function suma(a, b) {
    // Determine the key name dynamically based on the values of a and b
    let edge='start'
     edge = (a + b) % 2 === 0 ? 'pass' : 'mult';

    return {
        //here i might post to shared state
       // [(a + b) % 2 === 0 ? 'pass' : 'mult']: () => setState('rezultatSuma',a+b)
       pass: () =>{return  setState('rezultatSuma',getState('a')+getState('b'))}
    }
}

async function greet({mesaj,postfix}={mesaj: 'hello default world'}){

  console.log('Rezultat: '+getState('rezultatSuma'))
    return {
        stop: () => {}
    }
  }
console.log(suma().pass()) // 7
 //console.log( wrap(suma,1,2)().mult() ) // 3
 //console.log(pi().pass()) // 3.14
 //console.log(pi.parseNameAndArgs()) // function pi(x,y){...}
 //greet(state) // {pass: ƒ}
 //wrap(greet,{mesaj:'Salut',postfix:' coaie!'})() // {pass: ƒ}
 //console.log(getState('d.x')) // 1

 //setState('d.x', 100);
 //console.log(state,getState('d.x')) // 100

 //setState('user.profile.name', 'John');
 //console.log(state); 

 function combineValues({ a, b }, multiplier) {
    return (a + b) * multiplier;
}



// Call with an additional argument
console.log("Result with additional argument:", withState(combineValues, ['a', 'b'])(4)); // (1 + 2) * 3

  function flow (nodes){
      let steps=[]
      let currentEdge = 'start'
     return {
       pass(context={timestamp: Date.now()}){
        //  let result = null;
        //  for (const node of nodes) {
        //    if (typeof node === 'function') {
        //      result = node(result);
        //    } else if (typeof node === 'object' && node !== null) {
        //      const { pass, mult } = node;
        //      if (pass) {
        //        result = pass();
        //      } else if (mult) {
        //        result = mult();
        //      }
        //    }
        //  }
        //  return result;

        console.log('context',context,currentEdge)
       }
     }
 }

 const flow1 = flow([suma, pi, greet]);
 console.log(flow1.pass()) // 3.14