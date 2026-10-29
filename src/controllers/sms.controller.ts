import { asyncHandler } from "../utils/asyncHandler.ts";
import { currentUserId } from "../middlewares/auth.middleware.ts";
import { sendSms } from "../services/sms.service.ts";
import { getMessageLogs } from "../services/report.service.ts";
import type { SendSmsInput, LogsQuery } from "../validators/sms.validator.ts";

// Routes SMS send request to service layer.
export const send = asyncHandler(async (req, res) => {
  const { to, message } = req.body as SendSmsInput;
  const result = await sendSms(currentUserId(req), to, message);
  res.json({ success: true, ...result });
});

// Reads validated query and returns message logs.
export const logs = asyncHandler(async (req, res) => {

  const query = res.locals.query as LogsQuery;

  const result = await getMessageLogs(currentUserId(req), {
    status: query.status,
    number: query.number,
    from: query.from,
    to: query.to,
    page: query.page,
    limit: query.limit,
  });

  res.json({ success: true, ...result });
});
