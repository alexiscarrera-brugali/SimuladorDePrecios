"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { X } from "lucide-react";

export interface TourStep {
  /** Selector del elemento a resaltar; si falta, el paso se muestra centrado. */
  target?: string;
  title: string;
  body: string;
}

/**
 * Tour de onboarding con spotlight sobre el elemento objetivo y un tooltip con
 * navegación por pasos. No bloquea la lógica de la app: sólo guía. "Saltar" y
 * Esc cierran en cualquier momento.
 */
export function Tour({ steps, onClose }: { steps: TourStep[]; onClose: () => void }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = steps[i];
  const last = i === steps.length - 1;

  const measure = useCallback(() => {
    if (!step?.target) { setRect(null); return; }
    const el = document.querySelector(step.target);
    if (!el) { setRect(null); return; }
    const r = el.getBoundingClientRect();
    // Si el objetivo está oculto o fuera de pantalla (p.ej. el sidebar como
    // drawer cerrado en mobile), el paso cae a centrado.
    const offscreen = r.width === 0 || r.height === 0 || r.right < 0 || r.left > window.innerWidth || r.bottom < 0 || r.top > window.innerHeight;
    if (offscreen) { setRect(null); return; }
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    setRect(r);
  }, [step]);

  // Mide el objetivo al montar y al cambiar de paso (setState intencional).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useLayoutEffect(() => { measure(); }, [measure]);

  useEffect(() => {
    const onMove = () => measure();
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => { window.removeEventListener("resize", onMove); window.removeEventListener("scroll", onMove, true); };
  }, [measure]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const PAD = 8;
  let cardStyle: React.CSSProperties;
  if (rect) {
    if (rect.left < 320) {
      // objetivo en el sidebar → tooltip a la derecha
      cardStyle = { top: Math.max(16, Math.min(rect.top, window.innerHeight - 260)), left: rect.right + 18 };
    } else {
      // objetivo en la topbar/contenido → tooltip debajo
      cardStyle = { top: rect.bottom + 14, left: Math.min(rect.left, window.innerWidth - 360) };
    }
  } else {
    cardStyle = { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  }

  return (
    <div className="tourRoot" role="dialog" aria-modal="true" aria-label="Tutorial de la plataforma">
      <div className="tourCatch" />
      {rect ? (
        <div
          className="tourSpotlight"
          style={{ top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }}
        />
      ) : (
        <div className="tourDim" />
      )}
      <div className="tourCard" style={cardStyle}>
        <button className="tourClose" onClick={onClose} aria-label="Saltar tutorial"><X size={16} /></button>
        <span className="tourStepCount">Paso {i + 1} de {steps.length}</span>
        <h3>{step.title}</h3>
        <p>{step.body}</p>
        <div className="tourDots" aria-hidden="true">
          {steps.map((_, k) => <span key={k} className={k === i ? "on" : ""} />)}
        </div>
        <div className="tourActions">
          <button className="textButton" onClick={onClose}>Saltar tutorial</button>
          <div className="tourNav">
            {i > 0 && <button className="secondaryButton" onClick={() => setI(i - 1)}>Anterior</button>}
            <button className="primaryButton" onClick={() => (last ? onClose() : setI(i + 1))}>
              {last ? "Entendido" : "Siguiente"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
