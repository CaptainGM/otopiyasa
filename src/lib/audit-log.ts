import { AuditLog, AuditAction } from "@/models/AuditLog";


export async function logAudit(params: {
  action: AuditAction;
  actor?: string;
  targetLabel?: string;
  reason?: string;
}): Promise<void> {
  try {
    await AuditLog.create({
      action: params.action,
      actor: params.actor || "system",
      targetLabel: params.targetLabel || "",
      reason: params.reason || "",
    });
  } catch (error) {
    console.error("logAudit failed:", error);
  }
}
