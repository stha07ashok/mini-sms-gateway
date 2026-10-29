import { Table, Column, Model, DataType } from "sequelize-typescript";

// Provider stores SMS route configuration.
// Used by failover and health reporting.
@Table({ tableName: "providers", timestamps: true })
export class Provider extends Model {
  @Column({ type: DataType.INTEGER, autoIncrement: true, primaryKey: true })
  id!: number;

  @Column({ type: DataType.STRING(50), allowNull: false, unique: true })
  code!: string;

  @Column({ type: DataType.STRING(100), allowNull: false })
  name!: string;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 100 })
  priority!: number;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  balance!: number;

  @Column({ type: DataType.FLOAT, allowNull: false, defaultValue: 0 })
  failureRate!: number;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
  isActive!: boolean;
}
