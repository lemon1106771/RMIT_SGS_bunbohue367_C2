"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { KindIcon } from "@/components/KindIcon";
import { KIND_LABEL, type EntryKind } from "@/lib/cases";

export function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="btn btn-ghost btn-sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          setDone(false);
        }
      }}
    >
      {done ? <><Check size={15} aria-hidden /> Copied</> : <><Copy size={15} aria-hidden /> Copy</>}
    </button>
  );
}

/** A decrypted item of a household case, shown as a copyable field. */
export function SecretView({ kind, text }: { kind: string; title?: string; text: string }) {
  const k = KIND_LABEL[kind as EntryKind];
  return (
    <div className="secret">
      <div className="secret-head">
        <span><KindIcon kind={kind} size={17} />{k ? k.label : kind}</span>
        <CopyButton text={text} />
      </div>
      <pre className="mono secret-body">{text}</pre>
    </div>
  );
}
