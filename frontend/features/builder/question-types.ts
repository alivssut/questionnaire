import {
  AlignLeft,
  AlignJustify,
  Calendar,
  CheckSquare,
  ChevronDown,
  Clock,
  Globe,
  Hash,
  Mail,
  Phone,
  Star,
  Type,
  Upload,
  List,
  Grid3X3,
  ToggleLeft,
} from 'lucide-react';
import type { QuestionType } from '@/features/surveys/types';

export interface ComponentGroup {
  label: string;
  items: { type: QuestionType; label: string; icon: typeof Type }[];
}

export const componentGroups: ComponentGroup[] = [
  {
    label: 'محتوا',
    items: [
      { type: 'TEXT_BLOCK', label: 'بلوک متن', icon: AlignLeft },
      { type: 'SECTION', label: 'بخش', icon: Type },
    ],
  },
  {
    label: 'متنی',
    items: [
      { type: 'SHORT_TEXT', label: 'متن کوتاه', icon: Type },
      { type: 'LONG_TEXT', label: 'متن بلند', icon: AlignJustify },
      { type: 'EMAIL', label: 'ایمیل', icon: Mail },
      { type: 'PHONE', label: 'تلفن', icon: Phone },
      { type: 'URL', label: 'لینک', icon: Globe },
    ],
  },
  {
    label: 'عددی',
    items: [
      { type: 'NUMBER', label: 'عدد', icon: Hash },
      { type: 'SLIDER', label: 'اسلایدر', icon: Hash },
    ],
  },
  {
    label: 'انتخابی',
    items: [
      { type: 'SINGLE_CHOICE', label: 'تک‌گزینه', icon: List },
      { type: 'MULTIPLE_CHOICE', label: 'چندگزینه', icon: Grid3X3 },
      { type: 'DROPDOWN', label: 'کشویی', icon: ChevronDown },
      { type: 'YES_NO', label: 'بله / خیر', icon: ToggleLeft },
      { type: 'LIKERT', label: 'لیکرت', icon: CheckSquare },
      { type: 'RANKING', label: 'رتبه‌بندی', icon: List },
    ],
  },
  {
    label: 'تاریخ و زمان',
    items: [
      { type: 'DATE', label: 'تاریخ', icon: Calendar },
      { type: 'TIME', label: 'ساعت', icon: Clock },
      { type: 'DATETIME', label: 'تاریخ و ساعت', icon: Clock },
    ],
  },
  {
    label: 'مقیاس',
    items: [
      { type: 'RATING', label: 'ستاره‌ای', icon: Star },
      { type: 'NPS', label: 'NPS', icon: Hash },
      { type: 'LINEAR_SCALE', label: 'طیف خطی', icon: Hash },
    ],
  },
  {
    label: 'پیشرفته',
    items: [
      { type: 'MATRIX', label: 'ماتریس', icon: Grid3X3 },
      { type: 'FILE_UPLOAD', label: 'بارگذاری فایل', icon: Upload },
    ],
  },
];

export const questionTypeLabels: Record<QuestionType, string> = {
  SHORT_TEXT: 'متن کوتاه',
  LONG_TEXT: 'متن بلند',
  EMAIL: 'ایمیل',
  PHONE: 'تلفن',
  URL: 'لینک',
  NUMBER: 'عدد',
  RATING: 'امتیاز ستاره‌ای',
  LINEAR_SCALE: 'طیف خطی',
  NPS: 'شاخص NPS',
  SLIDER: 'اسلایدر',
  SINGLE_CHOICE: 'تک‌گزینه‌ای',
  MULTIPLE_CHOICE: 'چندگزینه‌ای',
  DROPDOWN: 'کشویی',
  YES_NO: 'بله / خیر',
  LIKERT: 'لیکرت',
  RANKING: 'رتبه‌بندی',
  DATE: 'تاریخ',
  TIME: 'ساعت',
  DATETIME: 'تاریخ و ساعت',
  MATRIX: 'ماتریس',
  FILE_UPLOAD: 'بارگذاری فایل',
  TEXT_BLOCK: 'بلوک متن',
  SECTION: 'بخش',
};

export const NON_ANSWERABLE: QuestionType[] = ['TEXT_BLOCK', 'SECTION'];

export const CHOICE_TYPES: QuestionType[] = [
  'SINGLE_CHOICE',
  'MULTIPLE_CHOICE',
  'DROPDOWN',
  'YES_NO',
  'LIKERT',
  'RANKING',
];

export const NUMERIC_TYPES: QuestionType[] = [
  'NUMBER',
  'RATING',
  'LINEAR_SCALE',
  'NPS',
  'SLIDER',
];