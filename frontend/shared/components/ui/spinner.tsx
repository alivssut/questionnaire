import { cn } from '@/shared/lib/utils';

export function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'h-6 w-6 rounded-full border-2 border-primary/30 border-t-primary animate-spin',
        className,
      )}
    />
  );
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Spinner className="h-8 w-8" />
    </div>
  );
}