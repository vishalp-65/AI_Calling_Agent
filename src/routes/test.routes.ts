import { Router } from "express"
import { ResponseHandler } from "../utils/response"
import { logger } from "../utils/logger"
import { TWILIO_CONFIG } from "../config/twilio"

const router = Router()

// Test endpoint to verify system is working
router.get("/", (req, res) => {
    try {
        const testData = {
            status: "System is working",
            timestamp: new Date().toISOString(),
            config: {
                defaultLanguage: TWILIO_CONFIG.defaultLanguage,
                supportedLanguages: TWILIO_CONFIG.supportedLanguages,
                voiceConfig: {
                    hindi: TWILIO_CONFIG.voice.hi,
                    english: TWILIO_CONFIG.voice.en
                }
            }
        }

        return ResponseHandler.success(res, testData, "Test endpoint working")
    } catch (error) {
        logger.error("Test endpoint error:", error)
        return ResponseHandler.serverError(res, "Test endpoint failed", error)
    }
})

// Test TwiML generation
router.get("/twiml", (req, res) => {
    try {
        const testTwiML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="${TWILIO_CONFIG.voice.hi.voice}" language="${TWILIO_CONFIG.defaultLanguage}">
        नमस्ते! यह एक टेस्ट कॉल है। सिस्टम सही तरीके से काम कर रहा है।
    </Say>
    <Gather input="speech" timeout="5" action="/api/calls/webhook/gather" method="POST" language="${TWILIO_CONFIG.defaultLanguage}">
        <Say voice="${TWILIO_CONFIG.voice.hi.voice}" language="${TWILIO_CONFIG.defaultLanguage}">
            कृपया कुछ बोलें।
        </Say>
    </Gather>
</Response>`

        res.type("text/xml").send(testTwiML)
    } catch (error) {
        logger.error("TwiML test error:", error)
        res.status(500)
            .type("text/xml")
            .send(`<Response><Say>Test failed</Say></Response>`)
    }
})

export { router as testRoutes }
