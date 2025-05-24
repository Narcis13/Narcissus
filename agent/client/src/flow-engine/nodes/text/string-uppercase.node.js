/** @type {import('../../types/flow-types.jsdoc.js').NodeDefinition} */
export default {
    id: "text.transform.toUpperCase",
    version: "1.0.0",
    name: "Convert to Uppercase",
    description: "Converts a given string to all uppercase letters.",
    categories: ["Text Processing", "Utilities"],
    tags: ["string", "transform", "case"],
    inputs: [
        { name: "inputValue", type: "string", description: "The string to convert.", required: true, example: "hello world" }
    ],
    outputs: [
        { name: "uppercasedValue", type: "string", description: "The input string converted to uppercase." }
    ],
    edges: [
        { name: "success", description: "String successfully converted to uppercase.", outputType: "string" }
    ],
    implementation: async function(params) {
        const result = String(params.inputValue || "").toUpperCase();
        this.state.set('lastUppercasedString', result);
        return { success: () => result };
    },
    aiPromptHints: {
        toolName: "string_to_uppercase",
        summary: "Changes text to all capital letters.",
        useCase: "Use this when you need to standardize text to uppercase, for example, before a comparison or for display purposes.",
        expectedInputFormat: "Provide 'inputValue' as the string.",
        outputDescription: "Returns 'success' edge with the uppercased string. Sets 'lastUppercasedString' in state."
    }
};