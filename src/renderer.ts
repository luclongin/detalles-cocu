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

// Alternative TypeScript implementation for renderer process
// Use this if you prefer to have your logic in a separate TypeScript file

interface IElectronAPI {
  selectFolder: () => Promise<string | null>;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}

class FolderSelector {
  private selectFolderBtn: HTMLButtonElement;
  private folderPathDiv: HTMLDivElement;
  private errorDiv: HTMLDivElement;

  constructor() {
    this.selectFolderBtn = document.getElementById(
      "selectFolderBtn",
    ) as HTMLButtonElement;
    this.folderPathDiv = document.getElementById(
      "folderPath",
    ) as HTMLDivElement;
    this.errorDiv = document.getElementById("error") as HTMLDivElement;

    this.init();
  }

  private init(): void {
    this.selectFolderBtn.addEventListener("click", () =>
      this.handleFolderSelection(),
    );
  }

  private async handleFolderSelection(): Promise<void> {
    try {
      this.setButtonState(true, "Buscando...");
      this.hideError();

      const selectedPath = await window.electronAPI.selectFolder();

      if (selectedPath) {
        this.updateFolderPath(selectedPath);
      }
    } catch (error) {
      console.error("Error selecting folder:", error);
      this.showError(`Error selecting folder: ${(error as Error).message}`);
    } finally {
      this.setButtonState(false, "Buscar carpeta principal");
    }
  }

  private setButtonState(disabled: boolean, text: string): void {
    this.selectFolderBtn.disabled = disabled;
    this.selectFolderBtn.textContent = text;
  }

  private updateFolderPath(path: string): void {
    this.folderPathDiv.textContent = path;
    this.folderPathDiv.classList.remove("no-folder");
  }

  private showError(message: string): void {
    this.errorDiv.textContent = message;
    this.errorDiv.style.display = "block";
  }

  private hideError(): void {
    this.errorDiv.style.display = "none";
  }
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new FolderSelector();
});
