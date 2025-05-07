
//totul graviteaza in jurul conceputlui de functie

/**
 * 
 */
function State(initialState) {
    return {
        state: initialState,
        setState(newState) {
            this.state = newState;
        },
        getState() {
            return this.state;
        },
        reset() {
            this.state = initialState;
        }                       
    }
}

function Node(description='',adress='', func) {
    
   return func
}

function flow (nodes){
    
    return function(state){
         return {}
    }
}