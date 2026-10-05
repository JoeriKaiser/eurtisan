import { existsSync, readFileSync } from 'node:fs'

const target = process.argv[2]
if (!target) {
  console.error('Missing target report')
  process.exit(1)
}

if (!existsSync(target)) {
  console.error(`File not found: ${target}`)
  process.exit(1)
}

const content = readFileSync(target, 'utf8')
if (content.length < 500) {
  console.error(`Report too short: ${content.length} chars`)
  process.exit(1)
}

// Ensure report has concrete metrics and recommendations
const requiredSections = ['Findings', 'Metrics', 'Root Cause', 'Recommendations']
for (const section of requiredSections) {
  if (!content.includes(section)) {
    console.error(`Missing required section: ${section}`)
    process.exit(1)
  }
}

console.log(`${target} verification passed`)
