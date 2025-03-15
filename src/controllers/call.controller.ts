import { Request, Response } from "express"
import { ResponseHandler } from "../utils/response"
import { callService } from "../services/call/call.service"

export class CallController {
    async initiateCall(req: Request, res: Response): Promise<any> {
        try {
            const result = await callService.initiateCall(req.body)
            return ResponseHandler.success(
                res,
                result,
                "Call initiated successfully"
            )
        } catch (error) {
            return ResponseHandler.serverError(
                res,
                "Failed to initiate call",
                error
            )
        }
    }

    async processRealTimeCall(req: Request, res: Response): Promise<any> {
        try {
            const { callSid } = req.params
            if (!callSid) {
                return ResponseHandler.badRequest(
                    res,
                    "Missing callSid parameter"
                )
            }
            await callService.processRealTimeCall(callSid)
            return ResponseHandler.success(res, null, "Real-time call processing initiated")
        } catch (error) {
            return ResponseHandler.serverError(res, "Failed to process real-time call", error)
        }
    }


    async endCall(req: Request, res: Response): Promise<any> {
        try {
            const { callSid } = req.params
            if (!callSid) {
                return ResponseHandler.badRequest(
                    res,
                    "Missing callSid parameter"
                )
            }
            await callService.endCall(callSid)
            return ResponseHandler.success(res, null, "Call ended successfully")
        } catch (error) {
            return ResponseHandler.serverError(res, "Failed to end call", error)
        }
    }

    async getCallStatus(req: Request, res: Response): Promise<any> {
        try {
            const { callSid } = req.params
            if (!callSid) {
                return ResponseHandler.badRequest(
                    res,
                    "Missing callSid parameter"
                )
            }
            const result = await callService.getCallStatus(callSid)
            return ResponseHandler.success(
                res,
                result,
                "Call status retrieved successfully"
            )
        } catch (error) {
            return ResponseHandler.serverError(
                res,
                "Failed to retrieve call status",
                error
            )
        }
    }
}

export const callController = new CallController()
