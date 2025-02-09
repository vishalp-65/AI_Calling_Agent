import Joi from "joi"
import { AgentType, AgentStatus } from "../entities/Agent.entity"

export const createAgentSchema = Joi.object({
    name: Joi.string().min(1).max(100).required(),
    type: Joi.string()
        .valid(...Object.values(AgentType))
        .required(),
    description: Joi.string().optional(),
    capabilities: Joi.array().items(Joi.string()).optional(),
    configuration: Joi.object().optional(),
    voiceProfile: Joi.string().max(100).optional(),
    systemPrompt: Joi.string().optional(),
    maxConcurrentCalls: Joi.number().integer().min(0).default(10)
})

export const updateAgentSchema = Joi.object({
    name: Joi.string().min(1).max(100).optional(),
    status: Joi.string()
        .valid(...Object.values(AgentStatus))
        .optional(),
    description: Joi.string().optional(),
    capabilities: Joi.array().items(Joi.string()).optional(),
    configuration: Joi.object().optional(),
    voiceProfile: Joi.string().max(100).optional(),
    systemPrompt: Joi.string().optional(),
    maxConcurrentCalls: Joi.number().integer().min(0).optional()
})
