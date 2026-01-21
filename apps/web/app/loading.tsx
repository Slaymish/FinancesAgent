import { Card } from "./components/ui";

export default function AppLoading() {
  return (
    <div className="section">
      <div className="page-heading">
        <div>
          <h1>Loading…</h1>
          <div className="loading-dots">
            <span className="dot" />
            <span className="dot" />
            <span className="dot" />
          </div>
        </div>
      </div>
      <Card title="Preparing view">
        <p className="muted">Almost there.</p>
      </Card>
    </div>
  );
}
