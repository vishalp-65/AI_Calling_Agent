import { Request, Response } from "express"
import { ResponseHandler } from "../utils/response"
import { kafkaService } from "../services/messaging/kafka.service"

export class AnalyticsController {
    async health(_req: Request, res: Response): Promise<any> {
        const healthy = await kafkaService.isHealthy()
        return ResponseHandler.success(
            res,
            { kafka: healthy },
            "Analytics health status"
        )
    }

    async publishEvent(req: Request, res: Response): Promise<any> {
        try {
            const { eventType, data } = req.body
            await kafkaService.publishAnalyticsEvent(eventType, data)
            return ResponseHandler.success(
                res,
                null,
                "Analytics event published successfully"
            )
        } catch (error) {
            return ResponseHandler.serverError(
                res,
                "Failed to publish analytics event",
                error
            )
        }
    }
}

export const analyticsController = new AnalyticsController()
