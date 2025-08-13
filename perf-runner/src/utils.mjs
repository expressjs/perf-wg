import { readdirSync, statSync } from 'fs';

/**
 * Get all subfolders (tests) inside TEST_DIR
 */
export function getTestFolders(path) {
  return readdirSync(path).filter((name) => {
    const fullPath = `${path}/${name}`;
    return statSync(fullPath).isDirectory();
  });
}

/**
 * Create table formatting utilities
 */
export function formatTable(headers, tableData) {
  const colWidths = [20, 12, 12, 12, 12, 12];

  // Calculate actual column widths based on content
  tableData.forEach((row) => {
    headers.forEach((header, i) => {
      const content = i === 0 ? row[i] : row[i];
      colWidths[i] = Math.max(colWidths[i], content.toString().length + 2);
    });
  });

  // Print header
  let output = '';

  const headerRow = headers
    .map((header, i) => header.padEnd(colWidths[i]))
    .join('| ');
  const separatorRow = colWidths.map((width) => '-'.repeat(width)).join('|-');

  output += `| ${headerRow}|\n`;
  output += `|-${separatorRow}|\n`;

  // Print data rows
  tableData.forEach((row) => {
    const dataRow = row
      .map((cell, i) => cell.toString().padEnd(colWidths[i]))
      .join('| ');
    output += `| ${dataRow}|\n`;
  });

  return output;
}
