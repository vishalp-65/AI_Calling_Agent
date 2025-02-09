import Joi from "joi"
import { KnowledgeType, KnowledgeStatus } from "../entities/Knowledge.entity"

export const createKnowledgeSchema = Joi.object({
    title: Joi.string().min(1).max(255).required(),
    content: Joi.string().min(1).required(),
    type: Joi.string()
        .valid(...Object.values(KnowledgeType))
        .required(),
    category: Joi.string().max(100).optional(),
    tags: Joi.array().items(Joi.string()).optional(),
    keywords: Joi.array().items(Joi.string()).optional(),
    priority: Joi.number().integer().min(0).default(0),
    sourceUrl: Joi.string().uri().optional(),
    author: Joi.string().max(100).optional(),
    metadata: Joi.object().optional()
})

export const updateKnowledgeSchema = Joi.object({
    title: Joi.string().min(1).max(255).optional(),
    content: Joi.string().min(1).optional(),
    type: Joi.string()
        .valid(...Object.values(KnowledgeType))
        .optional(),
    status: Joi.string()
        .valid(...Object.values(KnowledgeStatus))
        .optional(),
    category: Joi.string().max(100).optional(),
    tags: Joi.array().items(Joi.string()).optional(),
    keywords: Joi.array().items(Joi.string()).optional(),
    priority: Joi.number().integer().min(0).optional(),
    sourceUrl: Joi.string().uri().optional(),
    author: Joi.string().max(100).optional(),
    metadata: Joi.object().optional()
})

export const knowledgeQuerySchema = Joi.object({
    query: Joi.string().min(1).required(),
    category: Joi.string().optional(),
    type: Joi.string()
        .valid(...Object.values(KnowledgeType))
        .optional(),
    limit: Joi.number().integer().min(1).max(50).default(10),
    threshold: Joi.number().min(0).max(1).default(0.5)
})
