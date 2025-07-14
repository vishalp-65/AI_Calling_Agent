import { logger } from "../../utils/logger"
import {
    ConversationMessage,
    ConversationStats
} from "../../types/conversation.types"

export class ConversationHistoryService {
    private history: Record<string, ConversationMessage[]> = {}
    private currentLanguage: Record<string, string> = {}

    getHistory(callSid: string): ConversationMessage[] {
        return this.history[callSid] || []
    }

    addMessage(
        callSid: string,
        role: "user" | "assistant",
        content: string,
        language: string
    ): void {
        if (!this.history[callSid]) {
            this.history[callSid] = []
        }

        this.history[callSid].push({
            id: String(Date.now()),
            role,
            content,
            language,
            timestamp: new Date().toISOString()
        })
    }

    setCurrentLanguage(callSid: string, language: string): void {
        this.currentLanguage[callSid] = language
    }

    getCurrentLanguage(callSid: string): string | undefined {
        return this.currentLanguage[callSid]
    }

    clearHistory(callSid: string): void {
        delete this.history[callSid]
        delete this.currentLanguage[callSid]
    }

    getConversationStats(callSid: string): ConversationStats {
        const messages = this.history[callSid] || []
        return {
            totalMessages: messages.length,
            userMessages: messages.filter((m) => m.role === "user").length,
            assistantMessages: messages.filter((m) => m.role === "assistant")
                .length,
            averageConfidence: 0.9, // Placeholder for real calculation
            languagesSwitched: 1, // Placeholder for real calculation
            duration: 0, // Placeholder for real calculation
            sentiment: "neutral" // Placeholder
        }
    }
}

export const conversationHistoryService = new ConversationHistoryService()
