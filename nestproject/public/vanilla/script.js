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


 function wrap(func,...args){
     return function(){
          return func(...args)
     }
 }

 function flow (nodes){
     
     return function(state){
          return {}
     }
 }

function pi(x,y){
   // console.log('this in pi',pi, typeof pi)
    
    return {
        //here i might post to shared state
        pass: () => 3.14
    }
} 

const state = {
    a: 1,
    b: 2,
    c: 3
}
function suma(a, b) {
    // Determine the key name dynamically based on the values of a and b
    let edge='start'
     edge = (a + b) % 2 === 0 ? 'pass' : 'mult';

    return {
        //here i might post to shared state
        [(a + b) % 2 === 0 ? 'pass' : 'mult']: () => a + b
    };
}

 console.log( wrap(suma,1,2)().mult() ) // 3
 console.log(pi().pass()) // 3.14
 console.log(pi.parseNameAndArgs()) // function pi(x,y){...}