const CJK = /[぀-ヿ㐀-䶿一-鿿豈-﫿ｦ-ﾟ]/g

/** CJK characters count one each; everything else counts whitespace-separated words. */
export function countWords(text: string): number {
  if (!text) return 0
  const cjk = (text.match(CJK) ?? []).length
  const rest = text.replace(CJK, ' ').trim()
  const latin = rest ? rest.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length : 0
  return cjk + latin
}

export function readingMinutes(words: number): number {
  return Math.max(1, Math.round(words / 250))
}
