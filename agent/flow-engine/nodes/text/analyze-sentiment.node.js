/** @type {import('../../types/flow-types.jsdoc.js').NodeDefinition} */
export default {
    id: "text.analysis.sentiment",
    version: "1.0.0",
    name: "Sentiment Analyzer",
    description: "Analyzes the sentiment of a given text string and determines if it's positive, negative, or neutral. Useful for understanding user feedback or social media comments.",
    categories: ["Text Processing", "AI", "NLP"],
    tags: ["sentiment", "text analysis", "nlp"],
    inputs: [
        {
            name: "text",
            type: "string",
            description: "The text content to analyze for sentiment.",
            required: true,
            example: "I love this product, it's amazing!"
        },
        {
            name: "language",
            type: "string",
            description: "The language of the text (e.g., 'en', 'es'). Default is 'en'.",
            required: false,
            defaultValue: "en",
            example: "en"
        }
    ],
    outputs: [
        { name: "analyzedSentiment", type: "string", description: "The detected sentiment: 'positive', 'negative', or 'neutral'."},
        { name: "sentimentConfidence", type: "number", description: "A confidence score (0-1) for the detected sentiment, if available from the underlying engine."}
    ],
    edges: [
        { name: "positive", description: "The text has a positive sentiment." },
        { name: "negative", description: "The text has a negative sentiment." },
        { name: "neutral", description: "The text has a neutral sentiment." },
        { name: "error", description: "An error occurred during sentiment analysis." }
    ],
    implementation: async function(params) {
        // 'this' provides: this.state, this.humanInput, this.emit, this.on
        // In a real scenario, this would call an NLP library or API
        console.log("Analyzing sentiment for text:", params.text,this.self,this.input);
        const text = String(params.text || "").toLowerCase();
        if (text.includes("error")) return { error: () => "Simulated analysis error." };

        let sentiment = "neutral";
        if (text.includes("love") || text.includes("amazing") || text.includes("great")) sentiment = "positive";
        else if (text.includes("hate") || text.includes("terrible") || text.includes("bad")) sentiment = "negative";

        this.state.set('lastSentimentAnalysis', { text: params.text, sentiment: sentiment, confidence: 0.9 });
        return { [sentiment]: () => sentiment }; // Dynamically use edge name
    },
    aiPromptHints: {
        toolName: "sentiment_analyzer",
        summary: "Detects if text is positive, negative, or neutral.",
        useCase: "Use this tool when you need to understand the emotional tone of a piece of text. For example, to analyze customer reviews or social media posts.",
        expectedInputFormat: "Provide the 'text' input as the string to analyze. 'language' is optional, defaults to 'en'.",
        outputDescription: "Returns an edge named 'positive', 'negative', or 'neutral' indicating the sentiment. Sets 'lastSentimentAnalysis' in state."
    }
};