import { z } from "zod";

const MAX_MESSAGE_LENGTH = 1600;
const MAX_RECIPIENTS = 100;

// Validates outbound SMS payload.
export const sendSmsSchema = z.object({
  to: z
    .array(z.string(), { message: "`to` must be an array of phone numbers" })
    .min(1, "At least one recipient is required")
    .max(MAX_RECIPIENTS, `At most ${MAX_RECIPIENTS} recipients per request`),
  message: z
    .string()
    .min(1, "Message cannot be empty")
    .max(MAX_MESSAGE_LENGTH, `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters`),
});

// Validates logs query parameters.
export const logsQuerySchema = z.object({
  status: z.enum(["pending", "sent", "failed"]).optional(),
  number: z.string().trim().min(1).optional(),
  from: z.string().trim().min(1).optional(),
  to: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type SendSmsInput = z.infer<typeof sendSmsSchema>;
export type LogsQuery = z.infer<typeof logsQuerySchema>;
