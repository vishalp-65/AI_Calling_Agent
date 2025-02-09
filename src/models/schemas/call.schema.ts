import Joi from "joi"
import { CallPriority, CallDirection } from "../entities/Call.entity"

export const createCallSchema = Joi.object({
    toNumber: Joi.string()
        .pattern(/^\+?[1-9]\d{1,14}$/)
        .required(),
    fromNumber: Joi.string()
        .pattern(/^\+?[1-9]\d{1,14}$/)
        .optional(),
    priority: Joi.string()
        .valid(...Object.values(CallPriority))
        .optional(),
    metadata: Joi.object().optional()
})

export const updateCallSchema = Joi.object({
    status: Joi.string().valid("completed", "failed").optional(),
    transcript: Joi.string().optional(),
    summary: Joi.string().optional(),
    isResolved: Joi.boolean().optional(),
    tags: Joi.array().items(Joi.string()).optional(),
    metadata: Joi.object().optional()
})

export const callQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    status: Joi.string()
        .valid(
            "initiated",
            "ringing",
            "answered",
            "in_progress",
            "completed",
            "failed",
            "busy",
            "no_answer"
        )
        .optional(),
    direction: Joi.string()
        .valid(...Object.values(CallDirection))
        .optional(),
    customerId: Joi.string().uuid().optional(),
    agentId: Joi.string().uuid().optional(),
    dateFrom: Joi.date().optional(),
    dateTo: Joi.date().optional(),
    sortBy: Joi.string()
        .valid("createdAt", "duration", "sentimentScore")
        .default("createdAt"),
    sortOrder: Joi.string().valid("ASC", "DESC").default("DESC")
})
