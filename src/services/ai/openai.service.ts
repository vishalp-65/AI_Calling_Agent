import { OpenAI } from "openai"
import { openaiClient, OPENAI_CONFIG } from "../../config/openai"
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

export class OpenAIService {
    private client: OpenAI

    constructor() {
        this.client = openaiClient
    }

    async generateNaturalResponse(
        context: ConversationContext
    ): Promise<NaturalAIResponse> {
        try {
            const systemPrompt = this.buildSystemPrompt(context.currentLanguage)
            const conversationMessages = this.buildConversationMessages(context)

            const completion = await this.client.chat.completions.create({
                model: OPENAI_CONFIG.model,
                messages: conversationMessages,
                temperature: 0.7, // Slightly higher for more natural responses
                max_tokens: 300,
                top_p: 0.9,
                frequency_penalty: 0.3,
                presence_penalty: 0.3,
                functions: [
                    {
                        name: "process_conversation",
                        description:
                            "Process user input and generate appropriate response",
                        parameters: {
                            type: "object",
                            properties: {
                                response: {
                                    type: "string",
                                    description:
                                        "Natural, conversational response to the user"
                                },
                                intent: {
                                    type: "string",
                                    enum: [
                                        "greeting",
                                        "question",
                                        "request_help",
                                        "complaint",
                                        "compliment",
                                        "goodbye",
                                        "language_switch",
                                        "clarification",
                                        "general_chat"
                                    ],
                                    description: "User's intent"
                                },
                                entities: {
                                    type: "object",
                                    description:
                                        "Extracted entities from user input"
                                },
                                confidence: {
                                    type: "number",
                                    minimum: 0,
                                    maximum: 1,
                                    description:
                                        "Confidence in understanding user intent"
                                },
                                shouldTransfer: {
                                    type: "boolean",
                                    description:
                                        "Whether to transfer to human agent"
                                },
                                shouldEndCall: {
                                    type: "boolean",
                                    description:
                                        "Whether the conversation should end"
                                },
                                nextActions: {
                                    type: "array",
                                    items: { type: "string" },
                                    description: "Suggested next actions"
                                },
                                emotionalTone: {
                                    type: "string",
                                    enum: [
                                        "happy",
                                        "concerned",
                                        "helpful",
                                        "empathetic",
                                        "excited",
                                        "calm"
                                    ],
                                    description:
                                        "Emotional tone of the response"
                                }
                            },
                            required: [
                                "response",
                                "intent",
                                "entities",
                                "confidence",
                                "shouldTransfer",
                                "shouldEndCall",
                                "emotionalTone"
                            ]
                        }
                    }
                ],
                function_call: { name: "process_conversation" }
            })

            const choice = completion.choices[0]
            const functionCall = choice?.message?.function_call

            if (functionCall?.arguments) {
                const result = JSON.parse(functionCall.arguments)
                return {
                    message: result.response,
                    intent: result.intent,
                    entities: result.entities,
                    confidence: result.confidence,
                    shouldTransfer: result.shouldTransfer,
                    shouldEndCall: result.shouldEndCall,
                    nextActions: result.nextActions || [],
                    emotionalTone: result.emotionalTone
                }
            }

            throw new Error("Invalid response format from OpenAI")
        } catch (error) {
            logger.error("OpenAI natural response generation error:", error)
            return this.generateFallbackResponse(context.currentLanguage)
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

    private buildConversationMessages(context: ConversationContext): any[] {
        const messages = [
            {
                role: "system",
                content: this.buildSystemPrompt(context.currentLanguage)
            }
        ]

        // Add conversation history (last 10 messages to keep context manageable)
        const recentHistory = context.conversationHistory.slice(-10)
        recentHistory.forEach((msg: any) => {
            messages.push({
                role: msg.role,
                content: msg.content
            })
        })

        // Add current user input
        messages.push({
            role: "user",
            content: `${context.userInput} [Confidence: ${context.confidence}] [Language: ${context.currentLanguage}]`
        })

        return messages
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

    private generateFallbackResponse(language: string): NaturalAIResponse {
        const fallbackMessages = {
            english: "I apologize, but I'm having some technical difficulties. Could you please repeat what you said? I'm here to help you.",
            hindi: "माफ़ करें, मुझे तकनीकी समस्या हो रही है। कृपया फिर से बताएं? मैं आपकी मदद करने के लिए यहाँ हूँ।"
        }

        return {
            message: fallbackMessages[language] || fallbackMessages.english,
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
