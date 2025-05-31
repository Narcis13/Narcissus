
const newUIEventTrigger = {
    triggerId: "ui_event_click",
    type: "event", // Matches the key used in TriggerManager.addTriggerTypeHandler
    description: "Detect UI event and start a flow",
    config: {
       
    },
    workflowNodes: [
 
               { "utils.debug.logMessage": { "message": "A BUTTON WAS CLICKED!!", "level": "info" } }

            
    ],
    initialStateFunction: {

            processedByTrigger: "ui_event_click"
     
    }
};

export default newUIEventTrigger;