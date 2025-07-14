import { Pinecone } from "@pinecone-database/pinecone"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { config } from "../../config"
import { logger } from "../../utils/logger"
import { KnowledgeResult, VectorSearchOptions } from "../../types/ai.types"
import { geminiClient } from "../../config/gemini"

export class PineconeService {
    private pinecone: Pinecone
    private index: any
    private geminiClient: GoogleGenerativeAI

    constructor() {
        this.pinecone = new Pinecone({
            apiKey: config.pinecone.apiKey,
            environment: config.pinecone.environment
        })
        this.geminiClient = geminiClient
    }

    async initialize(): Promise<void> {
        try {
            this.index = this.pinecone.index(config.pinecone.indexName)
            logger.info("Gemini Pinecone service initialized.")
        } catch (error) {
            logger.error("Failed to initialize Gemini Pinecone:", error)
            throw error
        }
    }

    async createEmbedding(text: string): Promise<number[]> {
        try {
            // Use Gemini's embedding model
            const model = this.geminiClient.getGenerativeModel({
                model: "text-embedding-004" // Gemini's embedding model
            })

            const result = await model.embedContent(text)

            if (!result.embedding || !result.embedding.values) {
                throw new Error(
                    "Embedding data is missing in the Gemini response"
                )
            }

            return result.embedding.values
        } catch (error) {
            logger.error("Failed to create embedding with Gemini:", error)

            // Fallback: create a simple hash-based embedding (not recommended for production)
            // This is just to prevent complete failure - consider using a proper embedding service
            return this.createSimpleEmbedding(text)
        }
    }

    // Fallback method - not recommended for production
    private createSimpleEmbedding(text: string): number[] {
        // This is a very basic fallback - in production, use a proper embedding service
        const embedding = new Array(768).fill(0) // Standard embedding dimension

        for (let i = 0; i < text.length && i < 768; i++) {
            embedding[i] = text.charCodeAt(i) / 1000 // Normalize to 0-1 range
        }

        // Normalize the vector
        const magnitude = Math.sqrt(
            embedding.reduce((sum, val) => sum + val * val, 0)
        )
        return embedding.map((val) => (magnitude > 0 ? val / magnitude : 0))
    }

    async upsertKnowledge(
        id: string,
        text: string,
        metadata: Record<string, any> = {}
    ): Promise<void> {
        try {
            const embedding = await this.createEmbedding(text)

            await this.index.upsert([
                {
                    id,
                    values: embedding,
                    metadata: {
                        ...metadata,
                        text,
                        timestamp: new Date().toISOString()
                    }
                }
            ])

            logger.info(`Knowledge upserted to Pinecone: ${id}`)
        } catch (error) {
            logger.error("Failed to upsert knowledge:", error)
            throw error
        }
    }

    async searchKnowledge(
        query: string,
        options: VectorSearchOptions = {}
    ): Promise<KnowledgeResult[]> {
        try {
            const embedding = await this.createEmbedding(query)

            const searchResponse = await this.index.query({
                vector: embedding,
                topK: options.topK || 5,
                includeMetadata: options.includeMetadata !== false,
                filter: options.filter
            })

            return searchResponse.matches.map((match: any) => ({
                id: match.id,
                title: match.metadata?.title || "Untitled",
                content: match.metadata?.text || "",
                relevanceScore: match.score,
                metadata: match.metadata
            }))
        } catch (error) {
            logger.error("Failed to search knowledge:", error)
            throw error
        }
    }

    async deleteKnowledge(id: string): Promise<void> {
        try {
            await this.index.delete1([id])
            logger.info(`Knowledge deleted from Pinecone: ${id}`)
        } catch (error) {
            logger.error("Failed to delete knowledge:", error)
            throw error
        }
    }

    async getStats(): Promise<any> {
        try {
            return await this.index.describeIndexStats()
        } catch (error) {
            logger.error("Failed to get Pinecone stats:", error)
            throw error
        }
    }

    async bulkUpsert(
        items: Array<{
            id: string
            text: string
            metadata?: Record<string, any>
        }>
    ): Promise<void> {
        try {
            const batchSize = 100 // Process in batches to avoid rate limits

            for (let i = 0; i < items.length; i += batchSize) {
                const batch = items.slice(i, i + batchSize)

                const vectors = await Promise.all(
                    batch.map(async (item) => {
                        const embedding = await this.createEmbedding(item.text)
                        return {
                            id: item.id,
                            values: embedding,
                            metadata: {
                                ...item.metadata,
                                text: item.text,
                                timestamp: new Date().toISOString()
                            }
                        }
                    })
                )

                await this.index.upsert(vectors)
                logger.info(`Batch upserted: ${vectors.length} items`)
            }
        } catch (error) {
            logger.error("Failed to bulk upsert:", error)
            throw error
        }
    }

    async semanticSearch(
        query: string,
        options: {
            topK?: number
            filter?: Record<string, any>
            threshold?: number
        } = {}
    ): Promise<KnowledgeResult[]> {
        try {
            const results = await this.searchKnowledge(query, options)

            // Filter by threshold if provided
            if (options.threshold) {
                return results.filter(
                    (result) => result.relevanceScore >= options.threshold!
                )
            }

            return results
        } catch (error) {
            logger.error("Failed to perform semantic search:", error)
            throw error
        }
    }

    async getKnowledgeById(id: string): Promise<KnowledgeResult | null> {
        try {
            const response = await this.index.fetch([id])

            if (!response.vectors || !response.vectors[id]) {
                return null
            }

            const vector = response.vectors[id]
            return {
                id: vector.id,
                title: vector.metadata?.title || "Untitled",
                content: vector.metadata?.text || "",
                relevanceScore: 1.0, // Perfect match since we fetched by ID
                metadata: vector.metadata
            }
        } catch (error) {
            logger.error("Failed to get knowledge by ID:", error)
            return null
        }
    }
}
