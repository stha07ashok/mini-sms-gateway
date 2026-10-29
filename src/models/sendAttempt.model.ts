import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
} from "sequelize-typescript";
import { Message } from "./message.model.ts";
import { Provider } from "./provider.model.ts";

// SendAttempt tracks each route attempt.
// Related to Message and Provider records.
@Table({ tableName: "send_attempts", timestamps: true })
export class SendAttempt extends Model {
  @Column({ type: DataType.INTEGER, autoIncrement: true, primaryKey: true })
  id!: number;

  @ForeignKey(() => Message)
  @Column({ type: DataType.INTEGER, allowNull: false })
  messageId!: number;

  @ForeignKey(() => Provider)
  @Column({ type: DataType.INTEGER, allowNull: false })
  providerId!: number;

  @Column({ type: DataType.BOOLEAN, allowNull: false })
  success!: boolean;

  @Column({ type: DataType.STRING(255), allowNull: true })
  error!: string | null;

  @BelongsTo(() => Message)
  message?: Message;

  @BelongsTo(() => Provider)
  provider?: Provider;
}
