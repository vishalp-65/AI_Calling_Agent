import dotenv from "dotenv"
import Joi from "joi"

dotenv.config()

const envVarsSchema = Joi.object({
    NODE_ENV: Joi.string()
        .valid("development", "production", "test")
        .default("development"),
    PORT: Joi.number().default(3000),

    // Database
    DB_HOST: Joi.string().required(),
    DB_PORT: Joi.number().default(5432),
    DB_NAME: Joi.string().required(),
    DB_USER: Joi.string().required(),
    DB_PASSWORD: Joi.string().required(),

    // Redis
    REDIS_HOST: Joi.string().required(),
    REDIS_PORT: Joi.number().default(6379),
    REDIS_PASSWORD: Joi.string().optional(),

    // Kafka
    KAFKA_BROKERS: Joi.string().required(),
    KAFKA_CLIENT_ID: Joi.string().default("ai-calling-agent"),

    // Twilio
    TWILIO_ACCOUNT_SID: Joi.string().required(),
    TWILIO_AUTH_TOKEN: Joi.string().required(),
    TWILIO_PHONE_NUMBER: Joi.string().required(),

    // OpenAI
    OPENAI_API_KEY: Joi.string().required(),
    OPENAI_MODEL: Joi.string().default("gpt-4"),

    // Pinecone
    PINECONE_API_KEY: Joi.string().required(),
    PINECONE_ENVIRONMENT: Joi.string().required(),
    PINECONE_INDEX_NAME: Joi.string().required(),

    // AWS
    AWS_ACCESS_KEY_ID: Joi.string().required(),
    AWS_SECRET_ACCESS_KEY: Joi.string().required(),
    AWS_REGION: Joi.string().default("us-east-1"),

    // Security
    JWT_SECRET: Joi.string().required(),
    JWT_EXPIRES_IN: Joi.string().default("24h"),
    BCRYPT_SALT_ROUNDS: Joi.number().default(12),

    // Rate Limiting
    RATE_LIMIT_WINDOW_MS: Joi.number().default(900000), // 15 minutes
    RATE_LIMIT_MAX_REQUESTS: Joi.number().default(100),

    // Monitoring
    LOG_LEVEL: Joi.string()
        .valid("error", "warn", "info", "debug")
        .default("info"),
    ENABLE_CORS: Joi.boolean().default(true),
    ENABLE_COMPRESSION: Joi.boolean().default(true)
}).unknown()

const { error, value: envVars } = envVarsSchema.validate(process.env)

if (error) {
    throw new Error(`Config validation error: ${error.message}`)
}

export const config = {
    env: envVars.NODE_ENV,
    port: envVars.PORT,

    database: {
        host: envVars.DB_HOST,
        port: envVars.DB_PORT,
        name: envVars.DB_NAME,
        user: envVars.DB_USER,
        password: envVars.DB_PASSWORD
    },

    redis: {
        host: envVars.REDIS_HOST,
        port: envVars.REDIS_PORT,
        password: envVars.REDIS_PASSWORD
    },

    kafka: {
        brokers: envVars.KAFKA_BROKERS.split(","),
        clientId: envVars.KAFKA_CLIENT_ID
    },

    twilio: {
        accountSid: envVars.TWILIO_ACCOUNT_SID,
        authToken: envVars.TWILIO_AUTH_TOKEN,
        phoneNumber: envVars.TWILIO_PHONE_NUMBER
    },

    openai: {
        apiKey: envVars.OPENAI_API_KEY,
        model: envVars.OPENAI_MODEL
    },

    pinecone: {
        apiKey: envVars.PINECONE_API_KEY,
        environment: envVars.PINECONE_ENVIRONMENT,
        indexName: envVars.PINECONE_INDEX_NAME
    },

    aws: {
        accessKeyId: envVars.AWS_ACCESS_KEY_ID,
        secretAccessKey: envVars.AWS_SECRET_ACCESS_KEY,
        region: envVars.AWS_REGION
    },

    security: {
        jwtSecret: envVars.JWT_SECRET,
        jwtExpiresIn: envVars.JWT_EXPIRES_IN,
        bcryptSaltRounds: envVars.BCRYPT_SALT_ROUNDS
    },

    rateLimit: {
        windowMs: envVars.RATE_LIMIT_WINDOW_MS,
        maxRequests: envVars.RATE_LIMIT_MAX_REQUESTS
    },

    monitoring: {
        logLevel: envVars.LOG_LEVEL,
        enableCors: envVars.ENABLE_CORS,
        enableCompression: envVars.ENABLE_COMPRESSION
    }
}
