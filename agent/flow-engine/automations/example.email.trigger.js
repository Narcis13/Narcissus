/** @type {import('../types/flow-types.jsdoc.js').TriggerDefinition} */
const newSupportEmailTrigger = {
    triggerId: "support_new_email_auto_log",
    type: "email", // Matches the key used in TriggerManager.addTriggerTypeHandler
    description: "Logs new emails received in the support inbox and analyzes sentiment.",
    config: {
        account: "support@yourcompany.com",
        folder: "Inbox",
        checkIntervalSeconds: 30 // Check every 30 seconds (for this mock)
    },
    workflowNodes: [
      {
                "Sentiment Analyzer": {
                    "text": "This is great!",
                }
            },
            {
                "positive": { "utils.debug.logMessage": { "message": "Sentiment was positive!", "level": "info" } },
                "negative": { "utils.debug.logMessage": { "message": "Sentiment was negative!", "level": "warn" } },
                "neutral":  { "utils.debug.logMessage": { "message": "Sentiment was neutral." } }
            }
    ],
    initialStateFunction: (eventData) => {
        // Custom function to structure the initial state
        return {
            triggerEvent: { // Keep the raw event data
                ...eventData
            },
            emailMetadata: {
                id: eventData.id,
                subject: eventData.subject,
                sender: eventData.from,
                receivedTimestamp: eventData.receivedAt
            },
            processedByTrigger: "support_new_email_auto_log"
        };
    }
};

export default newSupportEmailTrigger;