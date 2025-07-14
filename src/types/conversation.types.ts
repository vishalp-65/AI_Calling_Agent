export interface ConversationResult {
    callSid: string
    response: string
    language: string
    intent: string
    entities: Record<string, any>
    confidence: number
    shouldTransfer: boolean
    shouldEndCall: boolean
    nextActions: string[]
    timestamp: string
    emotionalTone?: string
}

export interface ConversationContext {
    callSid: string
    currentLanguage: string
    userInput: string
    confidence: number
    conversationHistory: ConversationMessage[]
    timestamp: string
    customerInfo?: Record<string, any>
    sessionMetadata?: Record<string, any>
}

export interface ConversationMessage {
    id: string
    role: "user" | "assistant" | "system"
    content: string
    language: string
    timestamp: string
    confidence?: number
    metadata?: Record<string, any>
}

export interface NaturalAIResponse {
    message: string
    intent: string
    entities: Record<string, any>
    confidence: number
    shouldTransfer: boolean
    shouldEndCall: boolean
    nextActions: string[]
    emotionalTone: string
    detectedLanguage?: string
    responseTime?: number
}

export interface ConversationStats {
    totalMessages: number
    userMessages: number
    assistantMessages: number
    averageConfidence: number
    languagesSwitched: number
    duration: number
    sentiment: "positive" | "negative" | "neutral"
}

export interface LanguageDetectionResult {
    language: string
    confidence: number
    alternatives?: Array<{
        language: string
        confidence: number
    }>
}

export interface ConversationSummary {
    callSid: string
    summary: string
    keyTopics: string[]
    sentimentScore: number
    resolution: string
    nextActions: string[]
    satisfactionScore?: number
    duration: number
    messageCount: number
}
