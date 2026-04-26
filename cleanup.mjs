import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FILES_TO_RESTORE = ['jobs.json', 'timeline.json'];

function isProcessRunning(pattern) {
    try {
        const output = execSync(`tasklist /FI "IMAGENAME eq ${pattern}"`).toString();
        return output.toLowerCase().includes(pattern.toLowerCase());
    } catch (e) {
        return false;
    }
}

function checkLocks() {
    console.log("Checking for potential file locks...");
    const nodeRunning = isProcessRunning('node.exe');
    const pythonRunning = isProcessRunning('python.exe');
    
    if (nodeRunning || pythonRunning) {
        console.warn("WARNING: Node or Python processes are active. They might hold locks on JSON files.");
    }
}

function cleanup() {
    checkLocks();

    FILES_TO_RESTORE.forEach(file => {
        const filePath = path.join(__dirname, file);
        const backupPath = `${filePath}.bak`;
        
        if (fs.existsSync(backupPath)) {
            console.log(`Restoring ${file} from backup...`);
            fs.copyFileSync(backupPath, filePath);
        } else {
            if (fs.existsSync(filePath)) {
                console.log(`No backup found for ${file}. Creating baseline backup now.`);
                fs.copyFileSync(filePath, backupPath);
            } else {
                console.warn(`WARNING: File ${file} not found in ${__dirname}`);
            }
        }
    });

    console.log("Cleanup complete. Workspace restored to 'Stable Zero'.");
}

cleanup();
