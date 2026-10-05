import { cn } from "@/lib/utils";

export default function SecretariaAvatar({
  size = 40,
  pulse = false,
  className,
}: {
  size?: number;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("relative inline-flex shrink-0", className)} style={{ width: size, height: size }} data-testid="secretaria-avatar">
      <img
        src="/secretaria-avatar.jpeg"
        alt="SecretarIA — asistente comercial"
        className="h-full w-full rounded-full object-cover ring-2 ring-sky-400/40 shadow-[0_0_20px_rgba(0,210,255,0.25)]"
      />
      {pulse && <span className="absolute inset-0 rounded-full ring-2 ring-sky-400/60 animate-soft-pulse" aria-hidden />}
    </span>
  );
}
