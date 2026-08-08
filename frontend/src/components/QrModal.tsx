import { QrCode, Smartphone } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function QrModal({
  qr,
  onClose,
}: {
  qr: string;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md text-center">
        <DialogHeader className="items-center text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            <QrCode className="size-6" />
          </span>
          <DialogTitle className="mt-1 text-lg">Scan dengan WhatsApp</DialogTitle>
          <DialogDescription className="mx-auto max-w-xs">
            Buka WhatsApp → Menu → Perangkat tertaut → Tautkan perangkat
          </DialogDescription>
        </DialogHeader>
        <div className="mx-auto w-fit rounded-2xl border border-border bg-white p-3 shadow-sm">
          <img
            src={qr}
            alt="WhatsApp QR Code"
            className="h-auto w-72 max-w-full rounded-xl"
          />
        </div>
        <p className="mx-auto max-w-xs flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Smartphone className="size-4 shrink-0" />
          QR berlaku sementara — tutup &amp; buka lagi jika sudah kedaluwarsa.
        </p>
      </DialogContent>
    </Dialog>
  );
}
