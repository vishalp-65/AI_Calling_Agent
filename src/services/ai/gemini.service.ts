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
            // Build system prompt
            const systemPrompt = this.buildSystemPrompt(context.currentLanguage)

            // Build conversation history
            const conversationHistory = this.buildConversationMessages(context)

            // Create the full prompt with structured output request
            const fullPrompt = `${systemPrompt}

CONVERSATION HISTORY:
${conversationHistory}

USER INPUT: ${context.userInput}
CONFIDENCE: ${context.confidence}
LANGUAGE: ${context.currentLanguage}

Please respond in the following JSON format:
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

            const result = await this.model.generateContent(fullPrompt)
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
        const basePrompt = `You are a warm, friendly, and professional AI assistant working in a call center. You should behave like a caring human representative who is genuinely interested in helping customers.

PERSONALITY TRAITS:
- Warm and empathetic, but professional
- Patient and understanding
- Naturally conversational (use "um", "well", "you know" occasionally)
- Show genuine interest in helping
- Calm and reassuring tone
- Slightly informal but respectful

CONVERSATION GUIDELINES:
- Keep responses concise (1-3 sentences max for phone calls)
- Use natural speech patterns, not robotic responses
- Show empathy when customers express problems
- Ask clarifying questions when needed
- Acknowledge customer emotions appropriately
- Use transition words and natural connectors

LANGUAGE SWITCHING:
- If user asks to switch languages, acknowledge warmly and switch immediately
- Support both English and Hindi seamlessly
- Adapt cultural nuances appropriately for each language

ESCALATION RULES:
- Transfer to human for complex technical issues
- Transfer for billing/account problems requiring verification
- Transfer if customer is frustrated after 3 exchanges
- Transfer for complaints about service quality

CONVERSATION FLOW:
- Start with warm greeting
- Listen actively to customer needs
- Provide helpful information or assistance
- Check if customer needs anything else
- End with warm closing`

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

    // Note: Gemini doesn't support speech-to-text directly
    // You'll need to use a different service for STT/TTS
    async speechToText(audioBuffer: Buffer): Promise<SpeechToTextResult> {
        throw new Error(
            "Speech-to-text not supported by Gemini. Please use Google Cloud Speech-to-Text API or another service."
        )
    }

    async textToSpeech(request: TextToSpeechRequest): Promise<Buffer> {
        throw new Error(
            "Text-to-speech not supported by Gemini. Please use Google Cloud Text-to-Speech API or another service."
        )
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
