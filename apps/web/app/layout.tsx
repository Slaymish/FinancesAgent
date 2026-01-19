import type { ReactNode } from "react";
import "./globals.css";
import Nav from "./components/nav";
import SyncButton from "./components/sync-button";
import Providers from "./providers";
import AuthButton from "./components/auth-button";
import UserGreeting from "./components/user-greeting";
import ThemeToggle from "./components/theme-toggle";

const themeInitScript = `
(() => {
  try {
    const stored = localStorage.getItem('health-agent-theme');
    const system = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const theme = stored === 'light' || stored === 'dark' ? stored : system;
    document.documentElement.dataset.theme = theme;
  } catch (err) {
    document.documentElement.dataset.theme = 'light';
  }
})();
`;

export const metadata = {
  title: "Health Insights Agent"
};

export default function RootLayout({
  children
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <Providers>
          <div className="app-shell">
            <header className="top-bar">
              <div className="brand">
                <div>
                  <div className="brand-title">Health Agent</div>
                  <div className="brand-subtitle">Decide what to do next</div>
                </div>
              </div>
              <Nav />
              <div className="actions">
                <ThemeToggle />
                <SyncButton />
                <UserGreeting />
                <AuthButton />
              </div>
            </header>
            <main className="page">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
