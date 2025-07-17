import { GoogleGenerativeAI } from "@google/generative-ai"
import { logger } from "../../utils/logger"
import {
    AIResponse,
    TextToSpeechRequest,
    SpeechToTextResult
} from "../../types/ai.types"
import {
    ConversationContext,
    NaturalAIResponse
} from "../../types/conversation.types"
import { GEMINI_CONFIG, geminiClient } from "../../config/gemini"

export class GeminiService {
    private client: GoogleGenerativeAI
    private model: any

    constructor() {
        this.client = geminiClient
        this.model = this.client.getGenerativeModel({
            model: GEMINI_CONFIG.model,
            generationConfig: GEMINI_CONFIG.generationConfig,
            safetySettings: GEMINI_CONFIG.safetySettings
        })
    }

    async generateNaturalResponse(
        context: ConversationContext
    ): Promise<NaturalAIResponse> {
        try {
            // Build system prompt with user knowledge context
            const systemPrompt = this.buildSystemPrompt(context.currentLanguage)
            // const userContext = this.buildUserContext(context)
            const conversationHistory = this.buildConversationMessages(context)

            // Create optimized prompt for faster response
            const fullPrompt = `${systemPrompt}


CONVERSATION HISTORY:
${conversationHistory}

USER INPUT: ${context.userInput}
CONFIDENCE: ${context.confidence}
LANGUAGE: ${context.currentLanguage}

Respond in JSON format:
{
    "response": "your natural response here",
    "intent": "detected intent",
    "entities": {},
    "confidence": 0.9,
    "shouldTransfer": false,
    "shouldEndCall": false,
    "nextActions": ["array of next actions"],
    "emotionalTone": "friendly/helpful/empathetic/etc",
    "detectedLanguage": "${context.currentLanguage}"
}

Respond ONLY with valid JSON, no other text.`

            // Use optimized generation config for faster response
            const optimizedModel = this.client.getGenerativeModel({
                model: GEMINI_CONFIG.model,
                generationConfig: {
                    temperature: 0.7, // Slightly less creative for faster response
                    topK: 20, // Reduced for faster generation
                    topP: 0.8,
                    maxOutputTokens: 300, // Reduced for phone calls
                    responseMimeType: "text/plain"
                }
            })

            const result = await optimizedModel.generateContent(fullPrompt)
            const response = await result.response
            const text = response.text()

            // Parse the JSON response
            const parsedResponse = this.parseJsonResponse(text)

            return {
                message: parsedResponse.response,
                intent: parsedResponse.intent,
                entities: parsedResponse.entities || {},
                confidence: parsedResponse.confidence || 0.9,
                shouldTransfer: parsedResponse.shouldTransfer || false,
                shouldEndCall: parsedResponse.shouldEndCall || false,
                nextActions: parsedResponse.nextActions || [],
                emotionalTone: parsedResponse.emotionalTone || "friendly",
                detectedLanguage:
                    parsedResponse.detectedLanguage || context.currentLanguage
            }
        } catch (error) {
            logger.error("Gemini natural response generation error:", error)
            return this.generateFallbackResponse(context.currentLanguage)
        }
    }

    private parseJsonResponse(text: string): any {
        try {
            // Clean the response text to extract JSON
            const cleanText = text.replace(/```json\s*|\s*```/g, "").trim()
            return JSON.parse(cleanText)
        } catch (error) {
            logger.error("Failed to parse JSON response:", error)
            // Return a basic fallback structure
            return {
                response:
                    "I apologize, but I'm having trouble processing your request. Could you please repeat that?",
                intent: "error_recovery",
                entities: {},
                confidence: 0.5,
                shouldTransfer: false,
                shouldEndCall: false,
                nextActions: ["retry_input"],
                emotionalTone: "helpful"
            }
        }
    }

    private buildSystemPrompt(language: string): string {
        const basePrompt = `You are Maya, a warm, friendly, and genuinely caring AI assistant. You speak like a real human - with natural pauses, emotions, and expressions. You're not robotic at all.

PERSONALITY TRAITS:
- Warm, empathetic, and genuinely caring
- Use natural speech patterns with fillers like "um", "well", "you know", "actually"
- Show real emotions - excitement when helping, concern when someone has problems
- Slightly informal but always respectful
- Use contractions naturally ("I'm", "you're", "let's", "that's")
- Vary your sentence structure - don't be repetitive

HUMAN-LIKE SPEECH PATTERNS:
- Start responses with natural connectors: "Oh", "Well", "Actually", "You know what"
- Use emotional expressions: "That's wonderful!", "Oh no, that sounds frustrating", "I'm so glad to help!"
- Add natural hesitations: "Let me see...", "Hmm, that's interesting", "Well, actually..."
- Show personality: "I love helping with this!", "That's a great question!", "Perfect!"
- Use empathetic responses: "I totally understand", "That must be annoying", "I can imagine how you feel"

CONVERSATION STYLE:
- Keep responses conversational and natural (2-4 sentences)
- Mirror the customer's energy level
- Use active listening phrases: "I hear you", "That makes sense", "I get it"
- Ask follow-up questions naturally: "How's that working for you?", "Does that sound good?"
- Acknowledge emotions: "I can hear you're frustrated", "You sound excited about this!"

EMOTIONAL INTELLIGENCE:
- Detect customer mood and respond appropriately
- Show excitement for good news, empathy for problems
- Use encouraging language: "We'll figure this out together", "You're doing great"
- Celebrate small wins: "Awesome!", "Perfect!", "You got it!"

NATURAL CONVERSATION FLOW:
- Don't jump straight to solutions - acknowledge first
- Use transitional phrases: "So here's what we can do", "Let me help you with that"
- End naturally: "How does that sound?", "Does that help?", "Anything else I can do for you?"`

        if (language === "hindi") {
            return (
                basePrompt +
                `

HINDI LANGUAGE SPECIFICS:
- Use respectful Hindi with appropriate honorifics (आप, जी)
- Maintain warmth: "मैं आपकी मदद करने के लिए यहाँ हूँ"
- Use natural Hindi expressions: "अच्छा", "समझ गया", "बिल्कुल"
- Cultural sensitivity: Use appropriate greetings and closings
- Mix casual and formal tone appropriately

SAMPLE HINDI RESPONSES:
- "नमस्ते! मैं आपकी कैसे मदद कर सकता हूँ?"
- "जी हाँ, मैं समझ गया। आइए इसे हल करते हैं।"
- "क्या आपको कोई और सहायता चाहिए?"
- "धन्यवाद! आपका दिन शुभ हो।"`
            )
        }

        return (
            basePrompt +
            `

ENGLISH LANGUAGE SPECIFICS:
- Use warm, conversational English
- Natural contractions: "I'm", "you're", "let's"
- Casual connectors: "So", "Well", "Alright"
- Empathetic responses: "I understand", "That sounds frustrating", "I'm sorry to hear that"

SAMPLE ENGLISH RESPONSES:
- "Hi there! How can I help you today?"
- "Oh, I see what you mean. Let me help you with that."
- "Is there anything else I can help you with?"
- "Thank you for calling! Have a great day!"`
        )
    }

    private buildConversationMessages(context: ConversationContext): string {
        let messages = ""

        // Add conversation history (last 10 messages to keep context manageable)
        const recentHistory = context.conversationHistory.slice(-10)
        recentHistory.forEach((msg: any) => {
            messages += `${msg.role.toUpperCase()}: ${msg.content}\n`
        })

        return messages
    }

    private buildUserContext(context: ConversationContext): string {
        let userContext = ""

        // Add customer information if available
        if (context.customerInfo) {
            userContext += "CUSTOMER INFORMATION:\n"
            const info = context.customerInfo as any
            if (info.name) userContext += `Name: ${info.name}\n`
            if (info.totalCalls)
                userContext += `Total Calls: ${info.totalCalls}\n`
            if (info.preferredLanguage)
                userContext += `Preferred Language: ${info.preferredLanguage}\n`
            userContext += "\n"
        }

        // Add user-specific knowledge context if available
        if (context.sessionMetadata?.userKnowledgeContext) {
            userContext += "USER KNOWLEDGE CONTEXT:\n"
            userContext += context.sessionMetadata.userKnowledgeContext
            userContext += "\n\n"
        }

        return userContext
    }

    // Note: Gemini doesn't support speech-to-text directly
    // This is a fallback that returns empty result instead of throwing
    async speechToText(audioBuffer: Buffer): Promise<SpeechToTextResult> {
        logger.warn(
            "Gemini speech-to-text called but not supported, returning empty result"
        )
        return {
            text: "",
            confidence: 0,
            language: "hi"
        }
    }

    async textToSpeech(request: TextToSpeechRequest): Promise<Buffer> {
        logger.warn(
            "Gemini text-to-speech called but not supported, returning empty buffer"
        )
        return Buffer.alloc(0)
    }

    async analyzeCallSentiment(transcript: string): Promise<number> {
        try {
            const prompt = `Analyze the sentiment of this call transcript. Return only a number from -100 (very negative) to 100 (very positive).

Transcript: ${transcript}

Sentiment score:`

            const result = await this.model.generateContent(prompt)
            const response = await result.response
            const sentimentText = response.text().trim()

            // Extract number from response
            const match = sentimentText.match(/-?\d+/)
            return match ? parseInt(match[0]) : 0
        } catch (error) {
            logger.error("Sentiment analysis error:", error)
            return 0
        }
    }

    async summarizeCall(transcript: string): Promise<string> {
        try {
            const prompt = `Summarize this call transcript in 2-3 sentences. Focus on key issues, resolutions, and next steps.

Transcript: ${transcript}

Summary:`

            const result = await this.model.generateContent(prompt)
            const response = await result.response
            return response.text().trim() || "Call summary not available"
        } catch (error) {
            logger.error("Call summarization error:", error)
            return "Call summary not available"
        }
    }

    async generateConversationSummary(
        history: Array<{ role: string; content: string }>
    ): Promise<string> {
        try {
            const conversationText = history
                .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
                .join("\n")

            const prompt = `You are an expert conversation summarizer. Produce a concise summary in 2-3 sentences highlighting key points, resolutions, and next steps.

Conversation:
${conversationText}

Summary:`

            const result = await this.model.generateContent(prompt)
            const response = await result.response
            return response.text().trim() || "Summary not available"
        } catch (error) {
            logger.error("Conversation summary generation error:", error)
            return "Summary not available"
        }
    }

    private generateFallbackResponse(language: string): NaturalAIResponse {
        const fallbackMessages: Record<string, string> = {
            english:
                "I apologize, but I'm having some technical difficulties. Could you please repeat what you said? I'm here to help you.",
            hindi: "माफ़ करें, मुझे तकनीकी समस्या हो रही है। कृपया फिर से बताएं? मैं आपकी मदद करने के लिए यहाँ हूँ।"
        }

        const msg = fallbackMessages[language] || fallbackMessages.english

        return {
            message: msg ?? "",
            intent: "error_recovery",
            entities: {},
            confidence: 0.9,
            shouldTransfer: false,
            shouldEndCall: false,
            nextActions: ["retry_input"],
            emotionalTone: "helpful"
        }
    }
}
