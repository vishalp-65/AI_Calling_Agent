#!/usr/bin/env node

const { spawn } = require("child_process")
const path = require("path")

console.log("Starting AI Calling Agent in Debug Mode...\n")

// Check if .env file exists
const fs = require("fs")
const envPath = path.join(__dirname, "..", ".env")

if (!fs.existsSync(envPath)) {
    console.log(".env file not found!")
    console.log(
        "Please copy .env.example to .env and configure your settings\n"
    )
    console.log("cp .env.example .env\n")
    process.exit(1)
}

// Set debug environment
process.env.NODE_ENV = "development"
process.env.LOG_LEVEL = "debug"
process.env.SKIP_WEBHOOK_VALIDATION = "true"

console.log("Environment file found")
console.log("Debug mode enabled")
console.log("Webhook validation disabled for development")
console.log("Verbose logging enabled\n")

// Start the application
const child = spawn("npm", ["run", "dev"], {
    stdio: "inherit",
    shell: true,
    cwd: path.join(__dirname, "..")
})

child.on("error", (error) => {
    console.error("❌ Failed to start application:", error)
    process.exit(1)
})

child.on("close", (code) => {
    console.log(`\n🛑 Application exited with code ${code}`)
    process.exit(code)
})

// Handle graceful shutdown
process.on("SIGINT", () => {
    console.log("\n🛑 Shutting down gracefully...")
    child.kill("SIGINT")
})

process.on("SIGTERM", () => {
    console.log("\n🛑 Shutting down gracefully...")
    child.kill("SIGTERM")
})
