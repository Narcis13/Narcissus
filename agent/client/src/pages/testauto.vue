<template>
    <div>
        <h5>Automations Test Page</h5>
        <p>This page is used to test the automation flows in the system.</p>
        <q-btn @click="deactivateTrigger" color="secondary" label="Deactivate Trigger"></q-btn>
        <q-btn @click="runAgent" color="primary" label="Run Automation Example Flow"></q-btn>
    </div>
</template>
<script setup>
import { onMounted } from 'vue';
import { NodeRegistry } from '../../../flow-engine/core/NodeRegistry'; 
import { TriggerManager } from '../../../flow-engine/core/TriggerManager.js';
import  FlowHub  from '../../../flow-engine/core/FlowHub.js';
//import { FlowManager } from '../../../flow-engine/core/FlowManager';
import emailTriggerHandler from '../../../flow-engine/triggers/types/emailTriggerHandler.js';
import eventTriggerHandler from '../../../flow-engine/triggers/types/eventTriggerHandler.js';
import newSupportEmailTrigger from '../../../flow-engine/automations/example.email.trigger.js';
import newUIEventTrigger from '../../../flow-engine/automations/example.event.trigger.js';

    const triggerManager = TriggerManager({ nodeRegistry: NodeRegistry });

    triggerManager.addTriggerTypeHandler("email", emailTriggerHandler);
    triggerManager.addTriggerTypeHandler("event", eventTriggerHandler); // Reusing email handler for webhook example

    triggerManager.register(newSupportEmailTrigger);
    triggerManager.register(newUIEventTrigger);

    // Registering the triggers with FlowHub
    //FlowHub.registerTrigger(newSupportEmailTrigger);
    //FlowHub.registerTrigger(newUIEventTrigger);

    // Optional: Add event listeners for debugging purposes
/*
    FlowHub.addEventListener('trigger:fired', (data) => {
        console.log('HUB Event - Trigger Fired:', data.triggerId, 'Flow to run:', data.flowInstanceIdToRun);
    });
    FlowHub.addEventListener('workflow:startedByTrigger', (data) => {
        console.log('HUB Event - Workflow Started by Trigger:', data.triggerId, 'Flow ID:', data.flowInstanceId);
    });
    FlowHub.addEventListener('workflow:completedByTrigger', (data) => {
        console.log('HUB Event - Workflow Completed by Trigger:', data.triggerId, 'Flow ID:', data.flowInstanceId, 'Steps:', data.results.length);
    });
    FlowHub.addEventListener('flowManagerStep', (data) => { // Existing event, useful for triggered flows too
        // console.log(`HUB Event - Flow Step: [${data.flowInstanceId}] Step ${data.stepIndex}`, data.stepData.node);
    });
*/
async function deactivateTrigger() {
    console.log("\n--- Deactivating Trigger ---");
    await triggerManager.deactivate(newSupportEmailTrigger.triggerId);
    console.log(`Trigger '${newSupportEmailTrigger.triggerId}' is now deactivated.`);
}

async function runAgent() {
    console.log("\n--- Running Automation Example Flow ---");
FlowHub._emitEvent('start_the_flow',{type_of_ui_interaction:'click_button'})

    console.log("--- Automations Example Flow End ---");
}
async function initializeAgent() {

    await triggerManager.activate(newSupportEmailTrigger.triggerId);
    await triggerManager.activate(newUIEventTrigger.triggerId);
    console.log(`Trigger '${newSupportEmailTrigger.triggerId}' is now active.`);

}

onMounted(async () => {
    console.log("\n--- Running Automation Example Flow ---");

    initializeAgent().catch(console.error);  

    console.log("---Automations Example Flow End ---");
});
</script>