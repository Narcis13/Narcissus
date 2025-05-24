/** @type {import('../../types/flow-types.jsdoc.js').NodeDefinition} */
export default {
    id: "utils.debug.logMessage",
    version: "1.0.0",
    name: "Log Message",
    description: "Logs a message to the console. Useful for debugging workflows.",
    categories: ["Utilities", "Debugging"],
    tags: ["log", "print", "debug"],
    inputs: [
        { name: "message", type: "any", description: "The message or data to log.", required: true, example: "Current step completed." },
        { name: "level", type: "string", description: "Log level (e.g., 'info', 'warn', 'error', 'debug').", defaultValue: "info", enum: ["info", "warn", "error", "debug"], example: "info" }
    ],
    edges: [
        { name: "pass", description: "Message logged successfully." }
    ],
    implementation: async function(params) {
        const level = params.level || "info";
        const message = params.message;
        const flowInstanceId = this.flowInstanceId || 'N/A'; // Assuming flowInstanceId is added to 'this' context

        switch(level) {
            case "warn": console.warn(`[FlowLog FW:${flowInstanceId}]:`, message); break;
            case "error": console.error(`[FlowLog FW:${flowInstanceId}]:`, message); break;
            case "debug": console.debug(`[FlowLog FW:${flowInstanceId}]:`, message); break;
            default: console.log(`[FlowLog FW:${flowInstanceId}]:`, message);
        }
        return "pass"; // Simple string return implies { edges: ["pass"] }
    },
    aiPromptHints: {
        toolName: "log_message_to_console",
        summary: "Prints a message to the system console.",
        useCase: "Use this for debugging or to output informational messages during flow execution. It does not affect the flow's state or primary output.",
        expectedInputFormat: "Provide 'message' with the content to log. 'level' is optional (info, warn, error, debug).",
        outputDescription: "Returns a 'pass' edge. The message is printed to the console."
    }
};