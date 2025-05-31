
const eventTriggerHandler = {

    async activate(triggerConfig, callback, triggerId, flowHub) {
    
        console.log(`[EVENT TriggerHandler:${triggerId}] Event data ${triggerConfig}`);
               
               flowHub.addEventListener('start_the_flow', (event) => {
                callback(event); // Pass the event data to the TriggerManager
               })


                flowHub._emitEvent('trigger:handler:event', {
                    triggerId,
                    handlerType: 'event',
                    message: 'UI event detected',
                    timestamp: Date.now()
                });
            //    callback(); // Pass the mock email data to the TriggerManager
       return true;
    },


    async deactivate(activationContext, triggerConfig, triggerId, flowHub) {
        if (activationContext ) {

        }
    }
};

export default eventTriggerHandler;