import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
} from "sequelize-typescript";
import { User } from "./user.model.ts";

// Wallet stores user credit balance.
// Related to User and CreditTransaction.
@Table({ tableName: "wallets", timestamps: true })
export class Wallet extends Model {
  @Column({ type: DataType.INTEGER, autoIncrement: true, primaryKey: true })
  id!: number;

  @ForeignKey(() => User)
  @Column({ type: DataType.INTEGER, allowNull: false, unique: true })
  userId!: number;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  credits!: number;

  @BelongsTo(() => User)
  user?: User;
}
