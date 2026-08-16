import { useCallback, useEffect, useState } from "react";
import {
  Check,
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCw,
  Users,
  X,
  XCircle,
  Inbox,
} from "lucide-react";
import { toast } from "sonner";
import {
  approveWaRequest,
  fetchWaRequests,
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

const STATUS_META = {
  pending: { label: "Menunggu", className: "bg-accent/10 text-accent" },
  approved: { label: "Disetujui", className: "bg-primary/10 text-primary" },
  rejected: { label: "Ditolak", className: "bg-destructive/10 text-destructive" },
} as const;

export function RequestList({ token }: { token: string }) {
  const [requests, setRequests] = useState<WaRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(() => {
    fetchWaRequests(token)
      .then(setRequests)
      .catch((e) => {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        toast.error(`Gagal memuat permintaan: ${msg}`);
      });
  }, [token]);

  useEffect(() => {
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, [load]);

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
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Aksi gagal");
    } finally {
      setBusyId(null);
    }
  };

  const pendingCount = requests?.filter((r) => r.status === "pending").length ?? 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              Permintaan Nomor WhatsApp
              {pendingCount > 0 && (
                <Badge className="h-6 rounded-full bg-accent/10 px-2.5 text-accent">
                  {pendingCount} menunggu
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="mt-1">
              Setujui atau tolak permintaan penerima notifikasi (nomor &amp;
              group WhatsApp).
            </CardDescription>
          </div>
          <Button
            variant="outline"
            type="button"
            className="h-8 shrink-0 cursor-pointer rounded-full"
            onClick={load}
            disabled={requests === null}
          >
            <RefreshCw className={requests === null ? "animate-spin" : ""} />
            Muat
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-2">
        {error && requests === null && (
          <p className="text-sm font-semibold text-destructive">{error}</p>
        )}

        {requests !== null && requests.length === 0 && (
          <div className="grid place-items-center gap-2 rounded-2xl border border-dashed py-8 text-center text-muted-foreground">
            <Inbox className="size-8 opacity-50" />
            <p className="text-sm">Belum ada permintaan masuk.</p>
          </div>
        )}

        {requests?.map((r) => (
          <div
            key={r.id}
            className="grid gap-3 rounded-2xl border border-border bg-muted/30 p-3 sm:grid-cols-[1fr_auto] sm:items-center"
          >
            <div className="grid gap-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-heading text-[15px] font-bold">
                  {r.name}
                </span>
                {r.kind === "group" && (
                  <Badge className="h-6 gap-1 rounded-full bg-secondary/10 px-2.5 text-secondary">
                    <Users className="size-3" />
                    Group
                  </Badge>
                )}
                <Badge className={`h-6 rounded-full px-2.5 ${STATUS_META[r.status].className}`}>
                  {r.status === "approved" && <CheckCircle2 className="size-3" />}
                  {r.status === "pending" && <Clock3 className="size-3" />}
                  {r.status === "rejected" && <XCircle className="size-3" />}
                  {STATUS_META[r.status].label}
                </Badge>
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
                  onClick={() => decide(r.id, "approve")}
                  disabled={busyId !== null}
                >
                  {busyId === r.id ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Check />
                  )}
                  Setujui
                </Button>
                <Button
                  variant="outline"
                  className="h-9 cursor-pointer rounded-full border-destructive/40 px-3 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  type="button"
                  onClick={() => decide(r.id, "reject")}
                  disabled={busyId !== null}
                >
                  {busyId === r.id ? <Loader2 className="animate-spin" /> : <X />}
                  Tolak
                </Button>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
