"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CornerDownLeft, Search } from "lucide-react";

export interface Command {
  id: string;
  label: string;
  hint?: string;
  group: string;
  run: () => void;
}

/** Se monta sólo cuando está abierto (el padre controla la vida del componente). */
export function CommandPalette({ onClose, commands }: { onClose: () => void; commands: Command[] }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const q = query.toLowerCase().trim();
    const filtered = q
      ? commands.filter((c) => c.label.toLowerCase().includes(q) || c.hint?.toLowerCase().includes(q) || c.group.toLowerCase().includes(q))
      : commands;
    return filtered.slice(0, 40);
  }, [commands, query]);

  // Sólo enfoca el input al montar; no toca estado de React.
  useEffect(() => {
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); const cmd = results[active]; if (cmd) { cmd.run(); onClose(); } }
    else if (e.key === "Escape") { e.preventDefault(); onClose(); }
  }

  return (
    <div className="paletteOverlay" onClick={onClose}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Paleta de comandos" onClick={(e) => e.stopPropagation()} onKeyDown={onKeyDown}>
        <div className="paletteSearch">
          <Search size={18} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0); }}
            placeholder="Buscar producto, vista o lista…"
            aria-label="Buscar comando"
          />
          <kbd>esc</kbd>
        </div>
        <div className="paletteList">
          {results.length === 0 && <div className="paletteEmpty">Sin resultados</div>}
          {results.map((cmd, idx) => {
            const showGroup = results[idx - 1]?.group !== cmd.group;
            return (
              <div key={cmd.id}>
                {showGroup && <div className="paletteGroup">{cmd.group}</div>}
                <button
                  className={`paletteItem ${idx === active ? "active" : ""}`}
                  onMouseEnter={() => setActive(idx)}
                  onClick={() => { cmd.run(); onClose(); }}
                >
                  <span className="paletteLabel">{cmd.label}</span>
                  {cmd.hint && <span className="paletteHint">{cmd.hint}</span>}
                  {idx === active && <CornerDownLeft size={14} className="paletteEnter" />}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
