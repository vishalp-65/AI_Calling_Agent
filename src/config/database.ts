import { DataSource } from "typeorm"
import { config } from "./index"
import { Call } from "../models/entities/Call.entity"
import { Customer } from "../models/entities/Customer.entity"
import { Agent } from "../models/entities/Agent.entity"
import { Knowledge } from "../models/entities/Knowledge.entity"
import { CallSession } from "../models/entities/CallSession.entity"

export const AppDataSource = new DataSource({
    type: "postgres",
    host: config.database.host,
    port: config.database.port,
    username: config.database.user,
    password: config.database.password,
    database: config.database.name,
    synchronize: config.env === "development",
    // logging: config.env === "development",
    entities: [Call, Customer, Agent, Knowledge, CallSession],
    migrations: ["src/database/migrations/*.ts"],
    subscribers: ["src/database/subscribers/*.ts"],
    ssl: { rejectUnauthorized: false },
    extra: {
        max: 20,
        min: 5,
        acquireTimeoutMillis: 30000,
        idleTimeoutMillis: 30000
    }
})
