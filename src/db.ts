import fs from 'fs';
import path from 'path';
import { isAfter, subDays } from 'date-fns';

interface ErrnoException extends Error {
  errno?: number | undefined;
  code?: string | undefined;
  path?: string | undefined;
  syscall?: string | undefined;
}

export class ODDb {
  async getConfigs<T>(fallback: T): Promise<T> {
    const fullFilePath = path.join(process.cwd(), 'od-db', 'config.json');
    if (!fs.existsSync(fullFilePath)) {
      return fallback;
    }
    const fileContent = fs.readFileSync(fullFilePath, 'utf8');
    return JSON.parse(fileContent) as T;
  }

  async getCastConfig<T>(fallback: T): Promise<T> {
    const fullFilePath = path.join(process.cwd(), 'od-db', 'castConfig.json');
    if (!fs.existsSync(fullFilePath)) {
      return fallback;
    }
    const fileContent = fs.readFileSync(fullFilePath, 'utf8');
    return JSON.parse(fileContent) as T;
  }

  async backup() {
    console.log('>>>> Backing up db...');
    const parentDir = path.join(process.cwd(), '..');
    const backupPath = path.join(parentDir, `od-db-backup`);
    const dbPath = path.join(process.cwd(), `od-db`);

    // check if backup directory exists
    if (!fs.existsSync(backupPath)) {
      fs.mkdirSync(backupPath, { recursive: true });
    }
    const backupDir = fs.readdirSync(backupPath);

    const today = new Date();
    const backupDaysLimit = 30;
    const latestBackupDate = subDays(today, backupDaysLimit);

    console.log('>>>> Removing old backup...');
    const oldBackups = backupDir.filter((dir) => {
      const nameArray = dir.split('-');
      const dirYear = Number(nameArray[0]);
      const dirMonth = Number(nameArray[1]);
      const dirDay = Number(nameArray[2]);
      const dirDate = new Date(dirYear, dirMonth - 1, dirDay);

      return isAfter(latestBackupDate, dirDate);
    });

    oldBackups.forEach((dir) => {
      this.rmdir(path.join(backupPath, dir));
      console.log(`>>>> Removed ${dir}`);
    });

    console.log('>>>> Creating new backup...');
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const day = today.getDate();

    const todayBackups = backupDir.filter((dir) => {
      const nameArray = dir.split('-');
      const dirYear = Number(nameArray[0]);
      const dirMonth = Number(nameArray[1]);
      const dirDay = Number(nameArray[2]);
      return dirYear === year && dirMonth === month && dirDay === day;
    });

    const newDirName = `${year}-${month}-${day}-${todayBackups.length + 1}`;
    const backupDirPath = path.join(backupPath, newDirName);
    this.copyDir(dbPath, backupDirPath);
    console.log('>>>> Backup ready <<<<');
  }

  private mkdir(dir: string) {
    try {
      fs.mkdirSync(dir);
    } catch (e) {
      const error = e as ErrnoException;
      if (error.code != 'EEXIST') {
        throw e;
      }
    }
  }

  private rmdir(dir: string) {
    if (fs.existsSync(dir)) {
      const list = fs.readdirSync(dir);
      for (let i = 0; i < list.length; i++) {
        const filename = path.join(dir, list[i]);
        const stat = fs.statSync(filename);

        if (filename === '.' || filename === '..') {
          // pass these files
        } else if (stat.isDirectory()) {
          // rmdir recursively
          this.rmdir(filename);
        } else {
          // rm filename
          fs.unlinkSync(filename);
        }
      }
      fs.rmdirSync(dir);
    } else {
      console.warn('warn: ' + dir + ' not exists');
    }
  }

  private copyFile(source: string, destination: string) {
    const oldFile = fs.createReadStream(source);
    const newFile = fs.createWriteStream(destination);
    oldFile.pipe(newFile);
  }

  private copyDir(source: string, destination: string) {
    this.mkdir(destination);
    const files = fs.readdirSync(source);
    for (let i = 0; i < files.length; i++) {
      const current = fs.lstatSync(path.join(source, files[i]));
      if (current.isDirectory()) {
        this.copyDir(path.join(source, files[i]), path.join(destination, files[i]));
      } else if (current.isSymbolicLink()) {
        const symlink = fs.readlinkSync(path.join(source, files[i]));
        fs.symlinkSync(symlink, path.join(destination, files[i]));
      } else {
        this.copyFile(path.join(source, files[i]), path.join(destination, files[i]));
      }
    }
  }
}
