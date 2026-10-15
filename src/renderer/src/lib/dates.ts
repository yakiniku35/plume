import { format, parseISO, isToday, isYesterday, startOfDay, subDays } from 'date-fns'
import { enUS, zhCN, zhTW } from 'date-fns/locale'
import type { Locale } from '@shared/types'

const fnsLocale = { en: enUS, 'zh-Hans': zhCN, 'zh-Hant': zhTW }

export function todayKey(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function dayKey(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

export function daysAgoKey(n: number): string {
  return dayKey(subDays(startOfDay(new Date()), n))
}

export function parseDay(key: string): Date {
  return parseISO(key)
}

export function fmtDay(key: string, locale: Locale, t: { today: string; yesterday: string }): string {
  const d = parseDay(key)
  if (isToday(d)) return t.today
  if (isYesterday(d)) return t.yesterday
  return format(d, locale === 'en' ? 'EEEE, MMMM d' : 'M月d日 EEEE', { locale: fnsLocale[locale] })
}

export function fmtDayLong(key: string, locale: Locale): string {
  return format(parseDay(key), locale === 'en' ? 'EEEE, MMMM d, yyyy' : 'yyyy年M月d日 EEEE', { locale: fnsLocale[locale] })
}

export function fmtMonth(key: string, locale: Locale): string {
  return format(parseDay(key + '-01'), locale === 'en' ? 'MMMM yyyy' : 'yyyy年M月', { locale: fnsLocale[locale] })
}

export function fmtShort(iso: string, locale: Locale): string {
  return format(parseISO(iso), locale === 'en' ? 'MMM d, yyyy' : 'yyyy年M月d日', { locale: fnsLocale[locale] })
}

/** Short axis label, e.g. 'Oct 6' / '10/6'. */
export function fmtAxis(key: string, locale: Locale): string {
  return format(parseDay(key), locale === 'en' ? 'MMM d' : 'M/d', { locale: fnsLocale[locale] })
}

export function fmtTime(iso: string, locale: Locale): string {
  return format(parseISO(iso), 'HH:mm', { locale: fnsLocale[locale] })
}
