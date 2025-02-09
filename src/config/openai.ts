import { OpenAI } from "openai"
import { config } from "./index"

export const openaiClient = new OpenAI({
    apiKey: config.openai.apiKey,
    timeout: 30000,
    maxRetries: 3
})

export const OPENAI_CONFIG = {
    model: config.openai.model,
    temperature: 0.7,
    maxTokens: 1000,
    topP: 0.9,
    frequencyPenalty: 0.1,
    presencePenalty: 0.1,
    speechToText: {
        model: "whisper-1",
        language: "en"
    },
    textToSpeech: {
        model: "tts-1",
        voice: "alloy",
        responseFormat: "mp3"
    }
}
