import { CircleCheck, FileText, Lock } from "lucide-react";
import { STATUS_LABEL, type CaseStatus } from "@/lib/cases";

const ICON = { submitted: Lock, proposed: FileText, paid: CircleCheck } as const;

export function StatusChip({ status }: { status: CaseStatus }) {
  const s = STATUS_LABEL[status] ?? STATUS_LABEL.submitted;
  const Icon = ICON[status] ?? Lock;
  return (
    <span className={`status status-${status}`}>
      <Icon size={14} aria-hidden />
      {s.label}
    </span>
  );
}
