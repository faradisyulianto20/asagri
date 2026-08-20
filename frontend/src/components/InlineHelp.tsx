import { useState } from "react";
import type { ReactNode } from "react";
import { HelpCircle } from "lucide-react";

export function InlineHelp({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-border bg-muted/30">
      <button
        type="button"
        className="flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-left text-xs font-semibold tracking-wide text-muted-foreground transition-colors hover:text-foreground"
        onClick={() => setOpen((o) => !o)}
      >
        <HelpCircle className="size-4 shrink-0 text-primary" />
        {title}
        <span className="ml-auto text-[10px] uppercase">
          {open ? "Sembunyikan" : "Selengkapnya"}
        </span>
      </button>
      {open && (
        <div className="border-t border-border px-4 pb-4 pt-3 text-[13px] leading-relaxed text-muted-foreground">
          {children}
        </div>
      )}
    </div>
  );
}
