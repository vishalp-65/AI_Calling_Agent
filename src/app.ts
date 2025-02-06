import express from "express"
import helmet from "helmet"
import compression from "compression"
import cors from "cors"
import http from "http"
const app = express()

// Application middlewares
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Creating HTTP server
const server = http.createServer(app)

export { app, server }
