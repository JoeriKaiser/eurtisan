export function isLocalRedirect(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//')
}
