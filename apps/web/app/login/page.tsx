import Image from "next/image";
import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <main className="loginPage">
      <section className="loginStory">
        <div className="brandTile"><Image src="/brand/brugali-logo.jpg" alt="Brugali Grupo Gastronómico" width={200} height={200} priority /></div>
        <div className="storyCopy">
          <span className="eyebrow">Inteligencia comercial</span>
          <h1>Costos claros.<br />Decisiones con contexto.</h1>
          <p>Un espacio privado para revisar vigencias, detectar inconsistencias y simular precios sin tocar la fuente original.</p>
        </div>
        <div className="brandStack" aria-hidden="true"><i /><i /><i /><i /></div>
      </section>
      <section className="loginPanel">
        <LoginForm />
      </section>
    </main>
  );
}

