import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export interface TourStep {
  target: string;
  title: string;
  content: ReactNode;
  placement?: "top" | "bottom" | "left" | "right";
}

interface CoachmarkTourProps {
  steps: TourStep[];
  active: boolean;
  onClose: () => void;
}

const GAP = 12;

function getRect(el: Element) {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height, bottom: r.bottom, right: r.right };
}

function computeTooltipPos(
  target: Element,
  placement: "top" | "bottom" | "left" | "right",
) {
  const r = getRect(target);
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const tipW = 340;
  const tipH = 220;

  let top = 0;
  let left = 0;
  let actual = placement;

  if (placement === "bottom") {
    top = r.bottom + GAP;
    left = r.left + r.width / 2 - tipW / 2;
    if (top + tipH > vh - 16) actual = "top";
  }
  if (placement === "top") {
    top = r.top - GAP - tipH;
    left = r.left + r.width / 2 - tipW / 2;
    if (top < 16) actual = "bottom";
  }
  if (actual === "bottom") {
    top = r.bottom + GAP;
    left = r.left + r.width / 2 - tipW / 2;
  }
  if (actual === "top") {
    top = r.top - GAP - tipH;
    left = r.left + r.width / 2 - tipW / 2;
  }

  left = Math.max(16, Math.min(left, vw - tipW - 16));
  top = Math.max(16, Math.min(top, vh - tipH - 16));

  return { top, left, actual };
}

export function CoachmarkTour({ steps, active, onClose }: CoachmarkTourProps) {
  const [step, setStep] = useState(0);
  const [pos, setPos] = useState<{ top: number; left: number; placement: string } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const current = steps[step];

  const reposition = useCallback(() => {
    if (!current) return;
    const el = document.querySelector(current.target);
    if (!el) return;

    el.scrollIntoView({ behavior: "instant", block: "center" });

    requestAnimationFrame(() => {
      const p = computeTooltipPos(el, current.placement ?? "bottom");
      setPos({ top: p.top, left: p.left, placement: p.actual });
    });
  }, [current]);

  useEffect(() => {
    if (!active) return;
    reposition();
    const onResize = () => reposition();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [active, step, reposition]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setStep((s) => Math.min(s + 1, steps.length - 1));
      if (e.key === "ArrowLeft") setStep((s) => Math.max(s - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, steps.length, onClose]);

  useEffect(() => {
    setStep(0);
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [active]);

  if (!active || !current) return null;

  const targetEl = document.querySelector(current.target);
  const isFirst = step === 0;
  const isLast = step === steps.length - 1;

  return (
    <div className="fixed inset-0 z-50">
      {/* Dark overlay — skip the cutout hole */}
      {targetEl && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ zIndex: 50 }}
        >
          {/* Top strip */}
          <div
            className="absolute inset-x-0 top-0 bg-black/60"
            style={{ height: getRect(targetEl).top }}
          />
          {/* Bottom strip */}
          <div
            className="absolute inset-x-0 bottom-0 bg-black/60"
            style={{ top: getRect(targetEl).bottom }}
          />
          {/* Left strip */}
          <div
            className="absolute bg-black/60"
            style={{
              top: getRect(targetEl).top,
              height: getRect(targetEl).height,
              left: 0,
              width: getRect(targetEl).left,
            }}
          />
          {/* Right strip */}
          <div
            className="absolute bg-black/60"
            style={{
              top: getRect(targetEl).top,
              height: getRect(targetEl).height,
              left: getRect(targetEl).right,
              right: 0,
            }}
          />
        </div>
      )}

      {/* Cutout ring around target */}
      {targetEl && (
        <div
          className="absolute pointer-events-none rounded-xl"
          style={{
            top: getRect(targetEl).top - 4,
            left: getRect(targetEl).left - 4,
            width: getRect(targetEl).width + 8,
            height: getRect(targetEl).height + 8,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0)",
            border: "2px solid rgba(139,92,246,0.8)",
            zIndex: 51,
            transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)",
          }}
        />
      )}

      {/* Tooltip bubble */}
      {pos && (
        <div
          ref={tooltipRef}
          className="absolute z-[52] w-[340px] rounded-2xl border border-border bg-popover p-0 shadow-xl animate-in fade-in-0 zoom-in-95 duration-200"
          style={{ top: pos.top, left: pos.left }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                {step + 1}
              </span>
              <span className="text-sm font-bold text-foreground">
                {current.title}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex size-7 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Body */}
          <div className="px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
            {current.content}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <span className="text-xs text-muted-foreground">
              {step + 1} / {steps.length}
            </span>
            <div className="flex items-center gap-2">
              {!isFirst && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 cursor-pointer rounded-full px-3"
                  onClick={() => setStep((s) => s - 1)}
                >
                  <ChevronLeft className="size-3.5" />
                  Prev
                </Button>
              )}
              {isLast ? (
                <Button
                  type="button"
                  size="sm"
                  className="h-8 cursor-pointer rounded-full px-4"
                  onClick={onClose}
                >
                  Got It ✓
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  className="h-8 cursor-pointer rounded-full px-3"
                  onClick={() => setStep((s) => s + 1)}
                >
                  Next
                  <ChevronRight className="size-3.5" />
                </Button>
              )}
            </div>
          </div>

          {/* Skip link */}
          {!isLast && (
            <div className="border-t border-border px-4 py-2 text-center">
              <button
                type="button"
                onClick={onClose}
                className="cursor-pointer text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Lewati tour
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
