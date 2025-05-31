import FlowHub from './FlowHub.js';
import { FlowManager } from './FlowManager.js'; // Assuming FlowManager is a named export


/**
 * TriggerManager: Manages the registration, activation, and execution of workflows
 * based on external triggers.
 *
 * @param {object} options
 * @param {NodeRegistryType} options.nodeRegistry - The NodeRegistry instance.
 * @returns {object} An API to manage triggers.
 */
export function TriggerManager({ nodeRegistry }) {
    if (!nodeRegistry) {
        throw new Error("[TriggerManager] NodeRegistry instance is required.");
    }

    /** @type {Map<string, TriggerDefinition>} */
    const _triggers = new Map();
    /** @type {Map<string, TriggerTypeHandler>} */
    const _triggerTypeHandlers = new Map();
    /** @type {Map<string, any>} */ // Stores context returned by handler's activate (e.g., interval IDs)
    const _activeListeners = new Map();
    const _nodeRegistryInstance = nodeRegistry; // Store the provided NodeRegistry

    console.log("[TriggerManager] Initialized.");

    /**
     * Handles an event fired by an active trigger.
     * This is an internal helper function.
     * @param {string} triggerId - The ID of the trigger that fired.
     * @param {any} eventData - The data associated with the event.
     */
    async function _handleTriggerEvent(triggerId, eventData) {
        const triggerDef = _triggers.get(triggerId);
        if (!triggerDef) {
            console.error(`[TriggerManager] Received event for unknown triggerId '${triggerId}'.`);
            return;
        }

        console.log(`[TriggerManager] Trigger '${triggerId}' fired. Event data:`, eventData);

        let initialState = {};
        if (typeof triggerDef.initialStateFunction === 'function') {
            try {
                initialState = triggerDef.initialStateFunction(eventData) || {};
            } catch (e) {
                console.error(`[TriggerManager] Error executing initialStateFunction for trigger '${triggerId}':`, e);
                FlowHub._emitEvent('trigger:error', { triggerId, error: e.message, type: 'initialStateFunction', eventData, timestamp: Date.now() });
                // Potentially abort or proceed with empty/default state
            }
        } else {
            initialState = { triggerEvent: eventData }; // Default behavior
        }
        
        const currentScope = _nodeRegistryInstance.getScope(); // Get fresh scope
        const flowInstanceId = `fm-trigger-${triggerId}-${Date.now()}`;

        FlowHub._emitEvent('trigger:fired', {
            triggerId,
            eventData,
            initialStatePrepared: initialState,
            flowInstanceIdToRun: flowInstanceId,
            timestamp: Date.now()
        });
        
        const fm = FlowManager({
            initialState,
            nodes: triggerDef.workflowNodes,
            instanceId: flowInstanceId,
            scope: currentScope
        });

        console.log(`[TriggerManager] Starting workflow for trigger '${triggerId}' with FlowManager ID: ${flowInstanceId}`);
        FlowHub._emitEvent('workflow:startedByTrigger', {
            triggerId,
            flowInstanceId,
            workflowNodes: triggerDef.workflowNodes,
            initialState,
            timestamp: Date.now()
        });

        try {
            const results = await fm.run();
            console.log(`[TriggerManager] Workflow for trigger '${triggerId}' (FM: ${flowInstanceId}) completed. Steps: ${results.length}`);
            FlowHub._emitEvent('workflow:completedByTrigger', {
                triggerId,
                flowInstanceId,
                results,
                finalState: fm.getStateManager().getState(),
                timestamp: Date.now()
            });
        } catch (error) {
            console.error(`[TriggerManager] Workflow for trigger '${triggerId}' (FM: ${flowInstanceId}) failed:`, error);
            FlowHub._emitEvent('workflow:failedByTrigger', {
                triggerId,
                flowInstanceId,
                error: error.message, // Use error.message to avoid complex objects in event
                timestamp: Date.now()
            });
        }
    }

    // Public API
    return {
        /**
         * Adds a handler for a specific trigger type.
         * @param {string} type - The trigger type (e.g., "email").
         * @param {TriggerTypeHandler} handler - The handler object.
         */
        addTriggerTypeHandler(type, handler) {
            if (_triggerTypeHandlers.has(type)) {
                console.warn(`[TriggerManager] Trigger type handler for '${type}' is being replaced.`);
            }
            if (typeof handler.activate !== 'function' || typeof handler.deactivate !== 'function') {
                console.error(`[TriggerManager] Invalid handler for type '${type}'. Must have 'activate' and 'deactivate' methods.`);
                return;
            }
            _triggerTypeHandlers.set(type, handler);
            console.log(`[TriggerManager] Added handler for trigger type: ${type}`);
        },

        /**
         * Registers a trigger definition.
         * @param {TriggerDefinition} triggerDefinition - The trigger definition.
         * @returns {boolean} True if registration was successful.
         */
        register(triggerDefinition) {
            if (!triggerDefinition || !triggerDefinition.triggerId || !triggerDefinition.type || !triggerDefinition.workflowNodes) {
                console.error("[TriggerManager] Invalid trigger definition.", triggerDefinition);
                return false;
            }
            if (!_triggerTypeHandlers.has(triggerDefinition.type)) {
                console.error(`[TriggerManager] No handler registered for trigger type '${triggerDefinition.type}' (for triggerId '${triggerDefinition.triggerId}'). Register a handler first.`);
                return false;
            }
            _triggers.set(triggerDefinition.triggerId, triggerDefinition);
            FlowHub._emitEvent('trigger:registered', {
                triggerId: triggerDefinition.triggerId,
                type: triggerDefinition.type,
                config: triggerDefinition.config,
                timestamp: Date.now()
            });
            console.log(`[TriggerManager] Registered trigger: ${triggerDefinition.triggerId} (type: ${triggerDefinition.type})`);
            return true;
        },

        /**
         * Activates a registered trigger, making it listen for events.
         * @param {string} triggerId - The ID of the trigger to activate.
         * @returns {Promise<boolean>} True if activation was successful.
         */
        async activate(triggerId) {
            if (_activeListeners.has(triggerId)) {
                console.warn(`[TriggerManager] Trigger '${triggerId}' is already active.`);
                return true;
            }
            const triggerDef = _triggers.get(triggerId);
            if (!triggerDef) {
                console.error(`[TriggerManager] Trigger '${triggerId}' not found for activation.`);
                return false;
            }
            const handler = _triggerTypeHandlers.get(triggerDef.type);
            if (!handler) {
                console.error(`[TriggerManager] No handler for trigger type '${triggerDef.type}' (triggerId '${triggerId}').`);
                return false;
            }

            try {
                console.log(`[TriggerManager] Activating trigger: ${triggerId}`);
                const onTriggerFired = async (eventData) => {
                    // Call the internal _handleTriggerEvent
                    await _handleTriggerEvent(triggerId, eventData);
                };

                const activationContext = await handler.activate(triggerDef.config, onTriggerFired, triggerId, FlowHub);
                _activeListeners.set(triggerId, activationContext);
                FlowHub._emitEvent('trigger:activated', { triggerId, timestamp: Date.now() });
                console.log(`[TriggerManager] Activated trigger: ${triggerId}`);
                return true;
            } catch (error) {
                console.error(`[TriggerManager] Error activating trigger '${triggerId}':`, error);
                FlowHub._emitEvent('trigger:error', { triggerId, error: error.message, type: 'activation', timestamp: Date.now() });
                return false;
            }
        },

        /**
         * Deactivates an active trigger.
         * @param {string} triggerId - The ID of the trigger to deactivate.
         * @returns {Promise<boolean>} True if deactivation was successful.
         */
        async deactivate(triggerId) {
            const triggerDef = _triggers.get(triggerId);
            const activationContext = _activeListeners.get(triggerId);

            if (!triggerDef || !_activeListeners.has(triggerId)) {
                console.warn(`[TriggerManager] Trigger '${triggerId}' not found or not active for deactivation.`);
                return false;
            }
            const handler = _triggerTypeHandlers.get(triggerDef.type);
            if (!handler) {
                console.error(`[TriggerManager] No handler for trigger type '${triggerDef.type}' (triggerId '${triggerId}') during deactivation.`);
                return false;
            }

            try {
                console.log(`[TriggerManager] Deactivating trigger: ${triggerId}`);
                await handler.deactivate(activationContext, triggerDef.config, triggerId, FlowHub);
                _activeListeners.delete(triggerId);
                FlowHub._emitEvent('trigger:deactivated', { triggerId, timestamp: Date.now() });
                console.log(`[TriggerManager] Deactivated trigger: ${triggerId}`);
                return true;
            } catch (error) {
                console.error(`[TriggerManager] Error deactivating trigger '${triggerId}':`, error);
                FlowHub._emitEvent('trigger:error', { triggerId, error: error.message, type: 'deactivation', timestamp: Date.now() });
                return false;
            }
        },

        /**
         * Gets a list of all registered trigger definitions.
         * @returns {TriggerDefinition[]}
         */
        getAllTriggers() {
            return Array.from(_triggers.values());
        },

        /**
         * Gets a list of IDs of all active triggers.
         * @returns {string[]}
         */
        getActiveTriggerIds() {
            return Array.from(_activeListeners.keys());
        }
    };
}