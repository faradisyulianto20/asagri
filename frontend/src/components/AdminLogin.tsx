import { useState } from "react";
import type { FormEvent } from "react";
import { Loader2, Lock, ShieldCheck } from "lucide-react";
import { loginAdmin } from "../api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AdminLogin({
  onSuccess,
  onClose,
}: {
  onSuccess: (token: string, username: string) => void;
  onClose: () => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await loginAdmin(username.trim(), password);
      onSuccess(res.token, res.username);
    } catch (err) {
      setError(
        err instanceof Error && err.message === "HTTP 401"
          ? "Username atau password salah"
          : "Gagal login, coba lagi",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader className="items-center text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Lock className="size-6" />
          </span>
          <DialogTitle className="mt-1 text-lg">Login Admin</DialogTitle>
          <DialogDescription>
            Halaman ini hanya untuk admin. Masukkan username &amp; password.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="admin-username">Username (email)</Label>
            <Input
              id="admin-username"
              type="text"
              className="h-10"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="asagri@gmail.com"
              autoComplete="username"
              autoFocus
              disabled={busy}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="admin-password">Password</Label>
            <Input
              id="admin-password"
              type="password"
              className="h-10"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              disabled={busy}
            />
          </div>
          {error && (
            <p className="text-sm font-semibold text-destructive">{error}</p>
          )}
          <Button
            type="submit"
            className="h-10 w-full cursor-pointer"
            disabled={busy}
          >
            {busy ? (
              <>
                <Loader2 className="animate-spin" />
                Memeriksa…
              </>
            ) : (
              <>
                <ShieldCheck />
                Masuk
              </>
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
