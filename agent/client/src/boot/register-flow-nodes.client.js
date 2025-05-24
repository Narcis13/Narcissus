// src/boot/register-flow-nodes.client.js
//import { boot } from 'quasar/wrappers'; // If using Quasar
import { defineBoot } from '#q-app/wrappers'
import { NodeRegistry } from 'src/flow-engine/core/NodeRegistry';

// Vite's import.meta.glob for dynamic imports
// It finds all .node.js files recursively under src/flow-engine/nodes/
// Using `eager: true` bundles them directly. For larger sets, consider non-eager and async loading.
const nodeModules = import.meta.glob('../flow-engine/nodes/**/*.node.js', { eager: true });

async function initializeClientNodeRegistry() {
    console.log('[NodeRegistryLoader-Client] Scanning for node modules...');
    let registeredCount = 0;

    for (const path in nodeModules) {
        try {
            const module = nodeModules[path]; // Module is already loaded due to eager: true

            if (module.default) {
                const nodeDefinition = module.default;

                if (!nodeDefinition.id) {
                    let generatedId = path
                        .replace('../flow-engine/nodes/', '')
                        .replace('.node.js', '')
                        .replace(/\//g, '.');
                    console.warn(`[NodeRegistryLoader-Client] Node from ${path} missing 'id'. Generating as '${generatedId}'. Consider adding an explicit id for stability.`);
                    nodeDefinition.id = generatedId;
                }
                nodeDefinition._sourcePath = path; // Store for debugging
                NodeRegistry.register(nodeDefinition);
                registeredCount++;
            } else {
                console.warn(`[NodeRegistryLoader-Client] No default export found in ${path}. Skipping.`);
            }
        } catch (error) {
            console.error(`[NodeRegistryLoader-Client] Error processing node from ${path}:`, error);
        }
    }
    console.log(`[NodeRegistryLoader-Client] Node registration complete. ${registeredCount} nodes registered. Total in registry: ${NodeRegistry.getAll().length}`);
}

// For Quasar:
const bootFunction = async ({ app, router, store }) => {
  console.log('[Boot] Initializing Client Node Registry...');
  await initializeClientNodeRegistry(); // await if non-eager glob is used
  // Optional: Make NodeRegistry available globally or via provide/inject
  // app.config.globalProperties.$nodeRegistry = NodeRegistry;
  console.log('[Boot] Client Node Registry initialized.');
};

export default defineBoot(bootFunction);



// For plain Vite, you'd call initializeClientNodeRegistry() early in your main.js
// (async () => {
//     await initializeClientNodeRegistry();
//     // ... rest of your app initialization
// })();