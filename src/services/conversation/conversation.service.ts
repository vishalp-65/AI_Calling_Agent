import { OpenAIService } from "../ai/openai.service"
import { LanguageDetectionService } from "../ai/language-detection.service"
import { ConversationHistoryService } from "./conversation-history.service"
import { logger } from "../../utils/logger"
import {
    ConversationResult,
    ConversationContext
} from "../../types/conversation.types"
import { eventService } from "../messaging/event.service"

export class ConversationService {
    private openAIService: OpenAIService
    private languageDetectionService: LanguageDetectionService
    private conversationHistoryService: ConversationHistoryService

    constructor() {
        this.openAIService = new OpenAIService()
        this.languageDetectionService = new LanguageDetectionService()
        this.conversationHistoryService = new ConversationHistoryService()
    }

    async processUserInput(
        callSid: string,
        userInput: string,
        confidence: number
    ): Promise<ConversationResult> {
        try {
            // Detect language and intent
            const detectedLanguage =
                await this.languageDetectionService.detectLanguage(userInput)
            const currentLanguage =
                this.conversationHistoryService.getCurrentLanguage(callSid) ||
                "english"

            // Check for language switch request
            const languageSwitch = this.detectLanguageSwitch(
                userInput,
                currentLanguage
            )

            // Get conversation history
            const conversationHistory =
                this.conversationHistoryService.getHistory(callSid)

            // Build conversation context
            const context: ConversationContext = {
                callSid,
                currentLanguage: languageSwitch || detectedLanguage,
                userInput,
                confidence,
                conversationHistory,
                timestamp: new Date().toISOString()
            }

            // Generate AI response
            const aiResponse = await this.openAIService.generateNaturalResponse(
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

        // English language switch patterns
        const englishPatterns = [
            /can you (speak|talk|switch to) english/i,
            /please speak english/i,
            /i want to speak in english/i,
            /switch to english/i,
            /english please/i,
            /speak english/i
        ]

        // Hindi language switch patterns
        const hindiPatterns = [
            /can you (speak|talk|switch to) hindi/i,
            /please speak hindi/i,
            /i want to speak in hindi/i,
            /switch to hindi/i,
            /hindi please/i,
            /speak hindi/i,
            /हिंदी में बात करें/i,
            /हिंदी में बोलें/i,
            /हिंदी बोलिए/i
        ]

        if (
            englishPatterns.some((pattern) => pattern.test(input)) &&
            currentLanguage !== "english"
        ) {
            return "english"
        }

        if (
            hindiPatterns.some((pattern) => pattern.test(input)) &&
            currentLanguage !== "hindi"
        ) {
            return "hindi"
        }

        return null
    }

    private generateErrorResponse(
        callSid: string,
        userInput: string,
        error: any
    ): ConversationResult {
        const currentLanguage =
            (this.conversationHistoryService.getCurrentLanguage(callSid) as
                | "english"
                | "hindi") || "english"

        const errorMessages = {
            english:
                "I apologize, but I'm having a small technical difficulty. Could you please repeat what you said? I'm here to help you.",
            hindi: "माफ़ करें, मुझे तकनीकी समस्या हो रही है। कृपया फिर से बताएं? मैं आपकी मदद करने के लिए यहाँ हूँ।"
        }

        return {
            callSid,
            response: errorMessages[currentLanguage] || errorMessages.english,
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
                await this.openAIService.generateConversationSummary(history)

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
