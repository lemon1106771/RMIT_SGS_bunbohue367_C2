import { Banknote, FileText, IdCard, MapPin, Stethoscope } from "lucide-react";

/** One icon per kind of sealed item (identity, address, damage, bank). */
export function KindIcon({ kind, size = 20 }: { kind: string; size?: number }) {
  const p = { size, "aria-hidden": true } as const;
  switch (kind) {
    case "identity": return <IdCard {...p} />;
    case "address": return <MapPin {...p} />;
    case "damage": return <Stethoscope {...p} />;
    case "bank": return <Banknote {...p} />;
    default: return <FileText {...p} />;
  }
}
