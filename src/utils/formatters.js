// Source Formatters
// Ported from Kortex background.js
(function (scope) {
  scope.sourceFormatters = {
    md: (sourceName, snippets) => {
      // 1. Create YAML Front Matter for metadata
      const frontMatter = `---
sourceFile: "${sourceName}"
exportedBy: "ConduitLM"
exportDate: "${new Date().toISOString()}"
---

`;

      let body = `# ${sourceName}\n\n`;

      // 2. Intelligently process each snippet
      // Check if snippets is an array, if not treat as single string or empty
      const lines = Array.isArray(snippets) ? snippets : snippets ? [snippets] : [];

      lines.forEach((line) => {
        // If the line is an object (e.g. from chat), try to extract content
        let text = line;
        if (typeof line === 'object' && line.content) {
          text = line.content;
        }
        if (typeof text !== 'string') return;

        // Trim whitespace from the line
        const trimmedLine = text.trim();
        if (!trimmedLine) return; // Skip empty lines

        // Regex to find numbered headings like "1. Title" or "2.3. Subsection"
        if (/^\d+(\.\d+)*\.\s+[A-Z]/.test(trimmedLine)) {
          const level = (trimmedLine.match(/\./g) || []).length + 2; // e.g., "1." is h2, "1.1." is h3
          body += `${'#'.repeat(level)} ${trimmedLine}\n\n`;

          // Regex for bullet points (using various common bullet characters)
        } else if (/^[\*•-]\s+/.test(trimmedLine)) {
          // Ensure it's treated as a list item
          body += `${trimmedLine}\n`;

          // Heuristic for title-case, short lines to be treated as headings
        } else if (
          trimmedLine.length < 80 &&
          /^[A-Z][A-Za-z\s]+$/.test(trimmedLine) &&
          !trimmedLine.endsWith('.')
        ) {
          body += `## ${trimmedLine}\n\n`;

          // Otherwise, treat it as a standard paragraph
        } else {
          body += `${trimmedLine}\n\n`;
        }
      });

      return frontMatter + body;
    },
    txt: (sourceName, snippets) => {
      const header = `Source: ${sourceName}\nExported via ConduitLM: ${new Date().toLocaleString()}\n====================\n\n`;
      const lines = Array.isArray(snippets) ? snippets : snippets ? [snippets] : [];
      const body = lines.map((l) => (typeof l === 'object' ? l.content : l)).join('\n\n');
      return header + body;
    },
  };
})(globalThis);
