import type { ReactNode } from "react";
import "./globals.css";
import Nav from "./components/nav";
import Providers from "./providers";
import UserGreeting from "./components/user-greeting";

const themeInitScript = `
(() => {
  try {
    const stored = localStorage.getItem('finance-agent-theme');
    const system = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const theme = stored === 'light' || stored === 'dark' ? stored : system;
    document.documentElement.dataset.theme = theme;
  } catch (err) {
    document.documentElement.dataset.theme = 'light';
  }
})();
`;

export const metadata = {
  title: "Finance Agent"
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
            <div className="top-bar-wrap">
              <header className="top-bar">
                <div className="brand">
                  <svg
                    className="brand-icon"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M3 12c0-4.5 3.6-8 9-8s9 3.5 9 8-3.6 8-9 8-9-3.5-9-8Z" />
                    <path d="M9.5 8.5h5" />
                    <path d="M9.5 11.5h3.5" />
                    <path d="M9.5 14.5h4.5" />
                  </svg>
                  <div>
                    <div className="brand-title">Finance Agent</div>
                    <div className="brand-subtitle">Know where the money moves</div>
                  </div>
                </div>
                <Nav />
                <div className="actions">
                  <UserGreeting />
                </div>
              </header>
            </div>
            <main className="page">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
