import type { Metadata } from "next";
import "../src/styles/index.css";
import { BackgroundGlow } from "../src/app/components/BackgroundGlow";
import { AgentPreloader } from "../src/app/components/AgentPreloader";

export const metadata: Metadata = {
  title: "Autoreach AI",
  description: "AI-powered marketing campaigns",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const runtimePublicEnv = {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  };

  return (
    <html lang="en">
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__CAMPAIGNX_PUBLIC_ENV__ = ${JSON.stringify(runtimePublicEnv)};`,
          }}
        />
        <AgentPreloader />
        <div
          className="min-h-screen relative"
          style={{
            background:
              "linear-gradient(135deg, #050510 0%, #0d0520 40%, #050515 80%, #020210 100%)",
            color: "#ffffff",
          }}
        >
          <div
            className="fixed inset-0 pointer-events-none z-0"
            style={{
              backgroundImage:
                "linear-gradient(rgba(139,92,246,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.03) 1px, transparent 1px)",
              backgroundSize: "60px 60px",
            }}
          />
          <BackgroundGlow />
          <div className="relative z-10">{children}</div>
        </div>
      </body>
    </html>
  );
}

