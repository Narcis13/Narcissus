<template>
    <div>
        <h1>Test Page</h1>
        <p>This is a test page to verify the Vue.js setup.</p>
    </div>
</template>
<script setup>
import { onMounted } from 'vue';
import { NodeRegistry } from '../../../flow-engine/core/NodeRegistry'; 
import { FlowManager } from '../../../flow-engine/core/FlowManager';

onMounted(async () => {
    console.log("\n--- Running Example Flow ---");
    const scope = NodeRegistry.getScope();
    scope['Test something'] = function() {
        console.log("Test something called!");
        return "tested";
    };

    const fm = FlowManager({
        initialState: { myText: "This is great!" },
        nodes: [
            'Test something',
            {
                "Sentiment Analyzer": {
                    "text": "Uraaaa!",
                }
            },
            {
                "positive": { "utils.debug.logMessage": { "message": "Sentiment was positive!", "level": "info" } },
                "negative": { "utils.debug.logMessage": { "message": "Sentiment was negative!", "level": "warn" } },
                "neutral":  { "utils.debug.logMessage": { "message": "Sentiment was neutral." } }
            }
        ],
        scope
    });

    try {
        const result = await fm.run();
        console.log("Flow completed. Final state:", fm.getStateManager().getState());
        // console.log("Flow steps:", result);   
    } catch (e) {
        console.error("Flow execution error:", e);
    }
    console.log("--- Example Flow End ---");
});
</script>