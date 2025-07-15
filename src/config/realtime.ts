import { config } from "./index"

export const REALTIME_CONFIG = {
    audio: {
        chunkSize: 1024 * 4, // 4KB chunks for real-time processing
        sampleRate: 16000, // 16kHz for phone quality
        channels: 1, // Mono audio
        bitDepth: 16, // 16-bit audio
        silenceThreshold: 500, // Amplitude threshold for silence detection
        maxSilenceCount: 10, // ~2 seconds of silence before processing
        maxChunkDuration: 3000 // Maximum chunk duration in milliseconds
    },
    processing: {
        maxConcurrentCalls: 100, // Maximum concurrent calls to process
        processingTimeout: 5000, // Timeout for processing a chunk
        maxRetries: 3, // Maximum retries for failed processing
        retryDelay: 1000, // Delay between retries
        heartbeatInterval: 5000, // Heartbeat check interval
        maxInactivityTime: 30000 // Maximum inactivity time before call cleanup
    },
    websocket: {
        pingInterval: 30000, // WebSocket ping interval
        pongTimeout: 10000, // WebSocket pong timeout
        maxPayloadSize: 1024 * 1024, // Maximum WebSocket payload size (1MB)
        compression: true // Enable WebSocket compression
    },
    speech: {
        languages: ["en-US", "hi-IN"], // Supported languages
        defaultLanguage: "hi-IN",
        confidenceThreshold: 0.7, // Minimum confidence for speech recognition
        maxSpeechDuration: 30000, // Maximum speech duration in milliseconds
        speechTimeout: 3000 // Speech timeout in milliseconds
    },
    ai: {
        maxTokens: 150, // Maximum tokens for AI response
        temperature: 0.7, // AI response temperature
        streamResponse: true, // Enable streaming AI responses
        maxResponseTime: 3000, // Maximum AI response time
        contextWindow: 20 // Number of previous messages to include in context
    },
    tts: {
        defaultVoice: "alloy",
        defaultSpeed: 1.0,
        maxTextLength: 4000, // Maximum text length for TTS
        audioFormat: "mp3", // Audio format for TTS output
        audioQuality: "standard" // Audio quality (standard, high)
    },
    kafka: {
        topics: {
            audioEvents: "real-time-audio-events",
            callEvents: "real-time-call-events",
            processingEvents: "real-time-processing-events",
            analyticsEvents: "real-time-analytics-events"
        },
        partitions: 3, // Number of partitions for Kafka topics
        replicationFactor: 1 // Replication factor for Kafka topics
    },
    metrics: {
        enableMetrics: true, // Enable metrics collection
        metricsInterval: 10000, // Metrics collection interval
        maxMetricsHistory: 1000 // Maximum metrics history to keep
    },
    security: {
        enableAuth: true, // Enable authentication for WebSocket connections
        tokenExpiration: 3600000, // Token expiration time (1 hour)
        maxConnectionsPerIP: 10, // Maximum connections per IP
        rateLimitWindow: 60000, // Rate limit window (1 minute)
        maxRequestsPerWindow: 100 // Maximum requests per window
    },
    logging: {
        enableVerboseLogging: config.env === "development",
        logAudioData: false, // Log audio data (for debugging only)
        logProcessingTime: true, // Log processing time
        logMetrics: true // Log metrics
    }
}

export default REALTIME_CONFIG
