const LATEX_SPECIAL_CHARS: Record<string, string> = {
  '\\': '\\textbackslash{}',
  '{': '\\{',
  '}': '\\}',
  '#': '\\#',
  '%': '\\%',
  '&': '\\&',
  '$': '\\$',
  '_': '\\_',
  '~': '\\textasciitilde{}',
  '^': '\\textasciicircum{}',
}

export function escapeLatex(value: string): string {
  return value.replace(/([\\{}#%&$_~^])/g, (match) => LATEX_SPECIAL_CHARS[match] ?? match)
}
