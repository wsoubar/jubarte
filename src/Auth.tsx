import { useState } from "react";
import { supabase } from "./supabase";
import { Button } from "./components/ui/button";
import { ArrowRight, ShieldCheck, Waves } from "lucide-react";
export function Auth({
  onDemo,
  recovery = false,
  onRecovered,
}: {
  onDemo: () => void;
  recovery?: boolean;
  onRecovered?: () => void;
}) {
  const [reset, setReset] = useState(false),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMessage("");
    try {
      if (recovery) {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        onRecovered?.();
      } else if (reset) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + import.meta.env.BASE_URL,
        });
        if (error) throw error;
        setMessage(
          "Se o endereço estiver cadastrado, você receberá um link para redefinir sua senha.",
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Não foi possível acessar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <section className="auth-story">
        <div className="brand">
          <img
            src={import.meta.env.BASE_URL + "logo.png"}
            alt="Baleia jubarte saltando"
          />
          <span>
            jubarte<span className="brand-dot">.</span>
          </span>
        </div>
        <div>
          <span className="eyebrow">MAIS CLAREZA. MAIS TRANQUILIDADE.</span>
          <h1>
            Suas finanças,
            <br />
            em águas
            <br />
            <em>tranquilas.</em>
          </h1>
          <p>
            Um espaço só seu para cuidar do presente
            <br />e navegar em direção aos seus planos.
          </p>
        </div>
        <div className="auth-foot">
          <Waves /> Seu próximo capítulo começa com equilíbrio.
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-box">
          <div className="small-logo">
            <Waves size={28} />
          </div>
          <h2>
            {recovery
              ? "Uma nova senha"
              : reset
                ? "Recupere seu acesso"
                : "Bem-vindo a bordo"}
          </h2>
          <p>
            {recovery
              ? "Escolha uma senha com pelo menos 8 caracteres."
              : reset
                ? "Enviaremos um link para o seu e-mail."
                : "Acesse seu espaço financeiro pessoal."}
          </p>
          {supabase ? (
            <form onSubmit={submit} className="form-stack">
              {!recovery && (
                <label>
                  E-mail
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                    placeholder="seu@email.com"
                  />
                </label>
              )}
              {(!reset || recovery) && (
                <label>
                  Senha
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={
                      recovery ? "new-password" : "current-password"
                    }
                    minLength={recovery ? 8 : 1}
                    required
                    placeholder="Sua senha"
                  />
                </label>
              )}
              {message && (
                <div className="notice" role="status">
                  {message}
                </div>
              )}
              <Button disabled={busy}>
                {busy
                  ? "Aguarde…"
                  : recovery
                    ? "Salvar nova senha"
                    : reset
                      ? "Enviar link"
                      : "Entrar no Jubarte"}
                <ArrowRight size={17} />
              </Button>
              {!recovery && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setReset(!reset);
                    setMessage("");
                  }}
                >
                  {reset ? "Voltar para o login" : "Esqueci minha senha"}
                </Button>
              )}
            </form>
          ) : (
            <div className="notice">
              A conexão com seu Supabase ainda precisa ser configurada. Explore
              a demonstração para conhecer o Jubarte.
            </div>
          )}
          {!recovery && (
            <Button variant="outline" className="demo-btn" onClick={onDemo}>
              Explorar demonstração
            </Button>
          )}
          <div className="privacy">
            <ShieldCheck size={15} /> Seu dinheiro é pessoal. Seus dados também.
          </div>
        </div>
      </section>
    </main>
  );
}
