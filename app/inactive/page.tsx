import { signOut } from "@/app/(auth)/actions";
import { Button } from "@/components/ui";

export default function InactivePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="max-w-md rounded-lg border border-line bg-surface p-6 text-center">
        <h1 className="font-display text-2xl font-bold">Account not active</h1>
        <p className="mt-3 text-muted">
          Your account exists but hasn&apos;t been activated, or it has been disabled. Ask an administrator to enable it.
        </p>
        <form action={signOut} className="mt-5">
          <Button variant="secondary" type="submit">
            Sign out
          </Button>
        </form>
      </div>
    </main>
  );
}
