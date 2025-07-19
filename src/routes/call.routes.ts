import { Router } from "express"
import { validateRequest } from "../middlewares/validation.middleware"
import { createCallSchema } from "../models/schemas/call.schema"
import { callController } from "../controllers/call.controller"
import { webhookController } from "../controllers/webhook.controller"
import { validateWebhookSignature } from "../middlewares/webhook-validation"

// Create two separate routers
const webhookRouter = Router()
const callRouter = Router()

// Webhook routes (public but secured with signature validation)
webhookRouter.post(
    "/voice",
    validateWebhookSignature,
    webhookController.handleIncomingCall.bind(webhookController)
)
webhookRouter.post(
    "/status",
    validateWebhookSignature,
    webhookController.handleCallStatus.bind(webhookController)
)
webhookRouter.post(
    "/gather",
    validateWebhookSignature,
    webhookController.handleSpeechInput.bind(webhookController)
)
webhookRouter.get("/media-stream/:callSid", (req, res) => {
    const wsServer = req.app.get("wsServer")
    wsServer.handleUpgrade(req, req.socket, Buffer.alloc(0), (ws: any) => {
        webhookController.handleMediaStream(ws, req)
    })
})
// Recording disabled to save costs
// webhookRouter.post(
//     "/recording",
//     validateWebhookSignature,
//     webhookController.handleRecordingComplete.bind(webhookController)
// )

// Protected call routes (require authentication)
// Route to initiate a call
callRouter.post(
    "/initiate",
    validateRequest(createCallSchema),
    callController.initiateCall.bind(callController)
)

// Route to get call status
callRouter.get(
    "/:callSid/status",
    callController.getCallStatus.bind(callController)
)

// Route to end a call
callRouter.patch("/:callSid/end", callController.endCall.bind(callController))

// Additional Routes
callRouter.post(
    "/:callSid/processRealTime",
    callController.processRealTimeCall.bind(callController)
)

// Export both routers
export { webhookRouter, callRouter as callRoutes }
