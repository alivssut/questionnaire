import Link from 'next/link';
import { Home, Search, ArrowRight } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-gradient-to-br from-primary/5 via-background to-purple-500/5">
      <div className="text-center max-w-lg">
        {/* Big 404 */}
        <div className="relative mb-8">
          <span className="text-[140px] sm:text-[180px] font-black leading-none bg-gradient-to-br from-primary via-purple-500 to-primary bg-clip-text text-transparent tracking-tighter">
            ۴۰۴
          </span>
        </div>

        <h1 className="text-2xl font-bold mb-3">صفحه پیدا نشد</h1>
        <p className="text-muted-foreground mb-8 leading-relaxed">
          متأسفانه صفحه‌ای که دنبالش بودید وجود ندارد یا منتقل شده است.
        </p>

        <div className="flex gap-3 justify-center flex-wrap">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-all"
          >
            <Home size={16} /> داشبورد
          </Link>
          <Link
            href="/questionnaires"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-secondary text-secondary-foreground rounded-xl font-medium hover:bg-secondary/80 transition-all"
          >
            <Search size={16} /> مشاهده پرسشنامه‌ها
          </Link>
        </div>
      </div>
    </div>
  );
}