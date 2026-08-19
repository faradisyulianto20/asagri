import { useState } from "react";
import {
  MessageSquareText,
  QrCode,
  Unplug,
  CheckCircle2,
  XCircle,
  Loader2,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import type { NotifyStatus, WaStatus } from "../api";
import { formatNumber } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function WaCard({
  wa,
  notify,
  admin,
  onScan,
  onDisconnect,
  onTest,
  actions = true,
}: {
  wa: WaStatus | null;
  notify: NotifyStatus | null;
  admin: boolean;
  onScan: () => void;
  onDisconnect: () => Promise<void>;
  onTest: () => Promise<void>;
  actions?: boolean;
}) {
  const connected = Boolean(wa?.connected);
  const starting = Boolean(wa?.starting);
  const hasError = Boolean(wa?.error);
  const [busy, setBusy] = useState<"test" | "disconnect" | null>(null);

  const detail = connected
    ? wa?.number
      ? `Nomor: ${formatNumber(wa.number)}`
      : "Gateway terhubung"
    : hasError
      ? wa?.error
      : starting
        ? "Menghubungkan…"
        : "Scan QR untuk menghubungkan";

  const badge = connected
    ? "Terhubung"
    : starting
      ? "Menghubungi…"
      : hasError
        ? "Error"
        : "Terputus";

  const badgeClass = connected
    ? "shrink-0 bg-green-500/10 text-green-600"
    : starting
      ? "shrink-0 bg-yellow-500/10 text-yellow-600"
      : hasError
        ? "shrink-0 bg-red-500/10 text-red-600"
        : "shrink-0 bg-orange-500/10 text-orange-600";

  const last = notify?.last;
  const lastText = last
    ? `${last.ok ? "Terkirim" : `Gagal: ${last.error || "error"}`} · ${
        last.to?.length || 0
      } nomor · ${new Date(last.at).toLocaleTimeString("id-ID")}`
    : "Belum ada pengiriman tercatat";

  const run = async (kind: "test" | "disconnect") => {
    if (busy) return;
    setBusy(kind);
    try {
      if (kind === "test") {
        await onTest();
        if (admin) toast.success("Pesan uji terkirim");
      } else {
        await onDisconnect();
        if (admin) toast.success("Diputus, QR baru akan muncul…");
      }
    } catch (e) {
      if (admin) {
        toast.error(e instanceof Error ? e.message : "Aksi gagal");
      } else {
        toast.error("Perlu login admin");
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>WhatsApp Gateway</CardTitle>
            <CardDescription className="mt-1">{detail}</CardDescription>
            <CardDescription
              className={
                last && !last.ok
                  ? "mt-1 font-semibold text-destructive"
                  : "mt-1"
              }
            >
              Notifikasi terakhir: {lastText}
            </CardDescription>
          </div>
          <Badge className={badgeClass}>
            {connected ? (
              <CheckCircle2 className="size-3" />
            ) : starting ? (
              <Loader2 className="size-3 animate-spin" />
            ) : hasError ? (
              <XCircle className="size-3" />
            ) : (
              <WifiOff className="size-3" />
            )}
            {badge}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-2">
        {actions ? (
          connected ? (
            <>
              <Button
                variant="default"
                className="h-10 w-full cursor-pointer"
                type="button"
                onClick={() => run("test")}
                disabled={busy !== null}
              >
                <MessageSquareText />
                {busy === "test" ? "Mengirim…" : "Kirim Pesan Uji"}
              </Button>
              <Button
                variant="destructive"
                className="h-10 w-full cursor-pointer bg-destructive text-destructive-foreground hover:bg-destructive/80"
                type="button"
                onClick={() => run("disconnect")}
                disabled={busy !== null}
              >
                <Unplug />
                {busy === "disconnect" ? "Memutus…" : "Putuskan & Ganti Nomor"}
              </Button>
            </>
          ) : (
            <Button
              variant="default"
              className="h-10 w-full cursor-pointer"
              type="button"
              onClick={onScan}
            >
              <QrCode />
              Tampilkan QR
            </Button>
          )
        ) : null}
      </CardContent>
    </Card>
  );
}
