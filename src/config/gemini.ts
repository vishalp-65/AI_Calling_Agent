import {
    GoogleGenerativeAI,
    HarmCategory,
    HarmBlockThreshold
} from "@google/generative-ai"
import { config } from "./index"

export const geminiClient = new GoogleGenerativeAI(config.gemini.apiKey)

export const GEMINI_CONFIG = {
    model: config.gemini.model,
    temperature: 0.7,
    maxOutputTokens: 1000,
    topP: 0.9,
    topK: 40,
    generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        topK: 40,
        maxOutputTokens: 1000,
        responseMimeType: "text/plain"
    },
    safetySettings: [
        {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
        },
        {
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
        },
        {
            category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
        },
        {
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
        }
    ]
}

// You'll need to add this to your main config file
export const geminiConfig = {
    apiKey: process.env.GEMINI_API_KEY || ""
}
