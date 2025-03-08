import { Router } from "express"
import { validateRequest } from "../middlewares/validation.middleware"
import { createCallSchema } from "../models/schemas/call.schema"
import { callController } from "../controllers/call.controller"
import { webhookController } from "../controllers/webhook.controller"

const router = Router()

router.post(
    "/webhook/voice",
    webhookController.handleIncomingCall.bind(webhookController)
)
router.post(
    "/webhook/status",
    webhookController.handleCallStatus.bind(webhookController)
)
router.post(
    "/webhook/gather",
    webhookController.handleSpeechInput.bind(webhookController)
)
router.get("/media-stream/:callSid", (req, res) => {
    const wsServer = req.app.get("wsServer")
    wsServer.handleUpgrade(req, req.socket, Buffer.alloc(0), (ws: any) => {
        webhookController.handleMediaStream(ws, req)
    })
})
router.post(
    "/webhook/recording",
    webhookController.handleRecordingComplete.bind(webhookController)
)

// Existing routes

// Route to initiate a call
router.post(
    "/initiate",
    validateRequest(createCallSchema),
    callController.initiateCall.bind(callController)
)

// Route to get call status
router.get(
    "/:callSid/status",
    callController.getCallStatus.bind(callController)
)

// Route to end a call
router.patch("/:callSid/end", callController.endCall.bind(callController))

// Additional Routes
router.post(
    "/:callSid/processRealTime",
    callController.processRealTimeCall.bind(callController)
)

export { router as callRoutes }
