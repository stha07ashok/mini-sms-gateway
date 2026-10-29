import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  HasMany,
} from "sequelize-typescript";
import { User } from "./user.model.ts";
import { Provider } from "./provider.model.ts";
import { SendAttempt } from "./sendAttempt.model.ts";

export type MessageStatus = "pending" | "sent" | "failed";
export type Encoding = "GSM-7" | "UNICODE";

@Table({ tableName: "messages", timestamps: true })
export class Message extends Model {
  @Column({ type: DataType.INTEGER, autoIncrement: true, primaryKey: true })
  id!: number;

  @ForeignKey(() => User)
  @Column({ type: DataType.INTEGER, allowNull: false })
  userId!: number;

  @Column({ type: DataType.STRING(36), allowNull: false })
  batchId!: string;

  @Column({ type: DataType.STRING(10), allowNull: false })
  recipient!: string;

  @Column({ type: DataType.TEXT, allowNull: false })
  body!: string;

  @Column({ type: DataType.ENUM("GSM-7", "UNICODE"), allowNull: false })
  encoding!: Encoding;

  @Column({ type: DataType.INTEGER, allowNull: false })
  parts!: number;

  @Column({ type: DataType.INTEGER, allowNull: false })
  cost!: number;

  @Column({
    type: DataType.ENUM("pending", "sent", "failed"),
    allowNull: false,
    defaultValue: "pending",
  })
  status!: MessageStatus;

  @ForeignKey(() => Provider)
  @Column({ type: DataType.INTEGER, allowNull: true })
  providerId!: number | null;

  @Column({ type: DataType.STRING(255), allowNull: true })
  failureReason!: string | null;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  refunded!: boolean;

  @Column({ type: DataType.DATE, allowNull: true })
  sentAt!: Date | null;

  // Message belongs to user
  @BelongsTo(() => User)
  user?: User;

  // Message belongs to provider
  @BelongsTo(() => Provider)
  provider?: Provider;

  // Message tracks provider attempts
  @HasMany(() => SendAttempt)
  attempts?: SendAttempt[];
}
