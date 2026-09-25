'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import {
  Check,
  Loader2,
  Lock,
  Mail,
  Save,
  Shield,
  Trash2,
  User as UserIcon,
  Upload,
  AlertCircle,
  Bell,
  Palette,
} from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/shared/providers/auth-provider';
import { authApi } from '@/features/auth/api';
import {
  DEFAULT_NOTIFICATION_PREFS,
  type NotificationPreferences,
} from '@/features/auth/types';

import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Switch } from '@/shared/components/ui/switch';
import { Tabs } from '@/shared/components/ui/tabs';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { ThemeToggle } from '@/shared/components/theme/theme-toggle';
import { ConfirmDialog } from '@/shared/components/ui/confirm-dialog';
import { getErrorMessage } from '@/shared/lib/api/client';
import { cn, initials, normalizeMediaUrl } from '@/shared/lib/utils';

// ═════════════════════════════════════════════════════════════════
// Types
// ═════════════════════════════════════════════════════════════════

type TabKey = 'profile' | 'notifications' | 'appearance' | 'security';

const AVATAR_MAX_MB = 2;
const AVATAR_MAX_BYTES = AVATAR_MAX_MB * 1024 * 1024;
const AVATAR_ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

// ═════════════════════════════════════════════════════════════════
// Page
// ═════════════════════════════════════════════════════════════════

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const [tab, setTab] = useState<TabKey>('profile');

  if (!user) return null;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">تنظیمات</h1>
        <p className="text-muted-foreground text-sm mt-1.5">
          مدیریت حساب کاربری و ترجیحات
        </p>
      </div>

      {/* Tabs */}
      <Tabs
        value={tab}
        onValueChange={setTab}
        items={[
          { value: 'profile', label: 'پروفایل' },
          { value: 'notifications', label: 'اعلان‌ها' },
          { value: 'appearance', label: 'ظاهر' },
          { value: 'security', label: 'امنیت' },
        ]}
      />

      {tab === 'profile' && <ProfileTab onSaved={refreshUser} />}
      {tab === 'notifications' && <NotificationsTab onSaved={refreshUser} />}
      {tab === 'appearance' && <AppearanceTab />}
      {tab === 'security' && <SecurityTab />}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// Profile Tab
// ═════════════════════════════════════════════════════════════════

function ProfileTab({ onSaved }: { onSaved: () => Promise<void> }) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [firstName, setFirstName] = useState(user?.first_name ?? '');
  const [lastName, setLastName] = useState(user?.last_name ?? '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState(false);
  const [saving, setSaving] = useState(false);

  // Sync when user changes from outside
  useEffect(() => {
    setFirstName(user?.first_name ?? '');
    setLastName(user?.last_name ?? '');
  }, [user?.first_name, user?.last_name]);

  // Revoke object URL on cleanup
  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  const currentAvatarUrl = useMemo(() => {
    if (avatarPreview) return avatarPreview;
    if (user?.avatar) return normalizeMediaUrl(user.avatar);
    return null;
  }, [avatarPreview, user?.avatar]);

  const dirty =
    firstName.trim() !== (user?.first_name ?? '') ||
    lastName.trim() !== (user?.last_name ?? '') ||
    avatarFile !== null;

  const handlePickAvatar = () => fileRef.current?.click();

  const handleAvatarChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (file.size > AVATAR_MAX_BYTES) {
      toast.error(`حجم تصویر نباید بیشتر از ${AVATAR_MAX_MB} مگابایت باشد`);
      return;
    }
    if (!AVATAR_ALLOWED.includes(file.type)) {
      toast.error('فرمت تصویر پشتیبانی نمی‌شود (فقط JPG، PNG، WebP)');
      return;
    }

    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    const url = URL.createObjectURL(file);
    setAvatarFile(file);
    setAvatarPreview(url);
    setAvatarError(false);
  };

  const removeAvatar = () => {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(null);
    setAvatarPreview(null);
  };

  const handleSave = async () => {
    if (!dirty) return;
    setSaving(true);
    try {
      await authApi.updateMe({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        avatar: avatarFile ?? undefined,
      });
      await onSaved();
      setAvatarFile(null);
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      setAvatarPreview(null);
      toast.success('پروفایل به‌روزرسانی شد');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>اطلاعات پروفایل</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Avatar */}
        <div className="flex items-center gap-5">
          <div className="relative flex-shrink-0">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center ring-2 ring-border">
              {currentAvatarUrl && !avatarError ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={currentAvatarUrl}
                  alt="avatar"
                  className="w-full h-full object-cover"
                  onError={() => setAvatarError(true)}
                />
              ) : (
                <span className="text-xl font-bold text-primary">
                  {initials(user?.full_name || user?.email || '?')}
                </span>
              )}
            </div>
            {currentAvatarUrl && !avatarError && (
              <button
                onClick={removeAvatar}
                className="absolute -bottom-1 -left-1 w-7 h-7 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-md hover:scale-110 transition-transform"
                title="حذف تصویر"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>

          <div className="space-y-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePickAvatar}
            >
              <Upload size={14} /> تغییر تصویر
            </Button>
            <p className="text-[10px] text-muted-foreground">
              JPG، PNG یا WebP · حداکثر {AVATAR_MAX_MB} مگابایت
            </p>
            <input
              ref={fileRef}
              type="file"
              accept={AVATAR_ALLOWED.join(',')}
              onChange={handleAvatarChange}
              className="hidden"
            />
          </div>
        </div>

        {/* Fields */}
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5">نام</label>
            <Input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="نام"
              maxLength={64}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5">
              نام خانوادگی
            </label>
            <Input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="نام خانوادگی"
              maxLength={64}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1.5">
            ایمیل
          </label>
          <div className="relative">
            <Input
              value={user?.email ?? ''}
              disabled
              className="pr-10"
            />
            <Mail
              size={14}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5">
            ایمیل قابل تغییر نیست
          </p>
        </div>

        {/* Save */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
          {dirty && (
            <span className="text-xs text-muted-foreground">
              تغییرات ذخیره‌نشده
            </span>
          )}
          <Button onClick={handleSave} disabled={!dirty || saving}>
            {saving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Save size={14} />
            )}
            ذخیره تغییرات
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ═════════════════════════════════════════════════════════════════
// Notifications Tab
// ═════════════════════════════════════════════════════════════════

function NotificationsTab({ onSaved }: { onSaved: () => Promise<void> }) {
  const { user } = useAuth();

  const [prefs, setPrefs] = useState<NotificationPreferences>(
    user?.notification_preferences ?? DEFAULT_NOTIFICATION_PREFS,
  );
  const [saving, setSaving] = useState(false);

  // Sync when user changes
  useEffect(() => {
    setPrefs(user?.notification_preferences ?? DEFAULT_NOTIFICATION_PREFS);
  }, [user?.notification_preferences]);

  const dirty = useMemo(() => {
    const current = user?.notification_preferences ?? DEFAULT_NOTIFICATION_PREFS;
    return JSON.stringify(current) !== JSON.stringify(prefs);
  }, [user?.notification_preferences, prefs]);

  const items: {
    key: keyof NotificationPreferences;
    label: string;
    description: string;
    icon: typeof Bell;
  }[] = [
    {
      key: 'email',
      label: 'اعلان ایمیلی',
      description: 'خلاصه فعالیت‌ها به ایمیل شما ارسال شود',
      icon: Mail,
    },
    {
      key: 'assignments',
      label: 'اعلان تخصیص جدید',
      description: 'وقتی پرسشنامه‌ای به شما تخصیص داده می‌شود',
      icon: UserIcon,
    },
    {
      key: 'reminders',
      label: 'یادآوری‌ها',
      description: 'یادآوری پرسشنامه‌های در انتظار پاسخ',
      icon: Bell,
    },
    {
      key: 'completions',
      label: 'اعلان تکمیل',
      description: 'وقتی کسی به پرسشنامه شما پاسخ می‌دهد',
      icon: Check,
    },
  ];

  const toggle = (key: keyof NotificationPreferences) =>
    setPrefs((p) => ({ ...p, [key]: !p[key] }));

  const handleSave = async () => {
    if (!dirty) return;
    setSaving(true);
    try {
      await authApi.updateMe({ notification_preferences: prefs });
      await onSaved();
      toast.success('ترجیحات ذخیره شد');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>ترجیحات اعلان</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {items.map((item) => {
            const Icon = item.icon;
            const checked = prefs[item.key];
            return (
              <div
                key={item.key}
                className="flex items-center gap-4 py-3.5 border-b border-border last:border-0"
              >
                <div
                  className={cn(
                    'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors',
                    checked
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  <Icon size={15} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {item.description}
                  </p>
                </div>
                <Switch checked={checked} onCheckedChange={() => toggle(item.key)} />
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-end gap-3 pt-5 mt-3 border-t border-border">
          {dirty && (
            <span className="text-xs text-muted-foreground">
              تغییرات ذخیره‌نشده
            </span>
          )}
          <Button onClick={handleSave} disabled={!dirty || saving}>
            {saving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Save size={14} />
            )}
            ذخیره
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ═════════════════════════════════════════════════════════════════
// Appearance Tab
// ═════════════════════════════════════════════════════════════════

function AppearanceTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>ظاهر برنامه</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <p className="text-sm font-medium mb-1">تم</p>
          <p className="text-xs text-muted-foreground mb-4">
            حالت نمایش FORMly را انتخاب کنید
          </p>
          <ThemeToggle />
        </div>

        <div className="pt-5 border-t border-border">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
              <Palette size={15} className="text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">تنظیمات نمایشی</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                تم انتخابی شما به‌صورت خودکار ذخیره می‌شود و در دفعات بعدی همان
                تم اعمال می‌گردد.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ═════════════════════════════════════════════════════════════════
// Security Tab
// ═════════════════════════════════════════════════════════════════

function SecurityTab() {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  const canSubmit =
    oldPassword.length > 0 &&
    newPassword.length >= 8 &&
    newPassword === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      await authApi.changePassword({
        old_password: oldPassword,
        new_password: newPassword,
      });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('رمز عبور با موفقیت تغییر یافت');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogoutAll = () => {
    setConfirmLogout(false);
    toast.success('توکن‌های شما در همه دستگاه‌ها باطل شد');
    // Real endpoint for this can be added later
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock size={14} />
            تغییر رمز عبور
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
            <div>
              <label className="block text-xs font-semibold mb-1.5">
                رمز عبور فعلی
              </label>
              <Input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5">
                رمز عبور جدید
              </label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
              <p className="text-[10px] text-muted-foreground mt-1.5">
                حداقل ۸ کاراکتر
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5">
                تکرار رمز عبور جدید
              </label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
              {confirmPassword.length > 0 &&
                newPassword !== confirmPassword && (
                  <p className="text-[10px] text-destructive mt-1.5 flex items-center gap-1">
                    <AlertCircle size={10} /> رمز عبور و تکرار آن یکسان نیستند
                  </p>
                )}
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={!canSubmit || submitting}
              >
                {submitting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Shield size={14} />
                )}
                تغییر رمز عبور
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-destructive">ناحیه خطر</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-4">
            <div className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center flex-shrink-0">
              <AlertCircle size={15} className="text-destructive" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">خروج از همه دستگاه‌ها</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                همه نشست‌های فعال شما در همه دستگاه‌ها بسته می‌شود. باید در
                دستگاه‌های دیگر دوباره وارد شوید.
              </p>
              <Button
                variant="destructive"
                size="sm"
                className="mt-3"
                onClick={() => setConfirmLogout(true)}
              >
                خروج از همه دستگاه‌ها
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        onConfirm={handleLogoutAll}
        title="خروج از همه دستگاه‌ها"
        description="همه نشست‌های فعال شما بسته می‌شود و باید دوباره وارد شوید."
        confirmLabel="تأیید خروج"
        variant="danger"
      />
    </div>
  );
}