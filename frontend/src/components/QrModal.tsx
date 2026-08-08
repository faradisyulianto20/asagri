import { useEffect } from "react";

export function QrModal({
  qr,
  onClose,
}: {
  qr: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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
        <h2>Scan dengan WhatsApp</h2>
        <p className="modal-sub">
          Buka WhatsApp → Menu → Perangkat tertaut → Tautkan perangkat
        </p>
        <img src={qr} alt="WhatsApp QR Code" />
        <p className="modal-note">
          QR berlaku sementara — tutup &amp; buka lagi jika sudah kedaluwarsa.
        </p>
      </div>
    </div>
  );
}
