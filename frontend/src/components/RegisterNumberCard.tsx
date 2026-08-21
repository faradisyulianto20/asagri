import { useState } from "react";
import type { FormEvent } from "react";
import {
  BellRing,
  CheckCircle2,
  Clock3,
  Link2,
  Loader2,
  Search,
  Send,
  User,
  UserMinus,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  fetchRequestStatus,
  submitGroupRequest,
  submitNumberRequest,
  unregisterRequest,
} from "../api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const STATUS_META = {
  none: { label: "Belum terdaftar", className: "bg-muted text-muted-foreground" },
  pending: {
    label: "Menunggu persetujuan",
    className: "bg-accent/10 text-accent",
  },
  approved: {
    label: "Disetujui",
    className: "bg-primary/10 text-primary",
  },
  rejected: {
    label: "Ditolak",
    className: "bg-destructive/10 text-destructive",
  },
} as const;

type Mode = "register" | "status";
type ReqType = "number" | "group";

export function RegisterNumberCard() {
  const [mode, setMode] = useState<Mode>("register");
  const [reqType, setReqType] = useState<ReqType>("number");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ status: string; message: string } | null>(null);

  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [link, setLink] = useState("");
  const [checkNumber, setCheckNumber] = useState("");
  const [status, setStatus] = useState<keyof typeof STATUS_META | null>(null);
  const [confirmUnregister, setConfirmUnregister] = useState(false);
  const [unregisterBusy, setUnregisterBusy] = useState(false);

  const copot = async () => {
    if (unregisterBusy || !checkNumber.trim()) return;
    setUnregisterBusy(true);
    try {
      const res = await unregisterRequest(checkNumber.trim());
      toast.success(res.message || "Pendaftaran berhasil dicopot");
      setStatus("none");
      setConfirmUnregister(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal mencopot pendaftaran",
      );
    } finally {
      setUnregisterBusy(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || !name.trim()) return;
    if (reqType === "group" && !link.trim()) return;
    if (reqType === "number" && !number.trim()) return;
    setBusy(true);
    setResult(null);
    try {
      const res =
        reqType === "group"
          ? await submitGroupRequest(name, link)
          : await submitNumberRequest(name, number);
      setResult({ status: res.status, message: res.message });
      toast.success(
        res.status === "approved"
          ? reqType === "group"
            ? "Group sudah terdaftar sebagai penerima"
            : "Nomor sudah terdaftar sebagai penerima"
          : "Permintaan dikirim, menunggu persetujuan admin",
      );
      setName("");
      setNumber("");
      setLink("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal mengirim permintaan";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const check = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || !checkNumber.trim()) return;
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetchRequestStatus(checkNumber);
      setStatus(res.status);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengecek status");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BellRing className="size-4 text-primary" />
              Daftarkan Penerima Notifikasi
            </CardTitle>
            <CardDescription className="mt-1">
              Daftarkan nomor WhatsApp atau group untuk menerima notifikasi
              suhu &amp; kelembaban ruangan.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="grid grid-cols-2 gap-1 rounded-full bg-muted/60 p-1">
          <button
            type="button"
            className={`h-8 cursor-pointer rounded-full text-[13px] font-semibold transition-colors ${
              mode === "register"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => {
              setMode("register");
              setStatus(null);
              setResult(null);
            }}
          >
            Daftar
          </button>
          <button
            type="button"
            className={`h-8 cursor-pointer rounded-full text-[13px] font-semibold transition-colors ${
              mode === "status"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => {
              setMode("status");
              setStatus(null);
              setResult(null);
            }}
          >
            Cek Status
          </button>
        </div>

        {mode === "register" ? (
          <form onSubmit={submit} className="grid gap-3">
            <div className="grid grid-cols-2 gap-1 rounded-full bg-muted/60 p-1">
              <button
                type="button"
                className={`flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-full text-[13px] font-semibold transition-colors ${
                  reqType === "number"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => {
                  setReqType("number");
                  setResult(null);
                }}
              >
                <User className="size-3.5" />
                Nomor
              </button>
              <button
                type="button"
                className={`flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-full text-[13px] font-semibold transition-colors ${
                  reqType === "group"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => {
                  setReqType("group");
                  setResult(null);
                }}
              >
                <Users className="size-3.5" />
                Group
              </button>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="req-name">
                {reqType === "group" ? "Nama Group" : "Nama"}
              </Label>
              <div className="relative">
                <User className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="req-name"
                  className="h-10 pl-9"
                  placeholder={reqType === "group" ? "Nama group Anda" : "Nama Anda"}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            </div>

            {reqType === "number" ? (
              <div className="grid gap-2">
                <Label htmlFor="req-number">Nomor WhatsApp</Label>
                <Input
                  id="req-number"
                  className="h-10"
                  placeholder="6281234567890"
                  inputMode="numeric"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Format internasional tanpa tanda + dan tanpa awalan 0.
                </p>
              </div>
            ) : (
              <div className="grid gap-2">
                <Label htmlFor="req-link">Link Undangan Group</Label>
                <div className="relative">
                  <Link2 className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="req-link"
                    className="h-10 pl-9"
                    placeholder="https://chat.whatsapp.com/xxxxxxxx"
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Di WhatsApp: buka group → Info → Undang lewat link →
                  Salin tautan.
                </p>
              </div>
            )}
            <Button
              type="submit"
              className="h-10 w-full cursor-pointer"
              disabled={busy}
            >
              {busy ? (
                <>
                  <Loader2 className="animate-spin" />
                  Mengirim…
                </>
              ) : (
                <>
                  <Send />
                  Kirim Permintaan
                </>
              )}
            </Button>
          </form>
        ) : (
          <form onSubmit={check} className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="check-number">Nomor / ID Group</Label>
              <Input
                id="check-number"
                className="h-10"
                placeholder="6281234567890 atau 120363…@g.us"
                value={checkNumber}
                onChange={(e) => setCheckNumber(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Masukkan nomor atau ID group yang pernah didaftarkan untuk
                melihat statusnya.
              </p>
            </div>
            <Button
              type="submit"
              className="h-10 w-full cursor-pointer"
              disabled={busy}
            >
              {busy ? (
                <>
                  <Loader2 className="animate-spin" />
                  Mengecek…
                </>
              ) : (
                <>
                  <Search />
                  Cek Status
                </>
              )}
            </Button>
          </form>
        )}

        {result && (
          <p className="flex items-start gap-2 rounded-xl bg-primary/10 p-3 text-[13px] font-medium text-primary">
            {result.status === "approved" ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            ) : (
              <Clock3 className="mt-0.5 size-4 shrink-0" />
            )}
            {result.message}
          </p>
        )}

        {status && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-muted/40 p-3 text-[13px]">
            <span className="text-muted-foreground">Status:</span>
            <Badge className={`h-6 rounded-full px-2.5 ${STATUS_META[status].className}`}>
              {status === "approved" && <CheckCircle2 className="size-3" />}
              {status === "pending" && <Clock3 className="size-3" />}
              {status === "rejected" && <XCircle className="size-3" />}
              {STATUS_META[status].label}
            </Badge>
            {status === "rejected" && (
              <span className="text-xs text-muted-foreground">
                — silakan hubungi admin, atau daftarkan ulang.
              </span>
            )}
            {(status === "approved" || status === "pending") && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="ml-auto h-7 cursor-pointer rounded-full border-destructive/40 px-3 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={unregisterBusy}
                onClick={() => setConfirmUnregister(true)}
              >
                <UserMinus />
                {status === "approved" ? "Copot Pendaftaran" : "Batalkan Permintaan"}
              </Button>
            )}
          </div>
        )}

        <Dialog open={confirmUnregister} onOpenChange={setConfirmUnregister}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>
                {status === "approved"
                  ? "Copot pendaftaran nomor ini?"
                  : "Batalkan permintaan pendaftaran?"}
              </DialogTitle>
              <DialogDescription>
                {status === "approved"
                  ? `${checkNumber.trim()} tidak akan lagi menerima notifikasi suhu & kelembaban ruangan.`
                  : `${checkNumber.trim()} tidak akan diproses oleh admin.`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="cursor-pointer"
                onClick={() => setConfirmUnregister(false)}
                disabled={unregisterBusy}
              >
                Batal
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="cursor-pointer"
                onClick={copot}
                disabled={unregisterBusy}
              >
                {unregisterBusy ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Memproses…
                  </>
                ) : status === "approved" ? (
                  "Ya, Copot"
                ) : (
                  "Ya, Batalkan"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
