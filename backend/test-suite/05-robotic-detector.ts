/**
 * Comprehensive Robotic Response Detector
 *
 * This script scans Koda's codebase for ALL hardcoded, robotic responses
 * and provides a detailed report with fixes.
 */

import * as fs from 'fs';
import * as path from 'path';

interface RoboticPattern {
  category: string;
  pattern: RegExp;
  description: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
}

interface Finding {
  file: string;
  line: number;
  content: string;
  category: string;
  severity: string;
}

// Define all robotic patterns to detect
const ROBOTIC_PATTERNS: RoboticPattern[] = [
  // Hardcoded greetings
  {
    category: 'Hardcoded Greeting',
    pattern: /(["'`])(Hello|Hi|Hey|Welcome|Greetings|Olá|Hola|Bonjour)(!|\.|,).*?(["'`])/,
    description: 'Hardcoded greeting message',
    severity: 'HIGH',
  },

  // Hardcoded capabilities
  {
    category: 'Hardcoded Capabilities',
    pattern: /(["'`])I can help you:/,
    description: 'Hardcoded capabilities description',
    severity: 'HIGH',
  },

  // Formal labels (Next step, Tip, etc.)
  {
    category: 'Formal Labels',
    pattern: /(\*\*|\b)(Next step|Próximo passo|Prochaine étape)(\*\*|:)/i,
    description: 'Formal label that makes response robotic',
    severity: 'MEDIUM',
  },

  // Template-based file listings
  {
    category: 'Template File Listing',
    pattern: /You have \*\*\$\{.*?\}\*\* (documents|files|folders)/,
    description: 'Template-based file listing',
    severity: 'MEDIUM',
  },

  // Generic error messages
  {
    category: 'Generic Error',
    pattern: /(["'`])(Something went wrong|An error occurred)(["'`])/,
    description: 'Generic error message',
    severity: 'MEDIUM',
  },

  // Hardcoded "showing first X" messages
  {
    category: 'Hardcoded Pagination',
    pattern: /(showing|Showing) first \d+/i,
    description: 'Hardcoded pagination message',
    severity: 'LOW',
  },

  // Robotic citation phrases
  {
    category: 'Robotic Citation',
    pattern: /(["'`])(According to the document|Based on the file|The document states)(["'`])/,
    description: 'Robotic citation phrase',
    severity: 'HIGH',
  },

  // Generic "How can I help"
  {
    category: 'Generic Help Phrase',
    pattern: /How can I help you today\?/,
    description: 'Generic help phrase',
    severity: 'MEDIUM',
  },
];

function scanFile(filePath: string): Finding[] {
  const findings: Finding[] = [];

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      // Skip pure comments (but include template strings)
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('//') && !trimmedLine.includes("'") && !trimmedLine.includes('"')) {
        return;
      }
      if (trimmedLine.startsWith('/*') || trimmedLine.startsWith('*')) {
        return;
      }

      ROBOTIC_PATTERNS.forEach((pattern) => {
        // Reset regex lastIndex
        pattern.pattern.lastIndex = 0;

        if (pattern.pattern.test(line)) {
          // Check if it's in a comment explaining what NOT to do
          const isNegativeExample =
            line.toLowerCase().includes('not') ||
            line.toLowerCase().includes("don't") ||
            line.toLowerCase().includes('avoid') ||
            line.toLowerCase().includes('never') ||
            line.toLowerCase().includes('bad') ||
            line.toLowerCase().includes('robotic');

          if (!isNegativeExample) {
            findings.push({
              file: filePath,
              line: index + 1,
              content: line.trim().substring(0, 120) + (line.trim().length > 120 ? '...' : ''),
              category: pattern.category,
              severity: pattern.severity,
            });
          }
        }
      });
    });
  } catch (error) {
    // Silently skip files that can't be read
  }

  return findings;
}

function scanDirectory(dir: string, findings: Finding[] = []): Finding[] {
  try {
    const files = fs.readdirSync(dir);

    files.forEach((file) => {
      const filePath = path.join(dir, file);

      try {
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
          // Skip node_modules, dist, and test directories
          if (
            !file.includes('node_modules') &&
            !file.includes('dist') &&
            !file.includes('__tests__') &&
            !file.includes('_archive')
          ) {
            scanDirectory(filePath, findings);
          }
        } else if (file.endsWith('.ts') && !file.endsWith('.test.ts') && !file.endsWith('.d.ts')) {
          const fileFindings = scanFile(filePath);
          findings.push(...fileFindings);
        }
      } catch (error) {
        // Skip files that can't be accessed
      }
    });
  } catch (error) {
    // Skip directories that can't be read
  }

  return findings;
}

function generateReport(findings: Finding[]): string {
  const highSeverity = findings.filter((f) => f.severity === 'HIGH');
  const mediumSeverity = findings.filter((f) => f.severity === 'MEDIUM');
  const lowSeverity = findings.filter((f) => f.severity === 'LOW');

  let report = `# Robotic Response Detection Report\n\n`;
  report += `**Generated:** ${new Date().toISOString()}\n\n`;
  report += `## Summary\n\n`;
  report += `| Severity | Count |\n`;
  report += `|----------|-------|\n`;
  report += `| HIGH | ${highSeverity.length} |\n`;
  report += `| MEDIUM | ${mediumSeverity.length} |\n`;
  report += `| LOW | ${lowSeverity.length} |\n`;
  report += `| **TOTAL** | **${findings.length}** |\n\n`;

  // Group by category
  const byCategory = findings.reduce(
    (acc, finding) => {
      if (!acc[finding.category]) {
        acc[finding.category] = [];
      }
      acc[finding.category].push(finding);
      return acc;
    },
    {} as Record<string, Finding[]>
  );

  report += `## Findings by Category\n\n`;

  Object.entries(byCategory).forEach(([category, categoryFindings]) => {
    report += `### ${category} (${categoryFindings.length} found)\n\n`;

    categoryFindings.slice(0, 5).forEach((finding) => {
      const relativePath = finding.file.split('services')[1] || finding.file;
      report += `- **services${relativePath}:${finding.line}**\n`;
      report += `  \`${finding.content}\`\n\n`;
    });

    if (categoryFindings.length > 5) {
      report += `  _... and ${categoryFindings.length - 5} more_\n\n`;
    }
  });

  report += `## Recommendations\n\n`;

  if (highSeverity.length > 0) {
    report += `### HIGH PRIORITY (${highSeverity.length} issues)\n\n`;
    report += `1. **Replace hardcoded greetings** with \`dynamicResponseSystem.generateDynamicGreeting()\`\n`;
    report += `2. **Replace hardcoded capabilities** with \`dynamicResponseSystem.generateDynamicCapabilities()\`\n`;
    report += `3. **Remove robotic citation phrases** - state facts directly\n\n`;
  }

  if (mediumSeverity.length > 0) {
    report += `### MEDIUM PRIORITY (${mediumSeverity.length} issues)\n\n`;
    report += `1. **Remove formal labels** (Next step:, Tip:, etc.)\n`;
    report += `2. **Replace generic error messages** with context-aware errors\n`;
    report += `3. **Make file/folder listings conversational**\n\n`;
  }

  if (lowSeverity.length > 0) {
    report += `### LOW PRIORITY (${lowSeverity.length} issues)\n\n`;
    report += `1. **Make pagination messages conversational**\n`;
    report += `2. **Vary response structures** to prevent repetition\n\n`;
  }

  return report;
}

// Main execution
const servicesPath = path.join(process.cwd(), 'src/services');

console.log('Scanning for robotic responses...\n');
console.log(`Scanning: ${servicesPath}\n`);

const findings = scanDirectory(servicesPath);

console.log(`Found ${findings.length} potential robotic response patterns\n`);

// Print summary to console
const highCount = findings.filter((f) => f.severity === 'HIGH').length;
const mediumCount = findings.filter((f) => f.severity === 'MEDIUM').length;
const lowCount = findings.filter((f) => f.severity === 'LOW').length;

console.log('='.repeat(60));
console.log('ROBOTIC RESPONSE DETECTION SUMMARY');
console.log('='.repeat(60));
console.log(`\n  HIGH:   ${highCount}`);
console.log(`  MEDIUM: ${mediumCount}`);
console.log(`  LOW:    ${lowCount}`);
console.log(`  TOTAL:  ${findings.length}\n`);

// Group by category for display
const byCategory = findings.reduce(
  (acc, finding) => {
    if (!acc[finding.category]) {
      acc[finding.category] = [];
    }
    acc[finding.category].push(finding);
    return acc;
  },
  {} as Record<string, Finding[]>
);

console.log('-'.repeat(60));
console.log('FINDINGS BY CATEGORY');
console.log('-'.repeat(60));

Object.entries(byCategory).forEach(([category, categoryFindings]) => {
  const severity = categoryFindings[0]?.severity || 'UNKNOWN';
  const icon = severity === 'HIGH' ? '[HIGH]' : severity === 'MEDIUM' ? '[MED]' : '[LOW]';
  console.log(`\n${icon} ${category}: ${categoryFindings.length} instances`);

  // Show first 3 examples
  categoryFindings.slice(0, 3).forEach((finding) => {
    const fileName = path.basename(finding.file);
    console.log(`    - ${fileName}:${finding.line}`);
  });

  if (categoryFindings.length > 3) {
    console.log(`    ... and ${categoryFindings.length - 3} more`);
  }
});

// Generate and save report
const report = generateReport(findings);
const reportPath = path.join(process.cwd(), 'test-suite/reports/robotic-response-report.md');
fs.writeFileSync(reportPath, report);
console.log(`\nFull report saved to: ${reportPath}`);

// Overall assessment
console.log('\n' + '='.repeat(60));
console.log('ASSESSMENT');
console.log('='.repeat(60));

if (findings.length === 0) {
  console.log('\n[EXCELLENT] No robotic responses detected!');
  console.log('Koda\'s responses are natural and conversational.\n');
} else if (highCount === 0 && mediumCount < 5) {
  console.log('\n[GOOD] Minimal robotic patterns detected.');
  console.log('Most responses are natural. Minor improvements possible.\n');
} else if (highCount < 10) {
  console.log('\n[ACCEPTABLE] Some robotic patterns detected.');
  console.log('Consider addressing HIGH priority items for better UX.\n');
} else {
  console.log('\n[NEEDS WORK] Multiple robotic patterns detected.');
  console.log('Prioritize replacing hardcoded responses with dynamic generation.\n');
}

// Exit with appropriate code
process.exit(highCount > 20 ? 1 : 0);
