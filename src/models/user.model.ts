import {
  Table,
  Column,
  Model,
  DataType,
  HasOne,
  HasMany,
} from "sequelize-typescript";
import { Wallet } from "./wallet.model.ts";
import { Message } from "./message.model.ts";

@Table({ tableName: "users", timestamps: true })
export class User extends Model {
  @Column({ type: DataType.INTEGER, autoIncrement: true, primaryKey: true })
  id!: number;

  @Column({ type: DataType.STRING(100), allowNull: false })
  name!: string;

  @Column({ type: DataType.STRING(150), allowNull: false, unique: true })
  email!: string;

  @Column({ type: DataType.STRING(255), allowNull: false })
  password!: string;

  // User owns wallet relationship
  @HasOne(() => Wallet)
  wallet?: Wallet;

  // User owns many messages
  @HasMany(() => Message)
  messages?: Message[];
}
