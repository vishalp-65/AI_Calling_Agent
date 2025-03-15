import { Request, Response } from "express"
import { logger } from "../utils/logger"
import { TwilioService } from "../services/call/twilio.service"
import { realTimeAudioService } from "../services/call/realtime-audio.service"
import { OpenAIService } from "../services/ai/openai.service"
import { SpeechService } from "../services/call/speech.service"
import twilio from "twilio"

export class WebhookController {
    private twilioService: TwilioService
    private openAIService: OpenAIService
    private speechService: SpeechService

    constructor() {
        this.twilioService = new TwilioService()
        this.openAIService = new OpenAIService()
        this.speechService = new SpeechService()
    }

    // Handle incoming call webhook
    async handleIncomingCall(req: Request, res: Response): Promise<void> {
        try {
            const callSid = req.body.CallSid
            const from = req.body.From
            const to = req.body.To
            const direction = req.body.Direction

            logger.info(`Incoming call webhook: ${callSid} from ${from} to ${to}`)

            const twiml = new twilio.twiml.VoiceResponse()
            
            // Auto-answer the call
            twiml.say({
                voice: 'alice' as any,
                language: 'en-US' as any
            }, 'Hello! You have reached our AI assistant. How can I help you today?')

            // Start media stream for real-time processing
            const start = twiml.start()
            start.stream({
                url: `wss://${req.get('host')}/api/calls/media-stream`,
                name: callSid
            })

            // Use gather to collect user input
            const gather = twiml.gather({
                input: ['speech'],
                timeout: 5,
                speechTimeout: 'auto',
                enhanced: true,
                speechModel: 'phone_call',
                action: `/api/calls/webhook/gather`,
                method: 'POST'
            })

            gather.say('I\'m listening...')

            // If no input, redirect to gather again
            twiml.redirect('/api/calls/webhook/voice')

            res.type('text/xml').send(twiml.toString())
            
        } catch (error) {
            logger.error('Error handling incoming call:', error)
            const twiml = new twilio.twiml.VoiceResponse()
            twiml.say('I apologize, but I\'m experiencing technical difficulties. Please try again later.')
            twiml.hangup()
            res.type('text/xml').send(twiml.toString())
        }
    }

    // Handle outgoing call webhook
    async handleOutgoingCall(req: Request, res: Response): Promise<void> {
        try {
            const callSid = req.body.CallSid
            const callStatus = req.body.CallStatus

            logger.info(`Outgoing call webhook: ${callSid}, status: ${callStatus}`)

            const twiml = new twilio.twiml.VoiceResponse()

            if (callStatus === 'answered') {
                // Wait for user to pick up, then start conversation
                twiml.pause({ length: 2 })
                twiml.say({
                    voice: 'alice' as any,
                    language: 'en-US' as any
                }, 'Hello! This is your AI assistant calling. How can I help you today?')

                // Start media stream for real-time processing
                const start = twiml.start()
                start.stream({
                    url: `wss://${req.get('host')}/api/calls/media-stream`,
                    name: callSid
                })

                // Use gather to collect user input
                const gather = twiml.gather({
                    input: ['speech'],
                    timeout: 5,
                    speechTimeout: 'auto',
                    enhanced: true,
                    speechModel: 'phone_call',
                    action: `/api/calls/webhook/gather`,
                    method: 'POST'
                })

                gather.say('I\'m listening...')
                twiml.redirect('/api/calls/webhook/voice')
            }

            res.type('text/xml').send(twiml.toString())
            
        } catch (error) {
            logger.error('Error handling outgoing call:', error)
            const twiml = new twilio.twiml.VoiceResponse()
            twiml.say('I apologize, but I\'m experiencing technical difficulties.')
            twiml.hangup()
            res.type('text/xml').send(twiml.toString())
        }
    }

    // Handle speech input from user
    async handleSpeechInput(req: Request, res: Response): Promise<void> {
        try {
            const callSid = req.body.CallSid
            const speechResult = req.body.SpeechResult
            const confidence = req.body.Confidence

            logger.info(`Speech input for call ${callSid}: ${speechResult} (confidence: ${confidence})`)

            if (!speechResult || speechResult.trim().length === 0) {
                // No speech detected, ask again
                const twiml = new twilio.twiml.VoiceResponse()
                twiml.say('I didn\'t catch that. Could you please repeat?')
                twiml.redirect('/api/calls/webhook/voice')
                res.type('text/xml').send(twiml.toString())
                return
            }

            // Generate AI response
            const aiResponse = await this.openAIService.generateResponse(speechResult, {
                callSid,
                confidence: parseFloat(confidence) || 0
            })

            // Convert AI response to speech
            const audioBuffer = await this.speechService.convertTextToSpeech({
                text: aiResponse.message,
                voice: 'alloy',
                speed: 1.0
            })

            const twiml = new twilio.twiml.VoiceResponse()
            
            // Play AI response
            twiml.say({
                voice: 'alice' as any,
                language: 'en-US' as any
            }, aiResponse.message)

            // Check if we should transfer to human
            if (aiResponse.shouldTransfer) {
                twiml.say('Let me transfer you to a human agent.')
                // Implement transfer logic here
                twiml.dial('+1234567890') // Replace with actual transfer number
            } else {
                // Continue conversation
                const gather = twiml.gather({
                    input: ['speech'],
                    timeout: 5,
                    speechTimeout: 'auto',
                    enhanced: true,
                    speechModel: 'phone_call',
                    action: `/api/calls/webhook/gather`,
                    method: 'POST'
                })

                gather.say('Is there anything else I can help you with?')
                twiml.redirect('/api/calls/webhook/voice')
            }

            res.type('text/xml').send(twiml.toString())
            
        } catch (error) {
            logger.error('Error handling speech input:', error)
            const twiml = new twilio.twiml.VoiceResponse()
            twiml.say('I apologize, but I\'m having trouble processing your request. Please try again.')
            twiml.redirect('/api/calls/webhook/voice')
            res.type('text/xml').send(twiml.toString())
        }
    }

    // Handle call status updates
    async handleCallStatus(req: Request, res: Response): Promise<void> {
        try {
            const callSid = req.body.CallSid
            const callStatus = req.body.CallStatus
            const duration = req.body.Duration

            logger.info(`Call status update: ${callSid}, status: ${callStatus}, duration: ${duration}`)

            await this.twilioService.handleWebhook(req.body)

            // If call ended, clean up real-time processing
            if (callStatus === 'completed' || callStatus === 'failed' || callStatus === 'no-answer') {
                await realTimeAudioService.endCall(callSid)
            }

            res.status(200).send('OK')
            
        } catch (error) {
            logger.error('Error handling call status:', error)
            res.status(500).send('Internal Server Error')
        }
    }

    // Handle media stream WebSocket connection
    async handleMediaStream(ws: any, req: Request): Promise<void> {
        try {
            const callSid = req.params.callSid || 'unknown'
            
            logger.info(`Media stream WebSocket connected for call ${callSid}`)

            // Create a readable stream from WebSocket messages
            const { Readable } = require('stream')
            const audioStream = new Readable({
                read() {}
            })

            ws.on('message', (message: string) => {
                try {
                    const data = JSON.parse(message)
                    
                    if (data.event === 'media' && data.media && data.media.payload) {
                        // Decode base64 audio data
                        const audioData = Buffer.from(data.media.payload, 'base64')
                        audioStream.push(audioData)
                    }
                    
                    if (data.event === 'stop') {
                        audioStream.push(null) // End the stream
                    }
                } catch (error) {
                    logger.error('Error processing WebSocket message:', error)
                }
            })

            ws.on('close', () => {
                logger.info(`Media stream WebSocket closed for call ${callSid}`)
                audioStream.push(null)
            })

            ws.on('error', (error: Error) => {
                logger.error(`Media stream WebSocket error for call ${callSid}:`, error)
                audioStream.destroy(error)
            })

            // Start real-time audio processing
            await realTimeAudioService.startRealTimeProcessing(callSid, audioStream)
            
        } catch (error) {
            logger.error('Error handling media stream:', error)
            ws.close()
        }
    }

    // Handle recording completion
    async handleRecordingComplete(req: Request, res: Response): Promise<void> {
        try {
            const callSid = req.body.CallSid
            const recordingUrl = req.body.RecordingUrl

            logger.info(`Recording completed for call ${callSid}: ${recordingUrl}`)

            // Process the recording if needed
            // This is for backup/analytics purposes since we're doing real-time processing

            res.status(200).send('OK')
            
        } catch (error) {
            logger.error('Error handling recording completion:', error)
            res.status(500).send('Internal Server Error')
        }
    }
}

export const webhookController = new WebhookController()
