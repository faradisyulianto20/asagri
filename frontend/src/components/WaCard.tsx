import { useState } from "react";
import { MessageSquareText, QrCode, Unplug, CheckCircle2, XCircle } from "lucide-react";
import type { NotifyStatus, WaStatus } from "../api";
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
}: {
  wa: WaStatus | null;
  notify: NotifyStatus | null;
  admin: boolean;
  onScan: () => void;
  onDisconnect: () => Promise<void>;
  onTest: () => Promise<void>;
}) {
  const connected = Boolean(wa?.connected);
  const [busy, setBusy] = useState<"test" | "disconnect" | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const detail = connected
    ? wa?.number
      ? `Nomor: ${wa.number}`
      : "Gateway terhubung"
    : wa?.error || "Scan QR untuk menghubungkan";

  const badge = connected
    ? "Terhubung"
    : wa?.starting
      ? "Menghubungi…"
      : "Belum terhubung";

  const last = notify?.last;
  const lastText = last
    ? `${last.ok ? "Terkirim" : `Gagal: ${last.error || "error"}`} · ${
        last.to?.length || 0
      } nomor · ${new Date(last.at).toLocaleTimeString("id-ID")}`
    : "Belum ada pengiriman tercatat";

  const run = async (kind: "test" | "disconnect") => {
    if (busy) return;
    setBusy(kind);
    setFeedback(null);
    try {
      if (kind === "test") {
        await onTest();
        if (admin) setFeedback("Pesan uji dikirim.");
      } else {
        await onDisconnect();
        if (admin) setFeedback("Diputus, QR baru akan muncul…");
      }
    } catch (e) {
      setFeedback(
        admin
          ? e instanceof Error
            ? e.message
            : "Aksi gagal"
          : "Perlu login admin",
      );
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
          <Badge
            className={
              connected
                ? "shrink-0 bg-primary/10 text-primary"
                : "shrink-0 bg-accent/10 text-accent"
            }
          >
            {connected ? (
              <CheckCircle2 className="size-3" />
            ) : (
              <XCircle className="size-3" />
            )}
            {badge}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-2">
        {connected ? (
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
        )}
        {feedback && (
          <p className="mt-1 text-xs font-semibold text-primary">
            {feedback}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
