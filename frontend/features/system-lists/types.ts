export type SystemListType =
  | 'COUNTRY'
  | 'MONTH'
  | 'LANGUAGE'
  | 'CURRENCY'
  | 'TIMEZONE'
  | 'AGE_RANGE'
  | 'CUSTOM';

export interface ListItem {
  id: string;
  label: string;
  value: string;
  order: number;
}

export interface SystemList {
  id: string;
  name: string;
  slug: string;
  type: SystemListType;
  is_system: boolean;
  items: ListItem[];
  created_at: string;
}