import { useState } from "react";
import {
  Check,
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCw,
  X,
  XCircle,
  Inbox,
} from "lucide-react";
import { toast } from "sonner";
import {
  approveWaRequest,
  rejectWaRequest,
} from "../api";
import type { WaRequest } from "../api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

const STATUS_META = {
  pending: {
    label: "Menunggu",
    icon: Clock3,
    text: "text-warning",
    badge: "bg-warning/10 text-warning",
    empty: "Tidak ada permintaan yang menunggu persetujuan.",
  },
  approved: {
    label: "Disetujui",
    icon: CheckCircle2,
    text: "text-success",
    badge: "bg-success/10 text-success",
    empty: "Belum ada nomor/group yang disetujui.",
  },
  rejected: {
    label: "Ditolak",
    icon: XCircle,
    text: "text-destructive",
    badge: "bg-destructive/10 text-destructive",
    empty: "Tidak ada permintaan yang ditolak.",
  },
} as const;

type StatusKey = keyof typeof STATUS_META;

const ORDER: StatusKey[] = ["pending", "approved", "rejected"];

function RequestCard({
  r,
  busy,
  onDecide,
}: {
  r: WaRequest;
  busy: boolean;
  onDecide: (id: number, kind: "approve" | "reject") => void;
}) {
  return (
    <div className="grid gap-3 rounded-2xl border border-border bg-muted/30 p-3 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="grid gap-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-heading text-[15px] font-bold">{r.name}</span>
        </div>
        <p className="text-sm font-medium text-foreground">{r.number}</p>
        <p className="text-xs text-muted-foreground">
          Diminta {r.created_at ? new Date(r.created_at).toLocaleString("id-ID") : "—"}
          {r.decided_at
            ? ` · Diproses ${new Date(r.decided_at).toLocaleString("id-ID")}${r.decided_by ? ` oleh ${r.decided_by}` : ""}`
            : ""}
        </p>
      </div>
      {r.status === "pending" && (
        <div className="flex gap-2">
          <Button
            variant="default"
            className="h-9 cursor-pointer rounded-full px-3"
            type="button"
            onClick={() => onDecide(r.id, "approve")}
            disabled={busy}
          >
            {busy ? <Loader2 className="animate-spin" /> : <Check />}
            Setujui
          </Button>
          <Button
            variant="outline"
            className="h-9 cursor-pointer rounded-full border-destructive/40 px-3 text-destructive hover:bg-destructive/10 hover:text-destructive"
            type="button"
            onClick={() => onDecide(r.id, "reject")}
            disabled={busy}
          >
            {busy ? <Loader2 className="animate-spin" /> : <X />}
            Tolak
          </Button>
        </div>
      )}
    </div>
  );
}

export function RequestList({
  token,
  requests,
  error,
  loading,
  reload,
}: {
  token: string;
  requests: WaRequest[] | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
}) {
  const [busyId, setBusyId] = useState<number | null>(null);

  const decide = async (id: number, kind: "approve" | "reject") => {
    if (busyId !== null) return;
    setBusyId(id);
    try {
      if (kind === "approve") {
        const res = await approveWaRequest(token, id);
        toast.success(
          res.kind === "group"
            ? `Group ${res.name} disetujui`
            : `Nomor ${res.number} disetujui`,
        );
        if (res.confirmation_sent === false) {
          toast.warning(
            res.kind === "group"
              ? "Disetujui, tapi pesan konfirmasi gagal terkirim ke group tersebut"
              : "Disetujui, tapi pesan konfirmasi gagal terkirim ke nomor tersebut",
          );
        }
      } else {
        const res = await rejectWaRequest(token, id);
        toast.success(`Permintaan ${res.number} ditolak`);
      }
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Aksi gagal");
    } finally {
      setBusyId(null);
    }
  };

  const grouped = Object.fromEntries(
    ORDER.map((k) => [
      k,
      requests?.filter((r) => r.status === k) ?? [],
    ]),
  ) as Record<StatusKey, WaRequest[]>;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Permintaan Nomor WhatsApp</CardTitle>
            <CardDescription className="mt-1">
              Setujui atau tolak permintaan penerima notifikasi (nomor &amp;
              group WhatsApp).
            </CardDescription>
          </div>
          <Button
            variant="outline"
            type="button"
            className="h-8 shrink-0 cursor-pointer rounded-full"
            onClick={reload}
            disabled={loading}
          >
            <RefreshCw className={loading ? "animate-spin" : ""} />
            Muat
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        {error && requests === null && (
          <p className="text-sm font-semibold text-destructive">{error}</p>
        )}

        {requests !== null && requests.length === 0 && (
          <div className="grid place-items-center gap-2 rounded-2xl border border-dashed py-8 text-center text-muted-foreground">
            <Inbox className="size-8 opacity-50" />
            <p className="text-sm">Belum ada permintaan masuk.</p>
          </div>
        )}

        {requests !== null &&
          requests.length > 0 &&
          ORDER.map((key) => {
            const meta = STATUS_META[key];
            const Icon = meta.icon;
            const items = grouped[key];
            const nums = items.filter((r) => r.kind !== "group");
            const groups = items.filter((r) => r.kind === "group");
            return (
              <section key={key} className="grid gap-2">
                <div className="flex items-center gap-2">
                  <Icon className={cn("size-3.5", meta.text)} />
                  <h3
                    className={cn(
                      "text-[11px] font-semibold uppercase tracking-wide",
                      meta.text,
                    )}
                  >
                    {meta.label}
                  </h3>
                  <Badge
                    className={cn(
                      "h-5 rounded-full px-2 text-[11px]",
                      meta.badge,
                    )}
                  >
                    {items.length}
                  </Badge>
                  <span className="h-px flex-1 bg-border" />
                </div>
                {items.length === 0 ? (
                  <p className="rounded-xl border border-dashed px-3 py-2.5 text-xs text-muted-foreground">
                    {meta.empty}
                  </p>
                ) : (
                  <>
                    {nums.length > 0 && (
                      <div className="grid gap-2">
                        <p className="pl-1 text-[11px] font-medium text-muted-foreground">
                          Nomor HP · {nums.length}
                        </p>
                        {nums.map((r) => (
                          <RequestCard
                            key={r.id}
                            r={r}
                            busy={busyId === r.id || busyId !== null}
                            onDecide={decide}
                          />
                        ))}
                      </div>
                    )}
                    {groups.length > 0 && (
                      <div className="grid gap-2">
                        <p className="pl-1 text-[11px] font-medium text-muted-foreground">
                          Group WhatsApp · {groups.length}
                        </p>
                        {groups.map((r) => (
                          <RequestCard
                            key={r.id}
                            r={r}
                            busy={busyId === r.id || busyId !== null}
                            onDecide={decide}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </section>
            );
          })}
      </CardContent>
    </Card>
  );
}
