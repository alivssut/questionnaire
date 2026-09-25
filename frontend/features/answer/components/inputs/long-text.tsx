'use client';

export function LongTextInput({
  value, onChange,
}: { value: string; onChange: (v: string) => void }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="نظر خود را بنویسید..."
      rows={4}
      className="w-full max-w-lg px-5 py-4 text-lg bg-card border-2 border-border rounded-2xl focus:outline-none focus:border-primary/60 transition-all resize-none placeholder:text-muted-foreground/40"
      autoFocus
    />
  );
}