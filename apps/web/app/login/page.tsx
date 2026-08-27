import { Suspense } from "react";
import Image from "next/image";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <main className="loginPage">
      <section className="loginStory">
        <div className="brandSignature">
          <div className="brandTile"><Image src="/brand/brugali-logo.jpg" alt="Brugali Grupo Gastronómico" width={280} height={280} priority /></div>
          <h1>Inteligencia comercial</h1>
        </div>
        <div className="brandStack" aria-hidden="true"><i /><i /><i /><i /></div>
      </section>
      <section className="loginPanel">
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </section>
    </main>
  );
}
