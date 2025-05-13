

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
  function evaluateNode(node){
        let output=null;
        let returnedValue = null;
        if (typeof node === 'function'|| typeof node === 'string') {
          returnedValue = typeof node === 'function' ? node.apply(state, []):scope[node].apply({state,steps}, []);
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
                returnedValue = scope[Object.keys(node)[0]].apply({state,steps},[node[Object.keys(node)[0]]]);
            } else {
              // here i have a structure node (decision or loop)

            }
          }
        }
        steps.push({node, output})
        nextStep()

    }
   function  nextStep(){
        if (currentIndex < nodes.length) {
          currentNode = nodes[currentIndex];
          currentIndex++;
          evaluateNode(currentNode);

        } 
      }
  return {
      getSteps(){
        return steps
      },
      run(){
        nextStep()
      }
    
     }

  }











const scope={
  pi(x,y){
      console.log('THIS in functia pi',this)
      return {
          pass: () => 3.14
      }
  } 
} 




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

  console.log(this,'::'+mesaj+' '+postfix)
    return {
        stop: () => {return true}
    }
  }

  function flow ({nodes}){

    
      const flowManager = FlowManager(nodes);
   
     return {
       pass(){
  
        flowManager.run();
        return flowManager.getSteps()
       }
     }
 }
 const flowManager = FlowManager({initialState:{
      name:'test flow',
      a: 8,
      b: 5,
      d: {
        x: 111,
        y: 200
      }
 }, nodes:[
             {'Mesaj Intimpinare':{'mesaj':'Salut Narcis','postfix':'!'}},
             'pi',
             {'fn':['xzd']}
 ]});

flowManager.run()
console.log(flowManager.getSteps()) // 3.14
//  const flow1 = flow({nodes:[
//                      {'Mesaj Intimpinare':{'mesaj':'Salut Narcis','postfix':'!'}},
//                     'pi',
//                     {'fn':['xzd']}
//   ]})
 //console.log(flow1.pass()) // 3.14
