import { contextBridge, ipcRenderer } from "electron";

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electronAPI", {
  selectFolder: () => {
    return ipcRenderer.invoke("select-folder");
  },
  searchStudent: (folderPath: string, studentId: string) => {
    console.log("searchStudent called from renderer", {
      folderPath,
      studentId,
    }); // Debug log
    return ipcRenderer.invoke("search-student", folderPath, studentId);
  },
});
