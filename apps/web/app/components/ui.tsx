import type { ReactNode } from "react";

type Meta = { label: string; value: string };

export function PageHeader({
  title,
  description,
  meta
}: {
  title: string;
  description?: string;
  meta?: Meta[];
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {meta?.length ? (
        <div className="page-heading__meta">
          {meta.map((item) => (
            <div key={item.label} className="pill muted">
              <span className="section-title">{item.label}</span>
              <span>{item.value}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function Card({
  title,
  subtitle,
  action,
  children
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="card">
      {(title || subtitle || action) && (
        <div className="card-header">
          <div>
            {title ? <h3 className="card-title">{title}</h3> : null}
            {subtitle ? <p className="card-subtitle">{subtitle}</p> : null}
          </div>
          {action ? <div>{action}</div> : null}
        </div>
      )}
      <div className="card-body">{children}</div>
    </section>
  );
}

export function Stat({
  label,
  value,
  hint
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="stat">
      <div>
        <div className="stat-label">{label}</div>
        {hint ? <div className="hint">{hint}</div> : null}
      </div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

export function Badge({
  tone = "neutral",
  children
}: {
  tone?: "neutral" | "positive" | "negative";
  children: ReactNode;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function Grid({
  children,
  columns = 3
}: {
  children: ReactNode;
  columns?: 2 | 3;
}) {
  return <div className={`grid cols-${columns}`}>{children}</div>;
}
