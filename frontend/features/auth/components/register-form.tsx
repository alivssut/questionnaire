'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { authApi } from '../api';
import { tokenStorage, getErrorMessage } from '@/shared/lib/api/client';
import { useAuth } from '@/shared/providers/auth-provider';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';

export function RegisterForm() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [form, setForm] = useState({
    email: '',
    first_name: '',
    last_name: '',
    password: '',
    password2: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (form.password !== form.password2) {
      toast.error('رمز عبور و تکرار آن یکسان نیستند');
      return;
    }
    if (form.password.length < 8) {
      toast.error('رمز عبور باید حداقل ۸ کاراکتر باشد');
      return;
    }

    setSubmitting(true);
    try {
      const res = await authApi.register(form);

      // اگر بکند توکن برگردوند، کاربر مستقیماً لاگین شده
      if (res.access && res.refresh) {
        tokenStorage.set(res.access, res.refresh);
        await refreshUser();
        toast.success('حساب کاربری ساخته شد');
        router.push('/dashboard');
      } else {
        toast.success('ثبت‌نام موفق. ایمیل خود را بررسی کنید.');
        router.push('/login');
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const update = (k: keyof typeof form, v: string) =>
    setForm((p) => ({ ...p, [k]: v }));

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1.5">نام</label>
          <Input
            value={form.first_name}
            onChange={(e) => update('first_name', e.target.value)}
            placeholder="نام"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">نام خانوادگی</label>
          <Input
            value={form.last_name}
            onChange={(e) => update('last_name', e.target.value)}
            placeholder="نام خانوادگی"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">ایمیل</label>
        <Input
          type="email"
          value={form.email}
          onChange={(e) => update('email', e.target.value)}
          placeholder="you@example.com"
          required
          autoComplete="email"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">رمز عبور</label>
        <Input
          type="password"
          value={form.password}
          onChange={(e) => update('password', e.target.value)}
          placeholder="حداقل ۸ کاراکتر"
          required
          autoComplete="new-password"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">تکرار رمز عبور</label>
        <Input
          type="password"
          value={form.password2}
          onChange={(e) => update('password2', e.target.value)}
          placeholder="تکرار رمز عبور"
          required
          autoComplete="new-password"
        />
      </div>

      <Button type="submit" className="w-full" size="lg" disabled={submitting}>
        {submitting && <Loader2 size={16} className="animate-spin" />}
        ساخت حساب کاربری
      </Button>
    </form>
  );
}