import { GeminiService } from "../ai/gemini.service"
import { LanguageDetectionService } from "../ai/language-detection.service"
import { ConversationHistoryService } from "./conversation-history.service"
import { userKnowledgeService } from "../knowledge/user-knowledge.service"
import { logger } from "../../utils/logger"
import {
    ConversationResult,
    ConversationContext
} from "../../types/conversation.types"
import { eventService } from "../messaging/event.service"

export class ConversationService {
    private geminiService: GeminiService
    private languageDetectionService: LanguageDetectionService
    private conversationHistoryService: ConversationHistoryService

    constructor() {
        this.geminiService = new GeminiService()
        this.languageDetectionService = new LanguageDetectionService()
        this.conversationHistoryService = new ConversationHistoryService()
    }

    async processUserInput(
        callSid: string,
        userInput: string,
        confidence: number,
        phoneNumber?: string,
        isStreaming: boolean = false
    ): Promise<ConversationResult> {
        try {
            // Handle empty or invalid user input
            if (!userInput || userInput.trim().length === 0) {
                logger.warn(`Empty user input for call ${callSid}`)
                return this.generateNoInputResponse(callSid)
            }

            // Detect language and intent (parallel processing for better performance)
            const [detectedLanguage, conversationHistory] = await Promise.all([
                this.languageDetectionService.detectLanguage(userInput),
                this.conversationHistoryService.getHistory(callSid)
            ])

            const currentLanguage =
                this.conversationHistoryService.getCurrentLanguage(callSid) ||
                "hindi" // Changed default to Hindi

            // Check for language switch request
            const languageSwitch = this.detectLanguageSwitch(
                userInput,
                currentLanguage
            )

            // Get user-specific knowledge context if phone number provided
            let customerInfo = {}
            let userKnowledgeContext = ""

            if (phoneNumber) {
                try {
                    const [userProfile, knowledgeContext] = await Promise.all([
                        userKnowledgeService.getUserProfile(phoneNumber),
                        userKnowledgeService.getContextForUser(
                            phoneNumber,
                            userInput
                        )
                    ])

                    if (userProfile) {
                        customerInfo = {
                            name: userProfile.name,
                            preferredLanguage: userProfile.preferredLanguage,
                            totalCalls: userProfile.totalCalls,
                            metadata: userProfile.metadata
                        }

                        // Update user call count
                        await userKnowledgeService.createOrUpdateUserProfile(
                            phoneNumber,
                            {}
                        )
                    }

                    userKnowledgeContext = knowledgeContext
                } catch (error) {
                    logger.warn(
                        `Failed to fetch user context for ${phoneNumber}:`,
                        error
                    )
                }
            }

            // Build conversation context
            const context: ConversationContext = {
                callSid,
                currentLanguage: languageSwitch || detectedLanguage,
                userInput,
                confidence,
                conversationHistory,
                customerInfo,
                timestamp: new Date().toISOString(),
                sessionMetadata: {
                    phoneNumber,
                    userKnowledgeContext
                }
            }

            // Generate AI response with streaming optimization
            const aiResponse = await this.geminiService.generateNaturalResponse(
                context
            )

            // Update conversation history
            this.conversationHistoryService.addMessage(
                callSid,
                "user",
                userInput,
                context.currentLanguage
            )
            this.conversationHistoryService.addMessage(
                callSid,
                "assistant",
                aiResponse.message,
                context.currentLanguage
            )

            // Update current language if switched
            if (languageSwitch) {
                this.conversationHistoryService.setCurrentLanguage(
                    callSid,
                    languageSwitch
                )
            }

            // Prepare conversation result
            const result: ConversationResult = {
                callSid,
                response: aiResponse.message,
                language: context.currentLanguage,
                intent: aiResponse.intent,
                entities: aiResponse.entities,
                confidence: aiResponse.confidence,
                shouldTransfer: aiResponse.shouldTransfer,
                shouldEndCall: aiResponse.shouldEndCall,
                nextActions: aiResponse.nextActions,
                timestamp: new Date().toISOString()
            }

            // Log and emit events
            logger.info(
                `Conversation processed [${callSid}]: ${userInput} -> ${aiResponse.message}`
            )
            await eventService.publishConversationEvent(
                "conversation.processed",
                result
            )

            return result
        } catch (error) {
            logger.error(`Error processing conversation for ${callSid}:`, error)

            // Return graceful error response
            return this.generateErrorResponse(callSid, userInput, error)
        }
    }

    private detectLanguageSwitch(
        userInput: string,
        currentLanguage: string
    ): string | null {
        const input = userInput.toLowerCase()

        // Optimized language switch patterns with faster regex
        const englishPatterns = [
            /can you.*(speak|talk|switch).*(english|angrej)/i,
            /(please|pls).*(speak|talk).*(english|angrej)/i,
            /(english|angrej).*(please|pls|me|main)/i,
            /switch.*(english|angrej)/i
        ]

        const hindiPatterns = [
            /can you.*(speak|talk|switch).*(hindi|हिंदी)/i,
            /(please|pls).*(speak|talk).*(hindi|हिंदी)/i,
            /(hindi|हिंदी).*(please|pls|me|main)/i,
            /switch.*(hindi|हिंदी)/i,
            /हिंदी.*(में|मे).*(बात|बोल)/i,
            /हिंदी.*(बोलिए|बोलें|करें)/i
        ]

        // Quick check for current language to avoid unnecessary processing
        if (
            currentLanguage !== "english" &&
            englishPatterns.some((pattern) => pattern.test(input))
        ) {
            return "english"
        }

        if (
            currentLanguage !== "hindi" &&
            hindiPatterns.some((pattern) => pattern.test(input))
        ) {
            return "hindi"
        }

        return null
    }

    private generateNoInputResponse(callSid: string): ConversationResult {
        const currentLanguage =
            (this.conversationHistoryService.getCurrentLanguage(callSid) as
                | "english"
                | "hindi") || "hindi" // Default to Hindi

        const noInputMessages = {
            english:
                "I didn't catch that. Could you please speak a bit louder or repeat what you said?",
            hindi: "मुझे कुछ सुनाई नहीं दिया। कृपया थोड़ा तेज़ बोलें या फिर से बताएं?"
        }

        return {
            callSid,
            response: noInputMessages[currentLanguage] || noInputMessages.hindi,
            language: currentLanguage,
            intent: "no_input",
            entities: {},
            confidence: 0.9,
            shouldTransfer: false,
            shouldEndCall: false,
            nextActions: ["retry_input"],
            timestamp: new Date().toISOString()
        }
    }

    private generateErrorResponse(
        callSid: string,
        userInput: string,
        error: any
    ): ConversationResult {
        const currentLanguage =
            (this.conversationHistoryService.getCurrentLanguage(callSid) as
                | "english"
                | "hindi") || "hindi" // Default to Hindi

        const errorMessages = {
            english:
                "I apologize, but I'm having a small technical difficulty. Could you please repeat what you said? I'm here to help you.",
            hindi: "माफ़ करें, मुझे तकनीकी समस्या हो रही है। कृपया फिर से बताएं? मैं आपकी मदद करने के लिए यहाँ हूँ।"
        }

        return {
            callSid,
            response: errorMessages[currentLanguage] || errorMessages.hindi,
            language: currentLanguage,
            intent: "error_recovery",
            entities: {},
            confidence: 0.9,
            shouldTransfer: false,
            shouldEndCall: false,
            nextActions: ["retry_input"],
            timestamp: new Date().toISOString()
        }
    }

    async endConversation(callSid: string): Promise<void> {
        try {
            // Get conversation summary
            const history = this.conversationHistoryService.getHistory(callSid)
            const summary =
                await this.geminiService.generateConversationSummary(history)

            // Publish end event
            await eventService.publishConversationEvent("conversation.ended", {
                callSid,
                summary,
                messageCount: history.length,
                timestamp: new Date().toISOString()
            })

            // Clean up conversation history
            this.conversationHistoryService.clearHistory(callSid)

            logger.info(`Conversation ended for ${callSid}`)
        } catch (error) {
            logger.error(`Error ending conversation for ${callSid}:`, error)
        }
    }

    getConversationStats(callSid: string) {
        return this.conversationHistoryService.getConversationStats(callSid)
    }
}

export const conversationService = new ConversationService()
