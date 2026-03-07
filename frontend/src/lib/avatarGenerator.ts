/**
 * Avatar Generator Utility
 * Generates initials-based avatars from user names
 * Returns SVG data URL for instant display
 */

export function generateAvatarSVG(fullName: string, size: number = 200): string {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
    '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B88B', '#52D1DC',
    '#64B5B2', '#E8A87C', '#9CB4D8', '#F7B082', '#4DBFBF',
  ]

  const initials = fullName
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  // Use stable hash for consistent color per name
  const hash = fullName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const bgColor = colors[hash % colors.length]

  const svg = `
    <svg
      width="${size}"
      height="${size}"
      viewBox="0 0 ${size} ${size}"
      xmlns="http://www.w3.org/2000/svg"
      style="border-radius: 50%;"
    >
      <rect width="${size}" height="${size}" fill="${bgColor}" />
      <text
        x="50%"
        y="50%"
        dominant-baseline="middle"
        text-anchor="middle"
        font-size="${size / 2.5}"
        font-weight="bold"
        fill="white"
        font-family="system-ui, -apple-system, sans-serif"
      >
        ${initials}
      </text>
    </svg>
  `.trim()

  const encoded = btoa(svg)
  return `data:image/svg+xml;base64,${encoded}`
}

/**
 * Generate a placeholder avatar URL
 * Falls back to Placeholder service if needed
 */
export function getAvatarUrl(
  fullName: string,
  existingUrl?: string | null,
): string {
  // If user has uploaded a profile photo, use that
  if (existingUrl) {
    return existingUrl
  }

  // Generate SVG-based avatar
  return generateAvatarSVG(fullName, 200)
}
