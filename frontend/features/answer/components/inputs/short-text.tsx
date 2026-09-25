'use client';

export function ShortTextInput({
  value, onChange, placeholder,
}: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder || 'پاسخ خود را اینجا بنویسید...'}
      className="w-full max-w-lg px-5 py-4 text-lg bg-card border-2 border-border rounded-2xl focus:outline-none focus:border-primary/60 transition-all placeholder:text-muted-foreground/40"
      autoFocus
    />
  );
}