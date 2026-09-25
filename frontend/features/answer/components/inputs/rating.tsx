'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';

export function RatingInput({
  value, onChange, max = 5,
}: { value: number; onChange: (v: number) => void; max?: number }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-3">
      {Array.from({ length: max }).map((_, i) => {
        const n = i + 1;
        const filled = n <= (hover || value);
        return (
          <button
            key={n}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onChange(n)}
            className="transition-transform hover:scale-110"
          >
            <Star
              size={36}
              className={`transition-all ${
                filled ? 'fill-amber-400 text-amber-400' : 'text-border fill-muted'
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}