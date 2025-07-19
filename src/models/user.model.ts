import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn
} from "typeorm"

@Entity("users")
export class User {
    @PrimaryGeneratedColumn("uuid")
    id: string

    @Column({ unique: true })
    email: string

    @Column()
    password: string

    @Column()
    name: string

    @Column({ default: "user" })
    role: string

    @Column({ default: true })
    isActive: boolean

    @Column({ nullable: true })
    lastLoginAt: Date

    @CreateDateColumn()
    createdAt: Date

    @UpdateDateColumn()
    updatedAt: Date
}

export interface UserDTO {
    id: string
    email: string
    name: string
    role: string
    isActive: boolean
}

export const toUserDTO = (user: User): UserDTO => {
    return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive
    }
}
