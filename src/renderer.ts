/**
 * This file will automatically be loaded by vite and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/tutorial/process-model
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 * To enable Node.js integration in this file, open up `main.ts` and enable the `nodeIntegration`
 * flag:
 *
 * ```
 *  // Create the browser window.
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 */

import "./index.css";
import { StudentSearchResult } from "./main";

// Alternative TypeScript implementation for renderer process
// Use this if you prefer to have your logic in a separate TypeScript file

interface IElectronAPI {
    selectFolder: () => Promise<string | null>;
    searchStudent: (folderPath: string, studentId: string) => Promise<StudentSearchResult[]>;
}

declare global {
    interface Window {
        electronAPI: IElectronAPI;
    }
}

class StudentSearchApp {
    private selectFolderBtn: HTMLButtonElement;
    private folderPathDiv: HTMLDivElement;
    private studentIdInput: HTMLInputElement;
    private searchBtn: HTMLButtonElement;
    private messageDiv: HTMLDivElement;
    private resultsSection: HTMLDivElement;
    private resultsSummary: HTMLDivElement;
    private resultsContainer: HTMLDivElement;

    private selectedFolderPath: string | null = null;

    constructor() {
        this.selectFolderBtn = document.getElementById('selectFolderBtn') as HTMLButtonElement;
        this.folderPathDiv = document.getElementById('folderPath') as HTMLDivElement;
        this.studentIdInput = document.getElementById('studentIdInput') as HTMLInputElement;
        this.searchBtn = document.getElementById('searchBtn') as HTMLButtonElement;
        this.messageDiv = document.getElementById('message') as HTMLDivElement;
        this.resultsSection = document.getElementById('resultsSection') as HTMLDivElement;
        this.resultsSummary = document.getElementById('resultsSummary') as HTMLDivElement;
        this.resultsContainer = document.getElementById('resultsContainer') as HTMLDivElement;

        this.init();
    }

    private init(): void {
        console.log('StudentSearchApp initialized');
        console.log('electronAPI available:', !!window.electronAPI);

        if (!window.electronAPI) {
            this.showMessage('electronAPI is not available. Check preload script.', 'error');
            return;
        }

        console.log('electronAPI methods:', Object.keys(window.electronAPI));

        this.setupEventListeners();
        this.initializeUI();
    }

    private initializeUI(): void {
        // Initialize UI state
        this.searchBtn.disabled = true;
        this.hideMessage();
        this.hideResults();

        // Set initial folder path message
        if (!this.selectedFolderPath) {
            this.folderPathDiv.textContent = 'No folder selected';
            this.folderPathDiv.classList.add('no-folder');
        }
    }

    private setupEventListeners(): void {
        // Folder selection
        this.selectFolderBtn.addEventListener('click', () => this.handleFolderSelection());

        // Student search
        this.searchBtn.addEventListener('click', () => this.handleStudentSearch());

        // Enter key support for search input
        this.studentIdInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !this.searchBtn.disabled) {
                this.handleStudentSearch();
            }
        });

        // Clear results when input changes
        this.studentIdInput.addEventListener('input', () => {
            if (this.resultsSection.style.display !== 'none') {
                this.hideResults();
            }
        });
    }

    private async handleFolderSelection(): Promise<void> {
        try {
            console.log('handleFolderSelection called');

            if (!window.electronAPI) {
                throw new Error('electronAPI is not available');
            }

            this.setButtonState(this.selectFolderBtn, true, 'Seleccionando...');
            this.hideMessage();

            console.log('Calling window.electronAPI.selectFolder()');
            const selectedPath = await window.electronAPI.selectFolder();
            console.log('selectFolder returned:', selectedPath);

            if (selectedPath) {
                this.selectedFolderPath = selectedPath;
                this.updateFolderPath(selectedPath);
                this.searchBtn.disabled = false;
                /* this.showMessage('Folder selected successfully!', 'success');

                // Auto-hide success message after 3 seconds
                setTimeout(() => {
                    if (this.messageDiv.classList.contains('success')) {
                        this.hideMessage();
                    }
                }, 3000); */
            } else {
                /* this.showMessage('No folder selected', 'warning'); */
            }
        } catch (error) {
            console.error('Error selecting folder:', error);
            this.showMessage(`Error selecting folder: ${(error as Error).message}`, 'error');
        } finally {
            this.setButtonState(this.selectFolderBtn, false, 'Buscar base de datos');
        }
    }

    private async handleStudentSearch(): Promise<void> {
        const studentId = this.studentIdInput.value.trim();

        if (!studentId) {
            this.showMessage('Ingresar Código PUCP', 'error');
            this.studentIdInput.focus();
            return;
        }

        if (!this.selectedFolderPath) {
            this.showMessage('Buscar base de datos primero', 'error');
            return;
        }

        try {
            console.log('handleStudentSearch called with:', { studentId, folderPath: this.selectedFolderPath });

            this.setButtonState(this.searchBtn, true, 'Buscando...');
            this.hideMessage();
            this.hideResults();

            this.showMessage('Buscando...', 'loading');

            const results = await window.electronAPI.searchStudent(this.selectedFolderPath, studentId);
            console.log('Search results:', results);

            this.hideMessage();
            this.displayResults(results, studentId);

        } catch (error) {
            console.error('Error searching student:', error);
            this.showMessage(`Error searching student: ${(error as Error).message}`, 'error');
            this.hideResults();
        } finally {
            this.setButtonState(this.searchBtn, false, 'Search');
        }
    }

    private setButtonState(button: HTMLButtonElement, disabled: boolean, text: string): void {
        button.disabled = disabled;
        button.textContent = text;
    }

    private updateFolderPath(path: string): void {
        this.folderPathDiv.textContent = path;
        this.folderPathDiv.classList.remove('no-folder');
        this.folderPathDiv.title = path; // Add tooltip for long paths
    }

    private showMessage(message: string, type: 'success' | 'error' | 'warning' | 'loading' | 'info'): void {
        this.messageDiv.textContent = message;
        this.messageDiv.className = `message ${type}`;
        this.messageDiv.style.display = 'block';

        // Add loading spinner for loading messages
        if (type === 'loading') {
            this.messageDiv.classList.add('loading-spinner');
        } else {
            this.messageDiv.classList.remove('loading-spinner');
        }
    }

    private hideMessage(): void {
        this.messageDiv.style.display = 'none';
        this.messageDiv.classList.remove('loading-spinner');
    }

    private getTotalPerStudent(results: StudentSearchResult[], type: 'cocurriculares' | 'liderazgo'): number {
        if (results.length === 0) {
            return 0;
        }
        let total = 0;
        for (const result of results) {
            total += this.getTotalPerMonth(result.data[type]);
        }
        return total;
    }

    private displayResults(results: StudentSearchResult[], studentId: string): void {
        if (results.length === 0) {
            this.showMessage(`No records found for Student ID: ${studentId}`, 'warning');
            this.hideResults();
            return;
        }

        // Show results section
        this.resultsSection.style.display = 'block';

        console.log('results', results);

        const totalCocurriculares = this.getTotalPerStudent(results, 'liderazgo') + this.getTotalPerStudent(results, 'cocurriculares');

        this.resultsSummary.innerHTML = `
            <p>Código PUCP: ${studentId}</p>
            <p>Total horas de liderazgo: ${this.getTotalPerStudent(results, 'liderazgo')} horas</p>
            <p>Total horas cocurriculares: ${totalCocurriculares} horas</p>
    `;

        // Clear previous results
        this.resultsContainer.innerHTML = '';

        // Group results by year/month for better organization
        const groupedResults = this.groupResultsByPeriod(results);

        // Display grouped results
        Object.keys(groupedResults).sort().reverse().forEach(period => {
            const periodResults = groupedResults[period];
            this.createPeriodSection(period, periodResults);
        });

        // Scroll to results
        this.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    private groupResultsByPeriod(results: StudentSearchResult[]): Record<string, StudentSearchResult[]> {
        return results.reduce((groups, result) => {
            const period = `${result.year}-${result.month.padStart(2, '0')}`;
            if (!groups[period]) {
                groups[period] = [];
            }
            groups[period].push(result);
            return groups;
        }, {} as Record<string, StudentSearchResult[]>);
    }

    private createPeriodSection(period: string, results: StudentSearchResult[]): void {
        const periodDiv = document.createElement('div');
        periodDiv.className = 'period-section';

        results.forEach(result => {
            const isCocuEmpty = this.isEmptyData(result.data.cocurriculares);
            const isLideEmpty = this.isEmptyData(result.data.liderazgo);

            const card = document.createElement('div');
            const divTitle = document.createElement('h3');
            const currentMonth = this.extractMonthRange(result.file);
            divTitle.innerText = currentMonth;

            if (!isCocuEmpty || !isLideEmpty) {
                card.appendChild(divTitle);
            }

            const cocuCard = this.createResultCard(result, 'cocurriculares');
            const lideCard = this.createResultCard(result, 'liderazgo');

            if (!isCocuEmpty) {
                card.appendChild(cocuCard);
            }
            if (!isLideEmpty) {
                card.appendChild(lideCard);
            }
            periodDiv.appendChild(card);
        });

        this.resultsContainer.appendChild(periodDiv);
    }

    private extractMonthRange(input: string): string | null {
        const match = input.match(/^Reporte de (.+?) - /);
        return match ? match[1].trim() : null;
    }

    private capitalizeFirst(str: string): string {
        if (!str) return '';
        return str[0].toUpperCase() + str.slice(1);
    }

    private createResultCard(result: StudentSearchResult, type: 'cocurriculares' | 'liderazgo'): HTMLElement {
        const card = document.createElement('div');
        const isEmpty = Object.keys(result.data[type]).length === 0;
        if (isEmpty) return card;

        card.className = 'result-card';

        const header = document.createElement('div');
        header.className = 'result-header';

        const currentMonth = this.extractMonthRange(result.file);
        header.innerHTML = `${this.capitalizeFirst(type)}`;

        const content = document.createElement('div');
        content.className = 'result-content';

        if (this.isEmptyData(result.data[type])) return card;

        // Display the data in a formatted way
        const dataTable = this.createDataTable(result.data[type], currentMonth);
        content.appendChild(dataTable);

        // Add file path info
        /* const pathInfo = document.createElement('div');
        pathInfo.className = 'path-info';
        pathInfo.innerHTML = `<small><strong>Path:</strong> ${result.filePath}</small>`;
        content.appendChild(pathInfo); */

        card.appendChild(header);
        card.appendChild(content);

        return card;
    }

    private getTotalPerMonth(data: Record<string, any>): number {
        let total = 0;
        if (this.isEmptyData(data)) return 0;
        Object.entries(data).forEach(([key, value]) => {
            if (value === null || value === undefined || value === '' || value === '-' || value === '/' || Number(value) === 0) {
                return;
            }
            const numeric = Number(value);
            if (!isNaN(numeric)) {
                total += numeric;
            }
        });
        return total;
    }

    private isEmptyData(data: Record<string, any>): boolean {
        return Object.entries(data).every(([key, value]) => {
            const trimmed = value.trim();
            return (trimmed === null || trimmed === undefined || trimmed === '' || trimmed === '-' || trimmed === '/' || Number(trimmed) === 0);
        });
    }

    private createDataTable(data: Record<string, any>, currentMonth: string): HTMLElement {
        const table = document.createElement('table');
        table.className = 'data-table';
        const tbody = document.createElement('tbody');

        if (this.isEmptyData(data)) return;

        Object.entries(data).forEach(([key, value]) => {
            console.log('value', value);
            // Skip empty values
            if (value === null || value === undefined || value === '' || value === '-' || value === '/' || Number(value) === 0) {
                return;
            }

            const row = document.createElement('tr');

            const keyCell = document.createElement('td');
            keyCell.className = 'data-key';
            if (key.includes('Revisiones pendientes')) {
                keyCell.classList.add('revisiones-pendientes');
            }
            keyCell.textContent = key;

            const valueCell = document.createElement('td');
            valueCell.className = 'data-value';
            if (key.includes('Revisiones pendientes')) {
                valueCell.classList.add('revisiones-pendientes');
            }
            valueCell.textContent = this.formatValue(value);

            row.appendChild(keyCell);
            row.appendChild(valueCell);
            tbody.appendChild(row);
        });
        table.appendChild(tbody);
        return table;
    }

    private formatValue(value: any): string {
        const isPlural = Number(value) > 1;
        return `${value} hora${isPlural ? 's' : ''}`;
    }

    private getMonthName(monthNumber: number): string {
        const months = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        return months[monthNumber - 1] || 'Unknown';
    }

    private hideResults(): void {
        this.resultsSection.style.display = 'none';
        this.resultsContainer.innerHTML = '';
    }

    // Public method to programmatically set folder (useful for testing)
    public setFolder(folderPath: string): void {
        this.selectedFolderPath = folderPath;
        this.updateFolderPath(folderPath);
        this.searchBtn.disabled = false;
    }

    // Public method to programmatically search (useful for testing)
    public async searchStudent(studentId: string): Promise<void> {
        this.studentIdInput.value = studentId;
        await this.handleStudentSearch();
    }

    // Public method to get current folder
    public getCurrentFolder(): string | null {
        return this.selectedFolderPath;
    }
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
    new StudentSearchApp();
});


