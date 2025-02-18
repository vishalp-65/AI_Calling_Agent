import { Pinecone } from "@pinecone-database/pinecone"
import { config } from "../../config"
import { logger } from "../../utils/logger"
import { KnowledgeResult, VectorSearchOptions } from "../../types/ai.types"
import { OpenAIService } from "./openai.service"

export class PineconeService {
    private pinecone: Pinecone
    private index: any
    private openaiService: OpenAIService

    constructor() {
        this.pinecone = new Pinecone({
            apiKey: config.pinecone.apiKey,
            environment: config.pinecone.environment
        })
        this.openaiService = new OpenAIService()
    }

    async initialize(): Promise<void> {
        try {
            this.index = this.pinecone.index(config.pinecone.indexName)
            logger.info("Pinecone service initialized")
        } catch (error) {
            logger.error("Failed to initialize Pinecone:", error)
            throw error
        }
    }

    async createEmbedding(text: string): Promise<number[]> {
        try {
            const response = await this.openaiService[
                "client"
            ].embeddings.create({
                model: "text-embedding-ada-002",
                input: text
            })

            if (
                !response.data ||
                !response.data[0] ||
                !response.data[0].embedding
            ) {
                throw new Error(
                    "Embedding data is missing in the OpenAI response"
                )
            }
            return response.data[0].embedding
        } catch (error) {
            logger.error("Failed to create embedding:", error)
            throw error
        }
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
}
