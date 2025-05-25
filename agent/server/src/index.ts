import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { routes } from './routes';

import { initializeServerNodeRegistry } from './config/initialize-nodes.server.js';
import { FlowManager } from '../../flow-engine/core/FlowManager.js'; // Assuming your FlowManager is here
import { NodeRegistry } from '../../flow-engine/core/NodeRegistry.js'; // For direct use if needed
    await initializeServerNodeRegistry();

    console.log("All registered nodes:", NodeRegistry.getAll().map(n => n.id));

    // Example: Run a simple flow
    console.log("\n--- Running Example Flow ---");
    const fm = FlowManager({
        initialState: { myText: "This is great!" },
        nodes: [
            { // Call registered node
              "text.analysis.sentiment": {
                "text": "$.state.myText"
              }
            },
            { // Branch based on previous output
              "positive": { "utils.debug.logMessage": { "message": "Sentiment was positive!", "level": "info" } },
              "negative": { "utils.debug.logMessage": { "message": "Sentiment was negative!", "level": "warn" } },
              "neutral":  { "utils.debug.logMessage": { "message": "Sentiment was neutral." } }
            }
        ]
    });

    try {
       // const result = await fm.run();     //COMINg SOON!!!!!!
        console.log("Flow completed. Final state:", fm.getStateManager().getState());
        // console.log("Flow steps:", result);   
    } catch (e) {
        console.error("Flow execution error:", e);
    }
    console.log("--- Example Flow End ---");

// Create main Hono app
const app = new Hono();

// Apply global middleware
app.use(logger());
app.use(prettyJSON());

// Register all routes
app.route('', routes);

// Root endpoint
app.get('/', (c) => {
  return c.json({
    message: 'API is running',
    version: '1.0.0'
  });
});

// Start server
const PORT = process.env.PORT ? Number(process.env.PORT) : 3013;
console.log(`Server is running on http://localhost:${PORT}`);
export default {
  port: PORT,
  fetch: app.fetch
};