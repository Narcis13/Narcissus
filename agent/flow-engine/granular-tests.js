

// --- Imports ---
import { FlowManager } from `./core/FlowManager.js`;
import { NodeRegistry } from `./core/NodeRegistry.js`;
import FlowHub from `./core/FlowHub.js`;
import { TriggerManager } from `./core/TriggerManager.js`;

// Existing Nodes
import analyzeSentimentNode from `./nodes/text/analyze-sentiment.node.js`;
import stringUppercaseNode from `./nodes/text/string-uppercase.node.js`;
import logMessageNode from `./nodes/utils/log-message.node.js`;

// Existing Trigger Handlers
import emailTriggerHandler from `./triggers/types/emailTriggerHandler.js`;
import eventTriggerHandler from `./triggers/types/eventTriggerHandler.js`;

// Existing Trigger Definitions
import newSupportEmailTrigger from `./automations/example.email.trigger.js`;
import newUIEventTrigger from `./automations/example.event.trigger.js`;

// --- Simple Test Runner ---
let testCount = 0;
let passCount = 0;
const testLogs = [];

async function test(name, testFn) {
    testCount++;
    testLogs.push(`\n--- TEST: ${name} ---`);
    console.log(`\n--- TEST: ${name} ---`);
    try {
        await testFn();
        testLogs.push(`✅ PASS: ${name}`);
        console.log(`✅ PASS: ${name}`);
        passCount++;
    } catch (error) {
        testLogs.push(`❌ FAIL: ${name}\n${error.stack}`);
        console.error(`❌ FAIL: ${name}`, error);
    }
}

function _assert(condition, message, actual, expected) {
    const fullMessage = `${message} | Expected: ${JSON.stringify(expected)}, Got: ${JSON.stringify(actual)}`;
    if (!condition) {
        testLogs.push(`    ASSERTION FAILED: ${fullMessage}`);
        console.assert(condition, fullMessage);
        throw new Error(`AssertionError: ${fullMessage}`);
    }
     testLogs.push(`    ASSERTION PASSED: ${message}`);
}

function assertEquals(actual, expected, message) {
    _assert(actual === expected, message, actual, expected);
}

function assertDeepEquals(actual, expected, message) {
    const actualJson = JSON.stringify(actual);
    const expectedJson = JSON.stringify(expected);
    _assert(actualJson === expectedJson, message, actual, expected);
}

function assertTruthy(value, message) {
    _assert(!!value, message, value, true);
}

function assertFalsy(value, message) {
    _assert(!value, message, value, false);
}

// --- Mock Nodes & Handlers for Specific Testing ---
const mockNodeBasic = {
    id: "test.basic", name: "Basic Test Node", description: "A basic node.",
    implementation: async function(params) { this.state.set('basicRan', true); return "basic_done"; }
};
const mockNodeParams = {
    id: "test.params", name: "Params Test Node", description: "Tests params.",
    inputs: [{ name: "data", type: "any"}],
    implementation: async function(params) { this.state.set('paramsReceived', params.data); return { success: () => params.data }; }
};
const mockNodeInput = {
    id: "test.input", name: "Input Test Node", description: "Tests this.input.",
    implementation: async function() { this.state.set('inputReceivedByNode', this.input); return "input_processed"; }
};
const mockNodeSelf = {
    id: "test.self", name: "Self Test Node", description: "Tests this.self.",
    implementation: async function() { this.state.set('selfContext', JSON.parse(JSON.stringify(this.self))); return "self_checked"; }
};
const mockNodeHuman = {
    id: "test.human", name: "Human Input Node", description: "Tests human input.",
    implementation: async function() { const res = await this.humanInput({ prompt: "test prompt" }); return { received: () => res }; }
};
const mockNodeEmit = {
    id: "test.emit", name: "Emit Event Node", description: "Emits an event.",
    implementation: async function() { await this.emit("testCustomNodeEvent", {emitted: true}); return "emitted_event"; }
};
let listenerCallbackData = null;
const mockNodeListen = {
    id: "test.listen", name: "Listen Event Node", description: "Listens for an event.",
    implementation: async function() {
        this.on("testCustomNodeEvent", (data, meta) => {
            listenerCallbackData = { data, meta, nodeId: this.self.id };
            this.state.set("listenerTriggered", true);
        });
        return "listening_setup";
    }
};
const mockLoopControllerNode = {
    id: "test.loopCtrl", name: "Loop Controller", description: "Controls a loop.",
    implementation: async function() {
        let c = this.state.get("loop_counter") || 0; c++; this.state.set("loop_counter", c);
        return c < 3 ? { continue: () => c } : { exit: () => c };
    }
};
const mockLoopActionNode = {
    id: "test.loopAct", name: "Loop Action", description: "Action in a loop.",
    implementation: async function() { this.state.set(`loop_action_run_at_${this.state.get("loop_counter")}`, true); return "action_done"; }
};

const mockScopeFunction = async function(params) {
    this.state.set('mockScopeFunctionCalledWith', params);
    return { fromScope: () => `Scope says: ${params.message}` };
};

const mockTriggerHandler = {
    activate: async (config, callback, triggerId) => {
        mockTriggerHandler._fire = (eventData) => callback(eventData); // Store for manual firing
        return { id: setInterval(() => {/* mock interval */}, 60000), type: 'mock' };
    },
    deactivate: async (context) => {
        if (context && context.id) clearInterval(context.id);
        mockTriggerHandler._fire = null;
    },
    _fire: null
};


// --- Test Execution ---
async function runAllTests() {
    // Initialize NodeRegistry with mock and real nodes
    NodeRegistry.register(mockNodeBasic);
    NodeRegistry.register(mockNodeParams);
    NodeRegistry.register(mockNodeInput);
    NodeRegistry.register(mockNodeSelf);
    NodeRegistry.register(mockNodeHuman);
    NodeRegistry.register(mockNodeEmit);
    NodeRegistry.register(mockNodeListen);
    NodeRegistry.register(mockLoopControllerNode);
    NodeRegistry.register(mockLoopActionNode);
    NodeRegistry.register(analyzeSentimentNode);
    NodeRegistry.register(stringUppercaseNode);
    NodeRegistry.register(logMessageNode);

    const testScope = {
        ...NodeRegistry.getScope(), // Includes all registered nodes
        "myDirectScopeFunc": mockScopeFunction,
        "simpleStringReturner": () => "direct_scope_string"
    };

    // --- NodeRegistry Tests ---
    await test("NodeRegistry: Core Functionality", () => {
        assertTruthy(NodeRegistry.get("test.basic"), "Get registered node");
        const foundNodes = NodeRegistry.find({ text: "sentiment" });
        assertTruthy(foundNodes.some(n => n.id === analyzeSentimentNode.id), "Find node by text");
        const scope = NodeRegistry.getScope();
        assertTruthy(scope[`${analyzeSentimentNode.id}:${analyzeSentimentNode.name}`], "Node in generated scope");
        assertEquals(NodeRegistry.register({ id: "bad" }), false, "Register invalid node fails"); // Lacks impl.
    });

    // --- FlowHub Tests ---
    await test("FlowHub: Pause and Resume", async () => {
        let pauseIdReceived, resumeDataReceived;
        FlowHub.addEventListener('flowPaused', ev => pauseIdReceived = ev.pauseId);
        const pausePromise = FlowHub.requestPause({ details: "test pause", flowInstanceId: "fh-test" });
        await new Promise(r => setTimeout(r, 10)); // Allow event to propagate
        assertTruthy(pauseIdReceived, "flowPaused event received");
        assertTruthy(FlowHub.isPaused(pauseIdReceived), "FlowHub reports as paused");
        assertEquals(FlowHub.getActivePauses().length, 1, "One active pause");
        FlowHub.resume(pauseIdReceived, "test_resume_data");
        resumeDataReceived = await pausePromise;
        assertEquals(resumeDataReceived, "test_resume_data", "Pause resumed with correct data");
        assertFalsy(FlowHub.isPaused(pauseIdReceived), "FlowHub no longer paused");
        assertEquals(FlowHub.getActivePauses().length, 0, "No active pauses");
    });

    await test("FlowHub: Event Bus", () => {
        let received = false;
        const cb = () => received = true;
        FlowHub.addEventListener("customTestEvent", cb);
        FlowHub._emitEvent("customTestEvent", {});
        assertTruthy(received, "Custom event listener fired");
        FlowHub.removeEventListener("customTestEvent", cb);
        received = false;
        FlowHub._emitEvent("customTestEvent", {});
        assertFalsy(received, "Custom event listener not fired after removal");
    });


    // --- FlowManager Tests ---
    await test("FlowManager: StateManager (get, set, undo, redo)", async () => {
        const fm = FlowManager({ initialState: { val: 0 }, nodes: [
            function() { this.state.set("val", 1); },
            function() { this.state.set("val", 2); this.state.set("newVal", "hello"); }
        ]});
        await fm.run();
        const sm = fm.getStateManager();
        assertEquals(sm.get("val"), 2, "State set correctly");
        assertEquals(sm.get("newVal"), "hello", "Multiple state set correctly");
        sm.undo();
        assertEquals(sm.get("val"), 1, "State after first undo");
        assertEquals(sm.get("newVal"), undefined, "NewVal gone after undo (or rather, it is '', because get default to empty string)");
        sm.undo();
        assertEquals(sm.get("val"), 0, "State after second undo (initial)");
        assertFalsy(sm.canUndo(), "Cannot undo further");
        sm.redo();
        assertEquals(sm.get("val"), 1, "State after first redo");
        sm.redo();
        assertEquals(sm.get("val"), 2, "State after second redo");
        assertFalsy(sm.canRedo(), "Cannot redo further");
    });

    await test("FlowManager: Inline Function Node", async () => {
        const fm = FlowManager({ nodes: [async function() { this.state.set("inline", "ok"); return "done"; }], scope: testScope });
        const steps = await fm.run();
        assertEquals(fm.getStateManager().get("inline"), "ok", "Inline function sets state");
        assertEquals(steps[0].output.edges[0], "done", "Inline function returns edge");
    });

    await test("FlowManager: String Identifier Node (from NodeRegistry)", async () => {
        const fm = FlowManager({ nodes: ["test.basic"], scope: testScope });
        await fm.run();
        assertTruthy(fm.getStateManager().get("basicRan"), "String ID node (basic) ran");
    });
    
    await test("FlowManager: String Identifier Node (Direct Scope Function)", async () => {
        const fm = FlowManager({ nodes: ["simpleStringReturner"], scope: testScope });
        const steps = await fm.run();
        assertDeepEquals(steps[0].output.results, ["direct_scope_string"], "Direct scope function result");
    });

    await test("FlowManager: Parameterized Node Call (Registered Node)", async () => {
        const fm = FlowManager({ nodes: [{ "test.params": { data: "param_val" } }], scope: testScope });
        const steps = await fm.run();
        assertEquals(fm.getStateManager().get("paramsReceived"), "param_val", "Parameterized node received params");
        assertEquals(steps[0].output.results[0], "param_val", "Parameterized node output result");
    });

    await test("FlowManager: Parameterized Node Call (Scope Function)", async () => {
        const fm = FlowManager({ nodes: [{ "myDirectScopeFunc": { message: "Hi Scope" } }], scope: testScope });
        const steps = await fm.run();
        assertDeepEquals(fm.getStateManager().get("mockScopeFunctionCalledWith"), { message: "Hi Scope" }, "Scope func received params");
        assertEquals(steps[0].output.results[0], "Scope says: Hi Scope", "Scope func output result");
    });
    
    await test("FlowManager: Branching Construct", async () => {
        const fm = FlowManager({ nodes: [
            () => "go_b", // Emit edge "go_b"
            {
                "go_a": [function() { this.state.set("branch", "A") }],
                "go_b": [function() { this.state.set("branch", "B") }]
            }
        ], scope: testScope });
        await fm.run();
        assertEquals(fm.getStateManager().get("branch"), "B", "Branch 'B' should be taken");
    });

    await test("FlowManager: Sub-flow Node", async () => {
        const fm = FlowManager({ nodes: [
            [
                 function() { this.state.set("sub1", true) },
                { "test.basic": {} } // Call a registered node within subflow
            ]
        ], scope: testScope });
        const steps = await fm.run();
        assertTruthy(fm.getStateManager().get("sub1"), "Sub-flow first node ran");
        assertTruthy(fm.getStateManager().get("basicRan"), "Sub-flow second node (registered) ran");
        assertEquals(steps[0].subSteps.length, 2, "Sub-flow recorded 2 internal steps");
    });

    await test("FlowManager: Loop Construct", async () => {
        const fm = FlowManager({ initialState: { loop_counter: 0 }, nodes: [
            [["test.loopCtrl", "test.loopAct"]] // Loop: Controller, Action
        ], scope: testScope });
        await fm.run();
        assertEquals(fm.getStateManager().get("loop_counter"), 3, "Loop controller ran 3 times");
        assertTruthy(fm.getStateManager().get("loop_action_run_at_1"), "Loop action ran for count 1");
        assertTruthy(fm.getStateManager().get("loop_action_run_at_2"), "Loop action ran for count 2");
        assertFalsy(fm.getStateManager().get("loop_action_run_at_3"), "Loop action did not run for count 3 (exit)");
    });

    await test("FlowManager: `this.input` context", async () => {
        const fm = FlowManager({ nodes: [
            () => ({ "nextEdge": () => "data_for_input" }), // Node 1: output result on edge
            { "nextEdge": ["test.input"] } // Node 2 (test.input) receives Node 1's result via this.input
        ], scope: testScope });
        await fm.run();
        assertEquals(fm.getStateManager().get("inputReceivedByNode"), "data_for_input", "`this.input` correctly passed");
    });

    await test("FlowManager: `this.self` context (parameterized call)", async () => {
        const fm = FlowManager({ nodes: [{ "test.self": { myParam: 123 }}], scope: testScope });
        await fm.run();
        const selfCtx = fm.getStateManager().get("selfContext");
        assertTruthy(selfCtx, "`this.self` captured");
        assertEquals(selfCtx.id, "test.self", "`this.self.id` is correct");
        assertEquals(selfCtx.name, "Self Test Node", "`this.self.name` is correct");
        assertTruthy(selfCtx._isParameterizedCall, "`this.self` indicates parameterized call");
        assertDeepEquals(selfCtx.parametersProvided, { myParam: 123 }, "`this.self` shows provided params");
    });

    await test("FlowManager: `this.humanInput()` (integrates FlowHub)", async () => {
        const fm = FlowManager({ nodes: ["test.human"], scope: testScope, instanceId: "fm-human-test" });
        const runPromise = fm.run(); // Does not await completion yet
        await new Promise(r => setTimeout(r, 20)); // allow pause request to be processed
        const pauses = FlowHub.getActivePauses();
        assertEquals(pauses.length, 1, "One flow instance paused for human input");
        assertEquals(pauses[0].flowInstanceId, "fm-human-test", "Correct flowInstanceId paused");
        FlowHub.resume(pauses[0].pauseId, "human_response_data");
        const steps = await runPromise;
        assertEquals(steps[0].output.results[0], "human_response_data", "Human response received by node");
    });

    await test("FlowManager: `this.emit()` and `this.on()` (integrates FlowHub)", async () => {
        listenerCallbackData = null; // Reset
        const fm = FlowManager({ nodes: ["test.listen", "test.emit"], scope: testScope, instanceId: "fm-emit-listen" });
        await fm.run();
        await new Promise(r => setTimeout(r, 20)); // allow event to propagate
        assertTruthy(listenerCallbackData, "Listener callback was invoked");
        assertTruthy(listenerCallbackData.data.emitted, "Correct event data received");
        assertEquals(listenerCallbackData.nodeId, "test.listen", "Listener node ID in callback data correct");
        assertEquals(listenerCallbackData.meta.emittingNodeMeta.definition.id, "test.emit", "Emitting node ID in meta correct");
        assertTruthy(fm.getStateManager().get("listenerTriggered"), "Listener set state flag");
    });
    
    await test("FlowManager: Node error handling (unresolved node)", async () => {
        const fm = FlowManager({ nodes: ["nonExistentNode"], scope: testScope });
        const steps = await fm.run();
        assertTruthy(steps[0].output.edges.includes("error"), "Unresolved node should output an error edge");
    });

    await test("FlowManager: Node error handling (node throws)", async () => {
        const fm = FlowManager({ nodes: [() => { throw new Error("Intentional node error"); }], scope: testScope });
        let caught = false;
        try {
            await fm.run();
        } catch (e) {
            assertEquals(e.message, "Intentional node error", "Correct error caught from throwing node");
            caught = true;
        }
        assertTruthy(caught, "Error from throwing node should propagate");
    });

    // --- Actual Node Implementation Tests (via FlowManager) ---
    await test("Node: analyze-sentiment (positive, negative, neutral)", async () => {
        const fmPositive = FlowManager({ nodes: [{ "text.analysis.sentiment": { text: "I love this!" } }], scope: testScope });
        let steps = await fmPositive.run();
        assertEquals(steps[0].output.edges[0], "positive", "Positive sentiment");
        assertEquals(fmPositive.getStateManager().get('lastSentimentAnalysis').sentiment, "positive", "State set for positive");

        const fmNegative = FlowManager({ nodes: [{ "text.analysis.sentiment": { text: "I hate this bad thing." } }], scope: testScope });
        steps = await fmNegative.run();
        assertEquals(steps[0].output.edges[0], "negative", "Negative sentiment");

        const fmNeutral = FlowManager({ nodes: [{ "text.analysis.sentiment": { text: "This is a pen." } }], scope: testScope });
        steps = await fmNeutral.run();
        assertEquals(steps[0].output.edges[0], "neutral", "Neutral sentiment");
    });

    await test("Node: string-uppercase", async () => {
        const fm = FlowManager({ nodes: [{ "text.transform.toUpperCase": { inputValue: "test" } }], scope: testScope });
        const steps = await fm.run();
        assertEquals(steps[0].output.results[0], "TEST", "String uppercased correctly");
        assertEquals(fm.getStateManager().get('lastUppercasedString'), "TEST", "State set by uppercase node");
    });

    await test("Node: log-message (check console output manually or mock console)", async () => {
        const originalConsoleLog = console.log;
        let loggedMsg = "";
        console.log = (...args) => { loggedMsg += args.join(" "); }; // Simple mock
        const fm = FlowManager({ nodes: [{ "utils.debug.logMessage": { message: "Hello Logger", level: "info" } }], scope: testScope });
        await fm.run();
        console.log = originalConsoleLog; // Restore
        assertTruthy(loggedMsg.includes("Hello Logger"), "Log message appeared in (mocked) console");
    });

    // --- TriggerManager & Handlers Tests ---
    const tm = TriggerManager({ nodeRegistry: NodeRegistry });

    await test("TriggerManager: Add Handler, Register, Activate, Deactivate Trigger", async () => {
        tm.addTriggerTypeHandler("mockTest", mockTriggerHandler);
        const def = { triggerId: "tm_test_1", type: "mockTest", workflowNodes: ["test.basic"] };
        assertTruthy(tm.register(def), "Trigger registered");
        assertEquals(tm.getAllTriggers().length, 1, "One trigger registered");
        await tm.activate("tm_test_1");
        assertEquals(tm.getActiveTriggerIds()[0], "tm_test_1", "Trigger active");
        await tm.deactivate("tm_test_1");
        assertEquals(tm.getActiveTriggerIds().length, 0, "Trigger deactivated");
    });

    await test("TriggerManager: Workflow Execution via Trigger", async () => {
        // Assumes "mockTest" handler and "tm_test_1" trigger are still set up or re-add them
        tm.addTriggerTypeHandler("mockTest", mockTriggerHandler); // ensure it's there
        const triggerId = "tm_workflow_exec";
        const def = {
            triggerId, type: "mockTest",
            initialStateFunction: (eventData) => ({ triggeredBy: eventData.source }),
            workflowNodes: [{ "test.params": { data: "from_trigger_workflow" } }]
        };
        if (!tm.getAllTriggers().find(t => t.triggerId === triggerId)) tm.register(def);
        
        await tm.activate(triggerId);

        let completionEvent = null;
        FlowHub.addEventListener("workflow:completedByTrigger", (ev) => {
            if (ev.triggerId === triggerId) completionEvent = ev;
        });

        assertTruthy(mockTriggerHandler._fire, "Mock trigger handler _fire method must be available");
        mockTriggerHandler._fire({ source: "manual_fire" }); // Fire the trigger

        await new Promise(r => setTimeout(r, 50)); // Allow async flow to run

        assertTruthy(completionEvent, "workflow:completedByTrigger event received");
        assertEquals(completionEvent.triggerId, triggerId, "Correct trigger ID in event");
        assertEquals(completionEvent.finalState.triggeredBy, "manual_fire", "initialStateFunction worked");
        assertEquals(completionEvent.finalState.paramsReceived, "from_trigger_workflow", "Workflow node executed and set state");
        
        await tm.deactivate(triggerId);
        // Clean up listener if it was test-specific
        FlowHub.removeEventListener("workflow:completedByTrigger", (ev) => {
            if (ev.triggerId === triggerId) completionEvent = ev;
        });
    });

    // --- Existing Automation Tests ---
    await test("Automation: example.email.trigger", async () => {
        tm.addTriggerTypeHandler("email", emailTriggerHandler); // Use actual email handler
        if (!tm.getAllTriggers().find(t => t.triggerId === newSupportEmailTrigger.triggerId)) {
            tm.register(newSupportEmailTrigger);
        }
        
        // Temporarily modify emailTriggerHandler's config for faster, predictable firing
        const originalInterval = newSupportEmailTrigger.config.checkIntervalSeconds;
        newSupportEmailTrigger.config.checkIntervalSeconds = 0.1; // Check every 100ms
        const originalMathRandom = Math.random;
        Math.random = () => 0.01; // Force email simulation (normally < 0.6)

        let emailCompletionEvent = null;
        const emailListener = (ev) => {
            if (ev.triggerId === newSupportEmailTrigger.triggerId) emailCompletionEvent = ev;
        };
        FlowHub.addEventListener("workflow:completedByTrigger", emailListener);

        await tm.activate(newSupportEmailTrigger.triggerId);
        await new Promise(r => setTimeout(r, 300)); // Wait for a couple of intervals

        assertTruthy(emailCompletionEvent, "Email trigger workflow completion event received");
        assertTruthy(emailCompletionEvent.finalState.emailMetadata.subject, "Email metadata in final state");
        assertTruthy(emailCompletionEvent.finalState.processedByTrigger === newSupportEmailTrigger.triggerId, "processedByTrigger set by email trigger");
        // The sentiment node will produce 'positive', 'negative', or 'neutral' edge,
        // and the subsequent log node will use that. Harder to assert console output here without deeper mocking.
        // Check that a sentiment analysis happened:
        assertTruthy(emailCompletionEvent.finalState.lastSentimentAnalysis, "Sentiment analysis state present");

        await tm.deactivate(newSupportEmailTrigger.triggerId);
        FlowHub.removeEventListener("workflow:completedByTrigger", emailListener);
        newSupportEmailTrigger.config.checkIntervalSeconds = originalInterval; // Restore
        Math.random = originalMathRandom; // Restore
    });
    
    await test("Automation: example.event.trigger (and its initialStateFunction as object)", async () => {
        tm.addTriggerTypeHandler("event", eventTriggerHandler);
        if (!tm.getAllTriggers().find(t => t.triggerId === newUIEventTrigger.triggerId)) {
            tm.register(newUIEventTrigger);
        }

        let eventStartEvent = null;
        const uiEventListener = (ev) => {
            if (ev.triggerId === newUIEventTrigger.triggerId) eventStartEvent = ev;
        };
        FlowHub.addEventListener("workflow:startedByTrigger", uiEventListener);

        await tm.activate(newUIEventTrigger.triggerId);
        
        // Manually emit the event the eventTriggerHandler is listening for
        FlowHub._emitEvent("start_the_flow", { clickData: "button_A" });
        await new Promise(r => setTimeout(r, 50));

        assertTruthy(eventStartEvent, "UI Event trigger workflow start event received");
        // Check initialStateFunction behavior: since it's an object, not a function,
        // TriggerManager defaults to { triggerEvent: eventData }.
        assertDeepEquals(eventStartEvent.initialState, { triggerEvent: { clickData: "button_A" } }, "Initial state for UI trigger (object initialStateFunction)");
        
        await tm.deactivate(newUIEventTrigger.triggerId);
        FlowHub.removeEventListener("workflow:startedByTrigger", uiEventListener);
    });


    // --- Summary ---
    console.log(`\n--- ALL TESTS COMPLETE ---`);
    console.log(testLogs.join('\n')); // Print all assertion messages for review
    console.log(`\n${passCount} / ${testCount} tests passed.`);
    if (passCount !== testCount) {
        console.error("🔴 SOME TESTS FAILED!");
        process.exit(1);
    } else {
        console.log("🟢 All tests passed! 🎉");
        process.exit(0);
    }
}

runAllTests().catch(err => {
    console.error("Unhandled error during test execution:", err);
    process.exit(1);
});