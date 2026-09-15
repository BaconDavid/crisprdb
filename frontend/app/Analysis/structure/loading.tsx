export default function StructureLoading() {
  return (
    <main className="min-h-screen bg-[#f6f7f9] px-7 py-10" aria-busy="true">
      <div className="mx-auto max-w-[1600px] animate-pulse space-y-6">
        <div className="h-8 w-72 rounded-lg bg-slate-200" />
        <div className="h-4 w-full max-w-3xl rounded bg-slate-200" />
        <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
          <div className="h-[640px] rounded-xl bg-white" />
          <div className="h-[640px] rounded-xl bg-white" />
        </div>
      </div>
    </main>
  );
}
