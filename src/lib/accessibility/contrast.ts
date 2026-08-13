export interface OklchColor {
  lightness: number
  chroma: number
  hue: number
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value))
}

export function relativeLuminance(color: OklchColor): number {
  const hueRadians = (color.hue * Math.PI) / 180
  const a = color.chroma * Math.cos(hueRadians)
  const b = color.chroma * Math.sin(hueRadians)
  const lPrime = color.lightness + 0.3963377774 * a + 0.2158037573 * b
  const mPrime = color.lightness - 0.1055613458 * a - 0.0638541728 * b
  const sPrime = color.lightness - 0.0894841775 * a - 1.291485548 * b
  const l = lPrime ** 3
  const m = mPrime ** 3
  const s = sPrime ** 3
  const red = clamp(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)
  const green = clamp(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)
  const blue = clamp(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

export function contrastRatio(foreground: OklchColor, background: OklchColor): number {
  const foregroundLuminance = relativeLuminance(foreground)
  const backgroundLuminance = relativeLuminance(background)
  const lighter = Math.max(foregroundLuminance, backgroundLuminance)
  const darker = Math.min(foregroundLuminance, backgroundLuminance)
  return (lighter + 0.05) / (darker + 0.05)
}
