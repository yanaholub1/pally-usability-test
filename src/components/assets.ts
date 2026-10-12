/**
 * Image lookup. Files exported from Figma go in src/assets/{avatars,clubs,illustrations}.
 * Lookup is by file name without extension; missing files return undefined so
 * components can show a stand-in.
 */
const files = import.meta.glob('../assets/{avatars,clubs,illustrations}/*.{png,jpg,jpeg,webp,svg}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

const byKey: Record<string, string> = {}
for (const [path, url] of Object.entries(files)) {
  const parts = path.split('/')
  const folder = parts[parts.length - 2]
  const name = parts[parts.length - 1].replace(/\.\w+$/, '').toLowerCase()
  byKey[`${folder}/${name}`] = url
}

export function asset(folder: 'avatars' | 'clubs' | 'illustrations', name: string): string | undefined {
  return byKey[`${folder}/${name.toLowerCase()}`]
}
