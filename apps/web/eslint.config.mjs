import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "next-env.d.ts"]),
  {
    rules: {
      // Los efectos de carga de datos (análisis, observaciones, histórico)
      // sincronizan estado al cambiar de vista; es un patrón deliberado.
      // Se mantiene como advertencia en lugar de error.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

