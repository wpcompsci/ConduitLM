// Markdown to PDF Generator
// Ported from Kortex background.js
(function (scope) {
    scope.generateMarkdownPdf = async function (markdownContent) {
        // Ensure jsPDF is available
        const { jsPDF } = globalThis.jspdf || {};
        if (!jsPDF) {
            throw new Error("jsPDF library not loaded");
        }

        const doc = new jsPDF();

        // --- PDF Styling Configuration ---
        const PAGE_WIDTH = doc.internal.pageSize.getWidth();
        const MARGIN = 15;
        const MAX_WIDTH = PAGE_WIDTH - MARGIN * 2;
        const FONT_SIZES = { h1: 18, h2: 16, h3: 14, body: 11, code: 10 };

        let cursorY = MARGIN; // Start drawing from the top margin

        // Helper to check for page overflow and add a new page if needed
        const checkPageBreak = neededHeight => {
            if (cursorY + neededHeight > doc.internal.pageSize.getHeight() - MARGIN) {
                doc.addPage();
                cursorY = MARGIN;
            }
        };

        const lines = markdownContent.split('\n');

        for (const line of lines) {
            if (line.startsWith('### ')) {
                const text = line.substring(4);
                checkPageBreak(FONT_SIZES.h3);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(FONT_SIZES.h3);
                doc.text(text, MARGIN, cursorY, { maxWidth: MAX_WIDTH });
                cursorY += FONT_SIZES.h3 * 0.7; // Tighter spacing after a heading
            } else if (line.startsWith('## ')) {
                const text = line.substring(3);
                checkPageBreak(FONT_SIZES.h2);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(FONT_SIZES.h2);
                doc.text(text, MARGIN, cursorY, { maxWidth: MAX_WIDTH });
                cursorY += FONT_SIZES.h2 * 0.7;
            } else if (line.startsWith('# ')) {
                const text = line.substring(2);
                checkPageBreak(FONT_SIZES.h1);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(FONT_SIZES.h1);
                doc.text(text, MARGIN, cursorY, { maxWidth: MAX_WIDTH });
                cursorY += FONT_SIZES.h1 * 0.7;
            } else if (line.startsWith('> ')) {
                const text = line.substring(2);
                doc.setFont('helvetica', 'italic');
                doc.setFontSize(FONT_SIZES.body);

                const splitText = doc.splitTextToSize(text, MAX_WIDTH - 5); // Indent blockquotes
                checkPageBreak(splitText.length * FONT_SIZES.body * 0.5);

                // Draw a vertical line for the blockquote
                doc.setDrawColor(200, 200, 200); // Light grey
                doc.rect(
                    MARGIN,
                    cursorY - FONT_SIZES.body * 0.5,
                    1,
                    splitText.length * FONT_SIZES.body * 0.5 + 2
                );

                doc.setTextColor(100, 100, 100); // Grey text
                doc.text(splitText, MARGIN + 5, cursorY);
                doc.setTextColor(0, 0, 0); // Reset text color
                cursorY += splitText.length * FONT_SIZES.body * 0.5;
            } else if (line.trim() === '---') {
                checkPageBreak(10);
                doc.setDrawColor(150, 150, 150);
                doc.line(MARGIN, cursorY, PAGE_WIDTH - MARGIN, cursorY); // Horizontal line
                cursorY += 5;
            } else if (line.trim().length > 0) {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(FONT_SIZES.body);
                const splitText = doc.splitTextToSize(line, MAX_WIDTH);
                checkPageBreak(splitText.length * FONT_SIZES.body * 0.5);
                doc.text(splitText, MARGIN, cursorY);
                cursorY += splitText.length * FONT_SIZES.body * 0.5;
            }

            // Add a bit of space after every element
            cursorY += 5;
        }

        return doc.output('blob');
    };
})(globalThis);
