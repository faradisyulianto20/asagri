import { useState } from "react";
import { Loader2, Send, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { sendMobileNotify } from "../api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function MobilePushPanel({ token }: { token: string }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastSent, setLastSent] = useState<{ id: string; at: string } | null>(null);

  const send = async () => {
    if (busy || !title.trim() || !body.trim()) return;
    setBusy(true);
    try {
      const result = await sendMobileNotify(token, title.trim(), body.trim());
      setLastSent({ id: result.id, at: new Date().toLocaleString("id-ID") });
      setTitle("");
      setBody("");
      toast.success("Notifikasi terkirim ke mobile");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Gagal mengirim: ${msg}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
          <Smartphone className="size-5 text-primary" />
        </div>
        <div>
          <h3 className="font-heading text-lg font-bold">Kirim ke Mobile</h3>
          <p className="text-sm text-muted-foreground">
            Kirim notifikasi push langsung ke aplikasi Asagri Monitor.
          </p>
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <div className="space-y-2">
          <Label htmlFor="push-title" className="text-xs uppercase text-muted-foreground">
            Judul
          </Label>
          <Input
            id="push-title"
            placeholder="Contoh: Simulasi Push"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="push-body" className="text-xs uppercase text-muted-foreground">
            Pesan
          </Label>
          <Textarea
            id="push-body"
            placeholder="Isi notifikasi yang akan muncul di mobile..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            maxLength={500}
          />
          <p className="text-xs text-muted-foreground">
            {body.length}/500 karakter
          </p>
        </div>

        <Button
          type="button"
          className="h-10 w-full cursor-pointer"
          onClick={send}
          disabled={busy || !title.trim() || !body.trim()}
        >
          {busy ? (
            <>
              <Loader2 className="animate-spin" />
              Mengirim...
            </>
          ) : (
            <>
              <Send />
              Kirim ke Mobile
            </>
          )}
        </Button>
      </div>

      {lastSent && (
        <div className="rounded-2xl border border-primary/40 bg-primary/10 p-4">
          <p className="text-sm font-medium text-primary">
            Terkirim pada {lastSent.at}
          </p>
          <p className="mt-1 text-xs text-primary/70">
            Mobile akan menerima notifikasi pada polling berikutnya (~5 detik).
          </p>
        </div>
      )}
    </div>
  );
}
