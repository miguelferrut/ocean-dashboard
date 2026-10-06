export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <p className="mb-6 text-center font-display text-3xl font-bold">Ocean Control Tower</p>
        <div className="rounded-lg border border-line bg-surface p-6 shadow-sm">{children}</div>
      </div>
    </main>
  );
}
