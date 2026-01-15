import type { ReactNode } from "react";

export const metadata = {
  title: "Health Insights Agent"
};

export default function RootLayout({
  children
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <nav>
          <a href="/">Dashboard</a> | <a href="/trends">Trends</a> | <a href="/insights">Insights</a> |{" "}
          <a href="/data-quality">Data quality</a> | <a href="/metrics">Raw metrics</a>
        </nav>
        {children}
      </body>
    </html>
  );
}
