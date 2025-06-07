import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { routes } from './routes';
import { initializeTokenStorage } from './lib/token-storage';
import { initializeServerNodeRegistry } from './config/initialize-nodes.server.js';
import { FlowManager } from '../../flow-engine/core/FlowManager.js'; // Assuming your FlowManager is here
import { NodeRegistry } from '../../flow-engine/core/NodeRegistry.js'; // For direct use if needed
    await initializeServerNodeRegistry();

  //  console.log("All registered nodes:", NodeRegistry.getAll().map(n => n.id));

    // Example: Run a simple flow
    console.log("\n--- Running Example Flow ---");
    const scope = NodeRegistry.getScope();
    scope['Test something']= function() {
        console.log("Test something called!");
        return "tested";
    };

    const fm = FlowManager({
        initialState: { myText: "This is great!" },
        nodes: [
          'Test something', // Custom node
            { // Call registered node
              "Sentiment Analyzer": {
                "text": "Uraaaa!",
              }
            },
            { // Branch based on previous output
              "positive": { "utils.debug.logMessage": { "message": "Sentiment was positive!", "level": "info" } },
              "negative": { "utils.debug.logMessage": { "message": "Sentiment was negative!", "level": "warn" } },
              "neutral":  { "utils.debug.logMessage": { "message": "Sentiment was neutral." } }
            }
        ],
        scope
    });

    try {
        const result = await fm.run();     //COMINg SOON!!!!!!
       // console.log("Flow completed. Final state:", fm.getStateManager().getState());
      //   console.log("Flow steps:", result);   
    } catch (e) {
        console.error("Flow execution error:", e);
    }
    console.log("--- Example Flow End ---");

initializeTokenStorage();    
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
console.log(`Server is running on http://localhost:${PORT}`, new Date().toISOString());
export default {
  port: PORT,
  fetch: app.fetch
};