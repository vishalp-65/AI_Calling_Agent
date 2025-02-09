import Joi from "joi"

export const createCustomerSchema = Joi.object({
    firstName: Joi.string().min(1).max(100).required(),
    lastName: Joi.string().min(1).max(100).required(),
    email: Joi.string().email().required(),
    phoneNumber: Joi.string()
        .pattern(/^\+?[1-9]\d{1,14}$/)
        .required(),
    company: Joi.string().max(100).optional(),
    jobTitle: Joi.string().max(100).optional(),
    notes: Joi.string().optional(),
    preferences: Joi.object().optional(),
    customFields: Joi.object().optional(),
    tags: Joi.array().items(Joi.string()).optional()
})

export const updateCustomerSchema = Joi.object({
    firstName: Joi.string().min(1).max(100).optional(),
    lastName: Joi.string().min(1).max(100).optional(),
    email: Joi.string().email().optional(),
    phoneNumber: Joi.string()
        .pattern(/^\+?[1-9]\d{1,14}$/)
        .optional(),
    company: Joi.string().max(100).optional(),
    jobTitle: Joi.string().max(100).optional(),
    notes: Joi.string().optional(),
    preferences: Joi.object().optional(),
    customFields: Joi.object().optional(),
    tags: Joi.array().items(Joi.string()).optional(),
    status: Joi.string().valid("active", "inactive", "blocked").optional()
})
