"use client";

import type { ReactNode } from "react";
import { Lock } from "lucide-react";

/**
 * Tarjeta de feature dependiente de un dato de origen. Si el dato aún no llega
 * en la planilla, se muestra bloqueada explicando qué desbloquea; cuando la
 * capacidad está presente, renderiza su contenido real. Nunca inventa datos.
 */
export function CapabilityGate({
  enabled,
  title,
  unlocks,
  requirement,
  children,
}: {
  enabled: boolean;
  title: string;
  unlocks: string;
  requirement: string;
  children?: ReactNode;
}) {
  if (enabled) return <>{children}</>;
  return (
    <div className="capCard" role="note">
      <div className="capLock"><Lock size={15} /></div>
      <div className="capBody">
        <span className="capTitle">{title}</span>
        <p>{unlocks}</p>
        <small className="capReq">Disponible al cargar {requirement}</small>
      </div>
    </div>
  );
}
