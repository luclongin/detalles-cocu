import { app, BrowserWindow, ipcMain, dialog } from "electron";
import path from "node:path";
import started from "electron-squirrel-startup";
import fs from "fs";
import Store from "electron-store";
import * as XLSX from "xlsx";

export interface StudentSearchResult {
  file: string;
  filePath: string;
  sheet: string;
  year: string;
  month: string;
  rowIndex: number;
  data: {
    cocurriculares: Record<string, any>;
    liderazgo: Record<string, any>;
  };
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const store = new Store();

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

// IPC handler for folder selection
ipcMain.handle("select-folder", async () => {
  /* const result = await dialog.showOpenDialog({
    properties: ["openDirectory"],
  });
  if (result.canceled) {
    return null;
  }
  return result.filePaths[0]; */
  return '/Users/luc/Downloads/basededatos';
});

// Handler for student search
ipcMain.handle('search-student', async (event, folderPath: string, studentId: string): Promise<StudentSearchResult[]> => {
  console.log('search-student handler called', { folderPath, studentId });

  try {
    const results: StudentSearchResult[] = [];

    // Validate inputs
    if (!folderPath || !studentId) {
      throw new Error('Folder path and student ID are required');
    }

    // Check if folder exists
    if (!fs.existsSync(folderPath)) {
      throw new Error('Selected folder does not exist');
    }

    // Recursively find all Excel files
    const excelFiles = findExcelFilesRecursively(folderPath);
    console.log('Total Excel files found recursively:', excelFiles.length);

    if (excelFiles.length === 0) {
      throw new Error('No Excel files found in the selected folder or its subfolders');
    }

    // Process each Excel file
    for (const fileInfo of excelFiles) {
      try {
        console.log('Processing file:', fileInfo.relativePath);
        const fileResults = await searchInExcelFile(fileInfo.fullPath, fileInfo.fileName, studentId);
        results.push(...fileResults);
      } catch (fileError) {
        console.error(`Error processing file ${fileInfo.relativePath}:`, fileError);
        // Continue with other files even if one fails
      }
    }

    console.log('Search completed. Total results:', results.length);
    return results;

  } catch (error) {
    console.error('Error in search-student handler:', error);
    throw error;
  }
});



// ===============================
// HELPER FUNCTIONS
// ===============================

interface FileInfo {
  fullPath: string;
  fileName: string;
  relativePath: string;
  folderPath: string;
}

function findExcelFilesRecursively(rootPath: string): FileInfo[] {
  const excelFiles: FileInfo[] = [];

  function searchDirectory(currentPath: string): void {
    try {
      const items = fs.readdirSync(currentPath);

      for (const item of items) {
        const itemPath = path.join(currentPath, item);
        const stats = fs.statSync(itemPath);

        if (stats.isDirectory()) {
          // Skip hidden directories and common non-data folders
          if (!item.startsWith('.') &&
            !['node_modules', 'dist', 'build', '__pycache__'].includes(item.toLowerCase())) {
            console.log('Searching subfolder:', item);
            searchDirectory(itemPath);
          }
        } else if (stats.isFile()) {
          // IS TEMPORARY EXCEL FILE
          if (item.includes('~$')) continue;

          // Check if it's an Excel file
          const extension = path.extname(item).toLowerCase();
          if (extension === '.xlsx' || extension === '.xls') {
            const relativePath = path.relative(rootPath, itemPath);
            const folderPath = path.dirname(itemPath);

            excelFiles.push({
              fullPath: itemPath,
              fileName: item,
              relativePath: relativePath,
              folderPath: folderPath
            });

            console.log('Found Excel file:', relativePath);
          }
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${currentPath}:`, error);
    }
  }

  searchDirectory(rootPath);
  return excelFiles;
}

async function searchInExcelFile(filePath: string, fileName: string, studentId: string): Promise<StudentSearchResult[]> {
  const results: StudentSearchResult[] = [];

  try {
    // Check if file exists and is accessible
    if (!fs.existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }

    // Check file permissions
    try {
      fs.accessSync(filePath, fs.constants.R_OK);
    } catch (accessError) {
      throw new Error(`Cannot read file (permission denied): ${filePath}`);
    }

    // Get file stats to check if it's actually a file
    const stats = fs.statSync(filePath);
    if (!stats.isFile()) {
      throw new Error(`Path is not a file: ${filePath}`);
    }

    // Check file size (skip if too large or empty)
    if (stats.size === 0) {
      throw new Error(`File is empty: ${filePath}`);
    }

    if (stats.size > 100 * 1024 * 1024) { // 100MB limit
      throw new Error(`File too large (${Math.round(stats.size / 1024 / 1024)}MB): ${filePath}`);
    }

    console.log(`Reading Excel file: ${fileName} (${Math.round(stats.size / 1024)}KB)`);

    // Try to read the Excel file with error handling
    let workbook;
    try {
      workbook = XLSX.readFile(filePath, {
        cellDates: true,
        cellNF: false,
        cellText: false,
        cellStyles: true
      });
    } catch (xlsxError) {
      // Try alternative reading method
      console.log(`Standard XLSX read failed, trying buffer method for: ${fileName}`);
      try {
        const buffer = fs.readFileSync(filePath);
        workbook = XLSX.read(buffer, {
          type: 'buffer',
          cellDates: true,
          cellNF: false,
          cellText: false,
          cellStyles: true
        });
      } catch (bufferError) {
        throw new Error(`Cannot parse Excel file: ${(xlsxError as Error).message}`);
      }
    }

    if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error(`No worksheets found in file: ${filePath}`);
    }

    // Extract year and month from filename or folder structure
    const { year, month } = extractDateFromPath(filePath, fileName);

    console.log(`Processing ${workbook.SheetNames.length} sheets in ${fileName}`);

    // Helper function to get cell comment text
    function getCellComment(worksheet: any, cellAddress: string): string {
      const cell = worksheet[cellAddress];
      if (cell && cell.c && Array.isArray(cell.c)) {
        return cell.c.map((comment: any) => comment.t || '').join(' ').trim();
      }
      return '';
    }

    // Helper function to convert column index to Excel column letter
    function columnIndexToLetter(index: number): string {
      let result = '';
      while (index >= 0) {
        result = String.fromCharCode(65 + (index % 26)) + result;
        index = Math.floor(index / 26) - 1;
      }
      return result;
    }

    // Process each worksheet
    workbook.SheetNames.forEach((sheetName, sheetIndex) => {
      try {
        console.log(`  Processing sheet ${sheetIndex + 1}/${workbook.SheetNames.length}: ${sheetName}`);

        const worksheet = workbook.Sheets[sheetName];

        if (!worksheet) {
          console.log(`    Sheet ${sheetName} is empty or invalid`);
          return;
        }

        // Convert sheet to JSON with better error handling
        let data;
        try {
          data = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            defval: '',
            raw: false,
            dateNF: 'yyyy-mm-dd'
          });
        } catch (conversionError) {
          console.error(`    Error converting sheet ${sheetName}:`, conversionError);
          return;
        }

        if (!data || data.length === 0) {
          console.log(`    Sheet ${sheetName} has no data`);
          return;
        }

        // Assume first row contains headers
        const originalHeaders = data[0] as string[];
        const rows = data.slice(1);

        if (!originalHeaders || originalHeaders.length === 0) {
          console.log(`    Sheet ${sheetName} has no headers`);
          return;
        }

        // Use original headers as-is (we'll append comments to individual data cells)
        const headers = originalHeaders.map(header => String(header || '').trim());

        console.log(`    Sheet has ${headers.length} columns and ${rows.length} data rows`);

        // Find student ID column (flexible search)
        const studentIdColumnIndex = findStudentIdColumn(headers);

        if (studentIdColumnIndex === -1) {
          console.log(`    No student ID column found in sheet ${sheetName}`);
          console.log(`    Available columns: ${headers.filter(h => h).join(', ')}`);
          return;
        }

        console.log(`    Student ID column found at index ${studentIdColumnIndex}: "${headers[studentIdColumnIndex]}"`);

        // Find the special columns (using original headers)
        const revisionesPendientesCocurricularesIndex = headers.findIndex(header =>
          String(header || '').toLowerCase().trim() === 'revisiones pendientes cocurriculares'
        );

        const revisionesPendientesLiderazgoIndex = headers.findIndex(header =>
          String(header || '').toLowerCase().trim() === 'revisiones pendientes liderazgo'
        );

        // Search for the student ID
        let matchCount = 0;
        rows.forEach((row: any[], rowIndex) => {
          if (!row || row.length <= studentIdColumnIndex) {
            return;
          }

          const cellValue = String(row[studentIdColumnIndex] || '').trim();

          if (cellValue === studentId) {
            matchCount++;

            // Helper function to get header with comment if applicable
            const getHeaderWithComment = (header: string, actualColIndex: number, currentRowIndex: number): string => {
              const headerStr = String(header || '').trim();

              if (headerStr.toLowerCase().includes('revisiones pendientes')) {
                const cellAddress = `${columnIndexToLetter(actualColIndex)}${currentRowIndex + 2}`; // +2 because rowIndex is 0-based and we have header row
                const comment = getCellComment(worksheet, cellAddress);

                if (comment) {
                  return `${headerStr} - ${comment}`;
                }
              }

              return headerStr;
            };

            // Handle column structure scenarios
            let cocurricularesData: Record<string, any> = {};
            let liderazgoData: Record<string, any> = {};

            if (revisionesPendientesCocurricularesIndex !== -1 && revisionesPendientesLiderazgoIndex !== -1) {
              // Scenario 1: Both columns exist
              // Cocurriculares: from "Revisiones pendientes cocurriculares" to before "Revisiones pendientes liderazgo"
              const cocurricularesHeaders = headers.slice(revisionesPendientesCocurricularesIndex, revisionesPendientesLiderazgoIndex);
              cocurricularesHeaders.forEach((header, colIndex) => {
                const actualColIndex = revisionesPendientesCocurricularesIndex + colIndex;
                if (header && actualColIndex < row.length && row[actualColIndex] !== undefined && row[actualColIndex] !== '') {
                  const headerWithComment = getHeaderWithComment(header, actualColIndex, rowIndex);
                  cocurricularesData[headerWithComment] = row[actualColIndex];
                }
              });

              // Liderazgo: from "Revisiones pendientes liderazgo" to end
              const liderazgoHeaders = headers.slice(revisionesPendientesLiderazgoIndex);
              liderazgoHeaders.forEach((header, colIndex) => {
                const actualColIndex = revisionesPendientesLiderazgoIndex + colIndex;
                if (header && actualColIndex < row.length && row[actualColIndex] !== undefined && row[actualColIndex] !== '') {
                  const headerWithComment = getHeaderWithComment(header, actualColIndex, rowIndex);
                  liderazgoData[headerWithComment] = row[actualColIndex];
                }
              });

            } else if (revisionesPendientesCocurricularesIndex !== -1) {
              // Scenario 2: Only cocurriculares exists
              // Cocurriculares: from "Revisiones pendientes cocurriculares" to end
              const cocurricularesHeaders = headers.slice(revisionesPendientesCocurricularesIndex);
              cocurricularesHeaders.forEach((header, colIndex) => {
                const actualColIndex = revisionesPendientesCocurricularesIndex + colIndex;
                if (header && actualColIndex < row.length && row[actualColIndex] !== undefined && row[actualColIndex] !== '') {
                  const headerWithComment = getHeaderWithComment(header, actualColIndex, rowIndex);
                  cocurricularesData[headerWithComment] = row[actualColIndex];
                }
              });
              // Liderazgo remains empty

            } else if (revisionesPendientesLiderazgoIndex !== -1) {
              // Scenario 3: Only liderazgo exists
              // Liderazgo: from "Revisiones pendientes liderazgo" to end
              const liderazgoHeaders = headers.slice(revisionesPendientesLiderazgoIndex);
              liderazgoHeaders.forEach((header, colIndex) => {
                const actualColIndex = revisionesPendientesLiderazgoIndex + colIndex;
                if (header && actualColIndex < row.length && row[actualColIndex] !== undefined && row[actualColIndex] !== '') {
                  const headerWithComment = getHeaderWithComment(header, actualColIndex, rowIndex);
                  liderazgoData[headerWithComment] = row[actualColIndex];
                }
              });
              // Cocurriculares remains empty
            }

            results.push({
              file: fileName,
              filePath: filePath,
              sheet: sheetName,
              year: year,
              month: month,
              rowIndex: rowIndex + 1, // +1 because we removed headers
              data: {
                cocurriculares: cocurricularesData,
                liderazgo: liderazgoData
              },
            });
          }
        });

        console.log(`    Found ${matchCount} matches for student ID "${studentId}" in sheet ${sheetName}`);

      } catch (sheetError) {
        console.error(`    Error processing sheet ${sheetName}:`, sheetError);
      }
    });

  } catch (error) {
    console.error(`Error reading Excel file ${fileName}:`, error);
    throw error;
  }

  return results;
}
function extractDateFromPath(filePath: string, fileName: string): { year: string; month: string } {
  // First try to extract from folder structure (e.g., /path/to/2024/01/file.xlsx)
  const pathParts = filePath.split(path.sep);

  // Look for year and month in path
  let year = '';
  let month = '';

  for (let i = pathParts.length - 1; i >= 0; i--) {
    const part = pathParts[i];

    // Check if this part is a 4-digit year
    if (/^\d{4}$/.test(part) && parseInt(part) >= 2000 && parseInt(part) <= 2099) {
      year = part;

      // Look for month in adjacent parts
      if (i + 1 < pathParts.length) {
        const nextPart = pathParts[i + 1];
        const monthNum = extractMonthFromFolderName(nextPart);
        if (monthNum) {
          month = monthNum.padStart(2, '0');
        }
      }
      if (i - 1 >= 0 && !month) {
        const prevPart = pathParts[i - 1];
        const monthNum = extractMonthFromFolderName(prevPart);
        if (monthNum) {
          month = monthNum.padStart(2, '0');
        }
      }
      break;
    }

    // Also check if current part contains month info
    if (!year) {
      const monthNum = extractMonthFromFolderName(part);
      if (monthNum) {
        month = monthNum.padStart(2, '0');
        // Look for year in adjacent parts
        if (i + 1 < pathParts.length) {
          const nextPart = pathParts[i + 1];
          if (/^\d{4}$/.test(nextPart) && parseInt(nextPart) >= 2000 && parseInt(nextPart) <= 2099) {
            year = nextPart;
          }
        }
        if (i - 1 >= 0 && !year) {
          const prevPart = pathParts[i - 1];
          if (/^\d{4}$/.test(prevPart) && parseInt(prevPart) >= 2000 && parseInt(prevPart) <= 2099) {
            year = prevPart;
          }
        }
      }
    }
  }

  // If not found in path, try filename
  if (!year || !month) {
    const fileDate = extractDateFromFilename(fileName);
    if (!year) year = fileDate.year;
    if (!month) month = fileDate.month;
  }

  return { year, month };
}

function extractMonthFromFolderName(folderName: string): string | null {
  // Handle various month formats
  const folder = folderName.toLowerCase().trim();

  // Direct month number (with or without leading zero)
  const monthMatch = folder.match(/^(\d{1,2})\.?\s/);
  if (monthMatch) {
    const monthNum = parseInt(monthMatch[1]);
    if (monthNum >= 1 && monthNum <= 12) {
      return monthNum.toString();
    }
  }

  // Spanish month names
  const spanishMonths: Record<string, string> = {
    'enero': '1', 'jan': '1', 'january': '1',
    'febrero': '2', 'feb': '2', 'february': '2',
    'marzo': '3', 'mar': '3', 'march': '3',
    'abril': '4', 'abr': '4', 'apr': '4', 'april': '4',
    'mayo': '5', 'may': '5',
    'junio': '6', 'jun': '6', 'june': '6', 'julio': '6', 'jul': '6', 'july': '7',
    'agosto': '8', 'ago': '8', 'aug': '8', 'august': '8',
    'septiembre': '9', 'setiembre': '9', 'sep': '9', 'september': '9',
    'octubre': '10', 'oct': '10', 'october': '10',
    'noviembre': '11', 'nov': '11', 'november': '11',
    'diciembre': '12', 'dic': '12', 'dec': '12', 'december': '12'
  };

  // Fix: Julio should be month 7, not 6
  spanishMonths['julio'] = '7';
  spanishMonths['jul'] = '7';

  // Check for month names in folder
  for (const [monthName, monthNum] of Object.entries(spanishMonths)) {
    if (folder.includes(monthName)) {
      return monthNum;
    }
  }

  // Standard month number check (01-12)
  if (/^(0?[1-9]|1[0-2])$/.test(folder)) {
    return parseInt(folder).toString();
  }

  return null;
}

function extractDateFromFilename(fileName: string): { year: string; month: string } {
  // Try to extract year and month from filename
  // Supports formats like: MBA_2024_01.xlsx, 2024-01-MBA.xlsx, etc.

  const patterns = [
    /(\d{4})[-_](\d{2})/,  // 2024-01 or 2024_01
    /(\d{4})(\d{2})/,      // 202401
    /(\d{2})[-_](\d{4})/,  // 01-2024 or 01_2024
  ];

  for (const pattern of patterns) {
    const match = fileName.match(pattern);
    if (match) {
      const [, first, second] = match;

      // Determine which is year and which is month
      if (first.length === 4) {
        return { year: first, month: second };
      } else {
        return { year: second, month: first };
      }
    }
  }

  // Default fallback
  const now = new Date();
  return {
    year: now.getFullYear().toString(),
    month: (now.getMonth() + 1).toString().padStart(2, '0')
  };
}

function findStudentIdColumn(headers: string[]): number {
  // Common variations of student ID column names
  const studentIdVariations = [
    'cod',
    'COD',
    'CÓDIGO',
    'código',
    'codigo',
    'CODIGO',
    'FV',
    'fv',
    'fff'
  ];

  for (let i = 0; i < headers.length; i++) {
    const header = String(headers[i] || '').toLowerCase().trim();

    if (studentIdVariations.some(variation =>
      header === variation || header.includes(variation)
    )) {
      return i;
    }
  }

  return -1; // Not found
}