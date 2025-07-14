import { GoogleGenerativeAI } from "@google/generative-ai"
import { geminiClient, GEMINI_CONFIG } from "../../config/gemini"
import { config } from "../../config"
import { logger } from "../../utils/logger"
import { PineconeService } from "./pinecone.service"
import { KnowledgeQuery, KnowledgeResult } from "../../types/ai.types"

export class LangChainService {
    private model: any
    private pineconeService: PineconeService

    constructor() {
        this.model = geminiClient.getGenerativeModel({
            model: GEMINI_CONFIG.model,
            generationConfig: GEMINI_CONFIG.generationConfig,
            safetySettings: GEMINI_CONFIG.safetySettings
        })
        this.pineconeService = new PineconeService()
    }

    async initialize(): Promise<void> {
        try {
            await this.pineconeService.initialize()
            logger.info("Gemini LangChain service initialized")
        } catch (error) {
            logger.error(
                "Failed to initialize Gemini LangChain service:",
                error
            )
            throw error
        }
    }

    async processQuery(query: KnowledgeQuery): Promise<{
        answer: string
        sources: KnowledgeResult[]
        confidence: number
    }> {
        try {
            // Search for relevant knowledge
            const knowledgeResults = await this.pineconeService.searchKnowledge(
                query.query,
                {
                    topK: query.limit || 5,
                    filter: query.category
                        ? { category: query.category }
                        : undefined
                }
            )

            // Filter by threshold
            const relevantKnowledge = knowledgeResults.filter(
                (result) => result.relevanceScore >= (query.threshold || 0.5)
            )

            if (relevantKnowledge.length === 0) {
                return {
                    answer: "I don't have specific information about that topic. Let me transfer you to a human agent.",
                    sources: [],
                    confidence: 0
                }
            }

            // Create context from relevant knowledge
            const context = relevantKnowledge
                .map((result) => `${result.title}: ${result.content}`)
                .join("\n\n")

            // Create prompt for Gemini
            const prompt = `Based on the following context, answer the user's question accurately and helpfully.
If you cannot answer based on the context, say so clearly.

Context:
${context}

Question: ${query.query}

Answer:`

            // Generate response using Gemini
            const result = await this.model.generateContent(prompt)
            const response = await result.response
            const answer = response.text()

            const avgConfidence =
                relevantKnowledge.reduce(
                    (sum, result) => sum + result.relevanceScore,
                    0
                ) / relevantKnowledge.length

            return {
                answer: answer.trim(),
                sources: relevantKnowledge,
                confidence: avgConfidence
            }
        } catch (error) {
            logger.error("Failed to process query:", error)
            throw error
        }
    }

    async generateFollowUpQuestions(context: string): Promise<string[]> {
        try {
            const prompt = `Based on the following conversation context, generate 3 relevant follow-up questions
that a customer service agent might ask to better help the customer.

Context: ${context}

Follow-up questions (one per line):`

            const result = await this.model.generateContent(prompt)
            const response = await result.response
            const text = response.text()

            return text
                .split("\n")
                .filter((line: string) => line.trim().length > 0)
                .map((line: string) => line.replace(/^\d+\.\s*/, "").trim()) // Remove numbering if present
                .slice(0, 3)
        } catch (error) {
            logger.error("Failed to generate follow-up questions:", error)
            return []
        }
    }

    async generateSummary(conversation: string): Promise<string> {
        try {
            const prompt = `Summarize the following conversation in 2-3 sentences, focusing on key points and resolutions:

Conversation:
${conversation}

Summary:`

            const result = await this.model.generateContent(prompt)
            const response = await result.response
            return response.text().trim()
        } catch (error) {
            logger.error("Failed to generate summary:", error)
            return "Summary not available"
        }
    }

    async analyzeIntent(userInput: string): Promise<{
        intent: string
        confidence: number
        entities: Record<string, any>
    }> {
        try {
            const prompt = `Analyze the following user input and determine the intent. Respond in JSON format:

User Input: "${userInput}"

Respond with:
{
    "intent": "detected_intent_name",
    "confidence": 0.95,
    "entities": {
        "entity_name": "entity_value"
    }
}

Common intents: greeting, question, complaint, request_transfer, goodbye, billing_inquiry, technical_support, account_info`

            const result = await this.model.generateContent(prompt)
            const response = await result.response
            const text = response.text()

            try {
                const cleanText = text.replace(/```json\s*|\s*```/g, "").trim()
                const parsed = JSON.parse(cleanText)
                return {
                    intent: parsed.intent || "unknown",
                    confidence: parsed.confidence || 0.7,
                    entities: parsed.entities || {}
                }
            } catch (parseError) {
                logger.error("Failed to parse intent analysis:", parseError)
                return {
                    intent: "unknown",
                    confidence: 0.5,
                    entities: {}
                }
            }
        } catch (error) {
            logger.error("Failed to analyze intent:", error)
            return {
                intent: "unknown",
                confidence: 0.5,
                entities: {}
            }
        }
    }

    async generateResponse(
        userInput: string,
        context: string,
        intent: string
    ): Promise<string> {
        try {
            const prompt = `You are a helpful customer service agent. Generate a natural response based on:

User Input: ${userInput}
Context: ${context}
Detected Intent: ${intent}

Generate a helpful, professional response:`

            const result = await this.model.generateContent(prompt)
            const response = await result.response
            return response.text().trim()
        } catch (error) {
            logger.error("Failed to generate response:", error)
            return "I apologize, but I'm having trouble processing your request. Let me connect you with a human agent."
        }
    }
}
