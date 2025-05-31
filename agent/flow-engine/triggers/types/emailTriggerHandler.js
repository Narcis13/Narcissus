/**
 * @typedef {import('../../types/flow-types.jsdoc.js').TriggerHandlerCallback} TriggerHandlerCallback
 * @typedef {typeof import('../../core/FlowHub.js').default} FlowHubType
 */

/**
 * Mock Email Trigger Handler.
 * In a real scenario, this would connect to an email service.
 * @type {import('../../types/flow-types.jsdoc.js').TriggerTypeHandler}
 */
const emailTriggerHandler = {
    /**
     * @param {object} triggerConfig - Config for this email trigger (e.g., { account, folder, checkIntervalSeconds }).
     * @param {TriggerHandlerCallback} callback - Function to call when a "new email" is detected.
     * @param {string} triggerId - The ID of the trigger being activated.
     * @param {FlowHubType} flowHub - Instance of FlowHub for emitting events.
     * @returns {Promise<{intervalId: number}>} Returns context for deactivation.
     */
    async activate(triggerConfig, callback, triggerId, flowHub) {
        const { account, folder, checkIntervalSeconds = 20 } = triggerConfig;
        console.log(`[EmailTriggerHandler:${triggerId}] Activating for account '${account}', folder '${folder}'. Checking every ${checkIntervalSeconds}s.`);

        // Mock: Simulate checking for emails periodically
        const intervalId = setInterval(() => {
            // Simulate finding a new email
            const shouldSimulateNewEmail = Math.random() < 0.6; // 10% chance per interval
            if (shouldSimulateNewEmail) {
                const mockEmail = {
                    id: `email-${Date.now()}`,
                    from: "sender@example.com",
                    to: account,
                    subject: `Mock Email Subject ${Math.floor(Math.random() * 100)}`,
                    body: "This is the body of a new mock email.",
                    receivedAt: new Date().toISOString(),
                    folder: folder
                };
                console.log(`[EmailTriggerHandler:${triggerId}] Simulated new email:`, mockEmail.subject);
                flowHub._emitEvent('trigger:handler:event', {
                    triggerId,
                    handlerType: 'email',
                    message: 'Simulated new email detected',
                    emailId: mockEmail.id,
                    timestamp: Date.now()
                });
                callback(mockEmail); // Pass the mock email data to the TriggerManager
            } else {
                // console.debug(`[EmailTriggerHandler:${triggerId}] No new emails (simulated).`);
            }
        }, checkIntervalSeconds * 1000);

        return { intervalId }; // Return intervalId so it can be cleared in deactivate
    },

    /**
     * @param {{intervalId: number}} activationContext - The context returned by activate.
     * @param {object} triggerConfig - The trigger's configuration.
     * @param {string} triggerId - The ID of the trigger being deactivated.
     * @param {FlowHubType} flowHub - Instance of FlowHub.
     * @returns {Promise<void>}
     */
    async deactivate(activationContext, triggerConfig, triggerId, flowHub) {
        if (activationContext && activationContext.intervalId) {
            clearInterval(activationContext.intervalId);
            console.log(`[EmailTriggerHandler:${triggerId}] Deactivated polling for account '${triggerConfig.account}'.`);
            flowHub._emitEvent('trigger:handler:event', {
                triggerId,
                handlerType: 'email',
                message: 'Polling deactivated',
                timestamp: Date.now()
            });
        }
    }
};

export default emailTriggerHandler;