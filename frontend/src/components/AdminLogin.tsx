import { useState } from "react";
import { loginAdmin } from "../api";

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

  const submit = async (e: React.FormEvent) => {
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
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button
          className="modal-close"
          type="button"
          onClick={onClose}
          aria-label="Tutup"
        >
          ✕
        </button>
        <h2>Login Admin</h2>
        <p className="modal-sub">
          Halaman ini hanya untuk admin. Masukkan username &amp; password.
        </p>
        <form onSubmit={submit} className="login-form">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username (email)"
            autoComplete="username"
            autoFocus
            disabled={busy}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            disabled={busy}
          />
          {error && <p className="field-error">{error}</p>}
          <button className="btn" type="submit" disabled={busy}>
            {busy ? "Memeriksa…" : "Masuk"}
          </button>
        </form>
      </div>
    </div>
  );
}
