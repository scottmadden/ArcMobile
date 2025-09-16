export default function InspectorReady() {
  return (
    <main className="space-y-3">
      <h1 className="text-xl font-bold">Inspector Ready</h1>
      <p className="text-muted">A clean, read-only report will render here (latest permit, recent runs). Phase-2.</p>
      <a className="btn-outline" href="/documents">Manage Documents</a>
    </main>
  );
}
