import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
} from "sequelize-typescript";
import { User } from "./user.model.ts";
import { Message } from "./message.model.ts";

export type CreditEntryType = "signup" | "debit" | "refund";

// CreditTransaction records wallet movement history.
// Connected to User and Message entries.
@Table({ tableName: "credit_transactions", timestamps: true })
export class CreditTransaction extends Model {
  @Column({ type: DataType.INTEGER, autoIncrement: true, primaryKey: true })
  id!: number;

  @ForeignKey(() => User)
  @Column({ type: DataType.INTEGER, allowNull: false })
  userId!: number;

  @ForeignKey(() => Message)
  @Column({ type: DataType.INTEGER, allowNull: true })
  messageId!: number | null;

  @Column({
    type: DataType.ENUM("signup", "debit", "refund"),
    allowNull: false,
  })
  type!: CreditEntryType;

  @Column({ type: DataType.INTEGER, allowNull: false })
  amount!: number;

  @Column({ type: DataType.INTEGER, allowNull: false })
  balanceAfter!: number;

  @Column({ type: DataType.STRING(100), allowNull: true })
  reference!: string | null;

  @BelongsTo(() => User)
  user?: User;

  @BelongsTo(() => Message)
  message?: Message;
}
