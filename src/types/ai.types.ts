export interface AIResponse {
    message: string
    intent: string
    entities: Record<string, any>
    confidence: number
    shouldTransfer: boolean
    knowledgeUsed?: string[]
    nextActions?: string[]
}

export interface KnowledgeQuery {
    query: string
    category?: string
    limit?: number
    threshold?: number
}

export interface KnowledgeResult {
    id: string
    title: string
    content: string
    relevanceScore: number
    metadata?: Record<string, any>
}

export interface VectorSearchOptions {
    topK?: number
    includeMetadata?: boolean
    filter?: Record<string, any>
}

export interface TextToSpeechRequest {
    text: string
    voice?: string
    speed?: number
}

export interface SpeechToTextResult {
    text: string
    confidence?: number
    language?: string
    duration?: number
}

export interface VectorSearchOptions {
    phoneNumber?: string
    topK?: number
    filter?: Record<string, any>
    userId?: string
}
