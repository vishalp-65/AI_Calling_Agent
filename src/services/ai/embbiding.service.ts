import { GoogleGenerativeAI } from "@google/generative-ai"
import { geminiClient } from "../../config/gemini"
import { logger } from "../../utils/logger"

export class EmbeddingService {
    private geminiClient: GoogleGenerativeAI

    constructor() {
        this.geminiClient = geminiClient
    }

    async createEmbedding(text: string): Promise<number[]> {
        try {
            // Method 1: Try Gemini's embedding model first
            return await this.createGeminiEmbedding(text)
        } catch (error) {
            logger.warn("Gemini embedding failed, using fallback:", error)

            // Method 2: Use a free embedding service as fallback
            try {
                return await this.createHuggingFaceEmbedding(text)
            } catch (hfError) {
                logger.warn(
                    "HuggingFace embedding failed, using simple embedding:",
                    hfError
                )

                // Method 3: Simple hash-based embedding as last resort
                return this.createSimpleEmbedding(text)
            }
        }
    }

    private async createGeminiEmbedding(text: string): Promise<number[]> {
        const model = this.geminiClient.getGenerativeModel({
            model: "text-embedding-004"
        })

        const result = await model.embedContent(text)

        if (!result.embedding || !result.embedding.values) {
            throw new Error("Embedding data is missing in the Gemini response")
        }

        return result.embedding.values
    }

    private async createHuggingFaceEmbedding(text: string): Promise<number[]> {
        // Using HuggingFace's free inference API
        const response = await fetch(
            "https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    inputs: text,
                    options: { wait_for_model: true }
                })
            }
        )

        if (!response.ok) {
            throw new Error(`HuggingFace API error: ${response.statusText}`)
        }

        const embedding = await response.json()

        if (Array.isArray(embedding) && embedding.length > 0) {
            return embedding[0] // HuggingFace returns array of embeddings
        }

        throw new Error("Invalid HuggingFace response format")
    }

    private createSimpleEmbedding(text: string): number[] {
        // This is a very basic fallback - not recommended for production
        // Consider using a proper embedding service or model
        const embedding = new Array(384).fill(0) // Smaller dimension for simple embedding

        // Create a simple hash-based embedding
        for (let i = 0; i < text.length && i < 384; i++) {
            const char = text.charCodeAt(i)
            embedding[i % 384] += Math.sin(char * 0.1) * 0.5
        }

        // Add some word-level features
        const words = text.toLowerCase().split(/\s+/)
        words.forEach((word, index) => {
            if (index < 384) {
                embedding[index] += word.length * 0.1
            }
        })

        // Normalize the vector
        const magnitude = Math.sqrt(
            embedding.reduce((sum, val) => sum + val * val, 0)
        )
        return embedding.map((val) => (magnitude > 0 ? val / magnitude : 0))
    }

    async batchCreateEmbeddings(texts: string[]): Promise<number[][]> {
        const embeddings: number[][] = []

        // Process in batches to avoid rate limits
        const batchSize = 10
        for (let i = 0; i < texts.length; i += batchSize) {
            const batch = texts.slice(i, i + batchSize)

            const batchEmbeddings = await Promise.all(
                batch.map((text) => this.createEmbedding(text))
            )

            embeddings.push(...batchEmbeddings)

            // Small delay to respect rate limits
            if (i + batchSize < texts.length) {
                await new Promise((resolve) => setTimeout(resolve, 100))
            }
        }

        return embeddings
    }

    calculateSimilarity(embedding1: number[], embedding2: number[]): number {
        if (embedding1.length !== embedding2.length) {
            throw new Error("Embeddings must have the same dimension")
        }

        // Calculate cosine similarity
        let dotProduct = 0
        let norm1 = 0
        let norm2 = 0

        for (let i = 0; i < embedding1.length; i++) {
            dotProduct += embedding1[i]! * embedding2[i]!
            norm1 += embedding1[i]! * embedding1[i]!
            norm2 += embedding2[i]! * embedding2[i]!
        }

        const similarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2))
        return isNaN(similarity) ? 0 : similarity
    }
}
