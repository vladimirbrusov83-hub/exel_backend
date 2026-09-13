"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/**
 * The ☰ on the client week page. History, Statistics and the passcode used to
 * sit in that header as a pill and an icon; there are more of them now than a
 * 375px row holds next to `‹ Switch`.
 *
 * Closing is explicit on every link: client-side navigation keeps this DOM, so
 * a panel left open would still be open on the page it navigated to. Escape and
 * a tap outside close it too — on a phone the outside tap is the reflex.
 *
 * `z-20` and not the default: the week switcher below is a `.sticky-bar` at
 * `z-index: 10`, and the panel hangs over it.
 */
export default function ClientMenu({
  clientId, hasPasscode,
}: { clientId: string; hasPasscode: boolean }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  const item = "flex min-h-12 items-center gap-3 px-4 text-sm";

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Menu"
        aria-expanded={open}
        className="flex size-11 flex-col items-center justify-center gap-[5px] rounded-full transition-colors hover:bg-white/5"
      >
        {[0, 1, 2].map((i) => (
          <span key={i} aria-hidden className="block h-[2px] w-5 rounded-full bg-white/70" />
        ))}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-20 w-56 overflow-hidden rounded-2xl border border-white/12 bg-surface py-1 shadow-lg">
          <Link href={`/c/${clientId}/history`} onClick={() => setOpen(false)} className={item}>
            <span aria-hidden>🗓</span> History
          </Link>
          <Link href={`/c/${clientId}/stats`} onClick={() => setOpen(false)} className={item}>
            <span aria-hidden>📊</span> Statistics
          </Link>
          <Link href={`/c/${clientId}/passcode`} onClick={() => setOpen(false)} className={item}>
            <span aria-hidden>{hasPasscode ? "🔒" : "🔓"}</span>
            {hasPasscode ? "Change passcode" : "Set a passcode"}
          </Link>
          <Link href="/" onClick={() => setOpen(false)} className={`${item} border-t border-white/10 text-white/60`}>
            <span aria-hidden>👥</span> Switch person
          </Link>
        </div>
      )}
    </div>
  );
}
