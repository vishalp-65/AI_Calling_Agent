import { CallPriority, CallStatus } from "../models/entities/Call.entity"

export interface CallRequest {
    toNumber: string
    fromNumber?: string
    priority?: CallPriority
    metadata?: Record<string, any>
}

export interface CallResponse {
    callSid: string
    status: CallStatus
    estimatedDuration?: number
    queuePosition?: number
}

export interface CallWebhookPayload {
    CallSid: string
    CallStatus: string
    From: string
    To: string
    Direction: string
    Duration?: string
    RecordingUrl?: string
    TranscriptionText?: string
}

export interface SpeechToTextResult {
    text: string
    confidence: number
    language: string
    duration: number
}

export interface TextToSpeechRequest {
    text: string
    voice?: string
    speed?: number
    pitch?: number
}

export interface RealTimeCallData {
    callSid: string
    transcript: string
    aiResponse: string
    audioResponse: string
    timestamp: number
    confidence?: number
}

export interface MediaStreamData {
    event: string
    media?: {
        timestamp: string
        payload: string
    }
    streamSid?: string
}

export interface CallStreamEvent {
    eventType: string
    callSid: string
    data: any
    timestamp: number
}
