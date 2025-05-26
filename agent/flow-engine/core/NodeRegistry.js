// src/flow-engine/core/NodeRegistry.js

const _nodes = new Map(); // Key: nodeId (string), Value: NodeDefinition

export const NodeRegistry = {
    /**
     * Registers a node definition.
     * @param {import('../types/flow-types.jsdoc.js').NodeDefinition} nodeDefinition - The node definition object.
     * @returns {boolean} True if registration was successful, false otherwise.
     */
    register(nodeDefinition) {
        if (!nodeDefinition || !nodeDefinition.id || typeof nodeDefinition.implementation !== 'function' || !nodeDefinition.description) {
            console.error("[NodeRegistry] Invalid node definition: Requires id, implementation, and description.", nodeDefinition);
            return false;
        }
        if (_nodes.has(nodeDefinition.id)) {
            console.warn(`[NodeRegistry] Node with id '${nodeDefinition.id}' (from ${nodeDefinition._sourcePath || 'unknown'}) is being re-registered. Overwriting previous (from ${_nodes.get(nodeDefinition.id)?._sourcePath || 'unknown'}).`);
        }
        _nodes.set(nodeDefinition.id, nodeDefinition);
        return true;
    },

    /**
     * Retrieves a node definition by its ID.
     * @param {string} nodeId - The ID of the node to retrieve.
     * @returns {import('../types/flow-types.jsdoc.js').NodeDefinition | undefined} The node definition or undefined if not found.
     */
    get(nodeId) {
        return _nodes.get(nodeId);
    },

    /**
     * Finds nodes based on specified criteria.
     * AI agents will heavily use this for tool discovery.
     * @param {object} criteria - The search criteria.
     * @param {string} [criteria.text] - Free-text search across name, description, tags, AI hints.
     * @param {string[]} [criteria.categories] - An array of categories to match (AND logic).
     * @param {string[]} [criteria.tags] - An array of tags to match (AND logic).
     * @param {string} [criteria.inputNeeds] - A description of an input the agent has/needs to provide.
     * @param {string} [criteria.outputProvides] - A description of an output the agent is looking for.
     * @returns {import('../types/flow-types.jsdoc.js').NodeDefinition[]} An array of matching node definitions.
     */
    find({ text, categories, tags, inputNeeds, outputProvides }) {
        let results = Array.from(_nodes.values());

        if (text) {
            const lowerText = text.toLowerCase();
            results = results.filter(node =>
                (node.name && node.name.toLowerCase().includes(lowerText)) || // Added check for node.name existence
                node.description.toLowerCase().includes(lowerText) ||
                (node.tags && node.tags.some(tag => tag.toLowerCase().includes(lowerText))) ||
                (node.aiPromptHints && (
                    (node.aiPromptHints.summary && node.aiPromptHints.summary.toLowerCase().includes(lowerText)) ||
                    (node.aiPromptHints.useCase && node.aiPromptHints.useCase.toLowerCase().includes(lowerText)) ||
                    (node.aiPromptHints.toolName && node.aiPromptHints.toolName.toLowerCase().includes(lowerText))
                ))
            );
        }
        if (categories && categories.length) {
            results = results.filter(node => node.categories && categories.every(cat => node.categories.includes(cat)));
        }
        if (tags && tags.length) {
            results = results.filter(node => node.tags && tags.every(tag => node.tags.includes(tag)));
        }

        // Basic conceptual search for input/output needs (can be made more sophisticated with NLP/embeddings)
        if (inputNeeds) {
            const lowerInputNeeds = inputNeeds.toLowerCase();
            results = results.filter(node =>
                node.inputs && node.inputs.some(input => input.description.toLowerCase().includes(lowerInputNeeds))
            );
        }
        if (outputProvides) {
            const lowerOutputProvides = outputProvides.toLowerCase();
            results = results.filter(node =>
                (node.outputs && node.outputs.some(output => output.description.toLowerCase().includes(lowerOutputProvides))) ||
                (node.edges && node.edges.some(edge => edge.description.toLowerCase().includes(lowerOutputProvides)))
            );
        }
        return results;
    },

    /**
     * Retrieves all registered node definitions.
     * @returns {import('../types/flow-types.jsdoc.js').NodeDefinition[]} An array of all node definitions.
     */
    getAll() {
        return Array.from(_nodes.values());
    },

    /**
     * Retrieves a scope object containing full node definitions, keyed by "id:name".
     * The keys are in the format "node.id:node.name" (e.g., "text.transform.toUpperCase:Convert to Uppercase").
     * The values are the full node definition objects.
     * This scope can be augmented and then used by FlowManager (e.g., by assigning to globalThis.scope)
     * to execute nodes.
     * @returns {Object.<string, import('../types/flow-types.jsdoc.js').NodeDefinition>} 
     *          An object mapping "id:name" strings to their full node definitions.
     *          User-added functions will be directly functions, not NodeDefinition objects.
     */
    getScope() {
        const scopeObject = {};
        for (const [nodeId, nodeDefinition] of _nodes) {
            // Ensure essential properties for forming the key and for the definition to be useful
            if (nodeDefinition && nodeDefinition.id && nodeDefinition.name && typeof nodeDefinition.implementation === 'function') {
                const qualifiedKey = `${nodeDefinition.id}:${nodeDefinition.name}`;
                scopeObject[qualifiedKey] = nodeDefinition; // Store the whole definition
            } else {
                console.warn(`[NodeRegistry.getScope] Skipping node due to missing id, name, or implementation:`, nodeDefinition.id || nodeDefinition);
            }
        }
        return scopeObject;
    }
};