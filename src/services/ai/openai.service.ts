import { OpenAI } from "openai"
import { openaiClient, OPENAI_CONFIG } from "../../config/openai"
import { logger } from "../../utils/logger"
import {
    AIResponse,
    TextToSpeechRequest,
    SpeechToTextResult
} from "../../types/ai.types"

export class OpenAIService {
    private client: OpenAI

    constructor() {
        this.client = openaiClient
    }

    async generateResponse(
        prompt: string,
        context: Record<string, any> = {},
        conversationHistory: Array<{ role: string; content: string }> = []
    ): Promise<AIResponse> {
        try {
            const messages = [
                {
                    role: "system",
                    content: `You are an intelligent customer service agent. Be helpful, professional, and concise. 
          Context: ${JSON.stringify(context)}`
                },
                ...conversationHistory,
                { role: "user", content: prompt }
            ]

            const completion = await this.client.chat.completions.create({
                model: OPENAI_CONFIG.model,
                messages: messages as any,
                temperature: OPENAI_CONFIG.temperature,
                max_tokens: OPENAI_CONFIG.maxTokens,
                top_p: OPENAI_CONFIG.topP,
                frequency_penalty: OPENAI_CONFIG.frequencyPenalty,
                presence_penalty: OPENAI_CONFIG.presencePenalty,
                functions: [
                    {
                        name: "analyze_intent",
                        description: "Analyze user intent and extract entities",
                        parameters: {
                            type: "object",
                            properties: {
                                intent: {
                                    type: "string",
                                    description: "The user's intent"
                                },
                                entities: {
                                    type: "object",
                                    description: "Extracted entities"
                                },
                                confidence: {
                                    type: "number",
                                    description: "Confidence score 0-1"
                                },
                                shouldTransfer: {
                                    type: "boolean",
                                    description: "Whether to transfer to human"
                                },
                                nextActions: {
                                    type: "array",
                                    items: { type: "string" }
                                }
                            },
                            required: [
                                "intent",
                                "entities",
                                "confidence",
                                "shouldTransfer"
                            ]
                        }
                    }
                ],
                function_call: { name: "analyze_intent" }
            })

            const choice = completion.choices[0]
            const functionCall = choice!.message?.function_call

            if (functionCall && functionCall.arguments) {
                const analysis = JSON.parse(functionCall.arguments)
                return {
                    message:
                        choice!.message?.content ||
                        "I understand your request.",
                    intent: analysis.intent,
                    entities: analysis.entities,
                    confidence: analysis.confidence,
                    shouldTransfer: analysis.shouldTransfer,
                    nextActions: analysis.nextActions
                }
            }

            return {
                message:
                    choice!.message?.content || "I understand your request.",
                intent: "general_inquiry",
                entities: {},
                confidence: 0.8,
                shouldTransfer: false
            }
        } catch (error) {
            logger.error("OpenAI API error:", error)
            throw new Error("Failed to generate AI response")
        }
    }

    async speechToText(audioBuffer: Buffer): Promise<SpeechToTextResult> {
        try {
            const response = await this.client.audio.transcriptions.create({
                file: audioBuffer as any,
                model: OPENAI_CONFIG.speechToText.model,
                language: OPENAI_CONFIG.speechToText.language,
                response_format: "verbose_json"
            })

            return {
                text: response.text,
                confidence: 0.9, // OpenAI doesn't provide confidence scores
                language: response.language || "en",
                duration: response.duration || 0
            }
        } catch (error) {
            logger.error("Speech to text error:", error)
            throw new Error("Failed to convert speech to text")
        }
    }

    async textToSpeech(request: TextToSpeechRequest): Promise<Buffer> {
        try {
            const response = await this.client.audio.speech.create({
                model: OPENAI_CONFIG.textToSpeech.model,
                voice:
                    (request.voice as any) || OPENAI_CONFIG.textToSpeech.voice,
                input: request.text,
                response_format: OPENAI_CONFIG.textToSpeech
                    .responseFormat as any,
                speed: request.speed || 1.0
            })

            return Buffer.from(await response.arrayBuffer())
        } catch (error) {
            logger.error("Text to speech error:", error)
            throw new Error("Failed to convert text to speech")
        }
    }

    async analyzeCallSentiment(transcript: string): Promise<number> {
        try {
            const completion = await this.client.chat.completions.create({
                model: OPENAI_CONFIG.model,
                messages: [
                    {
                        role: "system",
                        content:
                            "Analyze the sentiment of this call transcript. Return a score from -100 (very negative) to 100 (very positive)."
                    },
                    { role: "user", content: transcript }
                ],
                temperature: 0.1,
                max_tokens: 10
            })

            const message = completion.choices[0]?.message
            const sentimentText =
                message && message.content ? message.content : "0"
            return parseInt(sentimentText) || 0
        } catch (error) {
            logger.error("Sentiment analysis error:", error)
            return 0
        }
    }

    async summarizeCall(transcript: string): Promise<string> {
        try {
            const completion = await this.client.chat.completions.create({
                model: OPENAI_CONFIG.model,
                messages: [
                    {
                        role: "system",
                        content:
                            "Summarize this call transcript in 2-3 sentences. Focus on key issues, resolutions, and next steps."
                    },
                    { role: "user", content: transcript }
                ],
                temperature: 0.3,
                max_tokens: 150
            })

            return (
                completion.choices?.[0]?.message?.content ||
                "Call summary not available"
            )
        } catch (error) {
            logger.error("Call summarization error:", error)
            return "Call summary not available"
        }
    }
}
