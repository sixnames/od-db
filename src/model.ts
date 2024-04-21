import fs from 'fs';
import path from 'path';
import _ from 'lodash';
import { nanoid } from 'nanoid';

export class ODModel<T> {
  collectionPath: string;

  constructor(collectionName: string) {
    this.collectionPath = path.join(__dirname, 'od-db', collectionName);

    // Create the collection directory if it doesn't exist
    if (!fs.existsSync(this.collectionPath)) {
      fs.mkdirSync(this.collectionPath, { recursive: true });
    }
  }

  async insertOne(document: T): Promise<string> {
    const id = (document as any).id || this.generateId();
    const filePath = path.join(this.collectionPath, `${id}.json`);

    try {
      await fs.promises.writeFile(filePath, JSON.stringify(document));
      return id;
    } catch (error) {
      throw new Error(`Error inserting document: ${error}`);
    }
  }

  async findOne(id: string): Promise<T | null> {
    const filePath = path.join(this.collectionPath, `${id}.json`);

    try {
      const data = await fs.promises.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      throw new Error(`Error finding document: ${error}`);
    }
  }

  async updateOne(id: string, update: Partial<T>): Promise<T> {
    const filePath = path.join(this.collectionPath, `${id}.json`);

    try {
      const existingData = await this.findOne(id);
      const updatedData = { ...existingData, ...update };
      await fs.promises.writeFile(filePath, JSON.stringify(updatedData));
      return updatedData as T;
    } catch (error) {
      throw new Error(`Error updating document: ${error}`);
    }
  }

  async updateMany(filter: Partial<T>, update: Partial<T>): Promise<void> {
    const files = await fs.promises.readdir(this.collectionPath);

    try {
      for (const file of files) {
        const filePath = path.join(this.collectionPath, file);
        const data = await fs.promises.readFile(filePath, 'utf8');
        const document = JSON.parse(data);

        // Check if the document matches the filter
        let match = true;
        for (const key in filter) {
          if (_.get(document, key) !== filter[key]) {
            match = false;
            break;
          }
        }

        if (match) {
          const updatedDocument = { ...document, ...update };
          await fs.promises.writeFile(filePath, JSON.stringify(updatedDocument));
        }
      }
    } catch (error) {
      throw new Error(`Error updating documents: ${error}`);
    }
  }

  async deleteOne(id: string): Promise<void | null> {
    const filePath = path.join(this.collectionPath, `${id}.json`);

    try {
      await fs.promises.unlink(filePath);
    } catch (error) {
      throw new Error(`Error deleting document: ${error}`);
    }
  }

  async find(query: Partial<T>): Promise<T[]> {
    const files = await fs.promises.readdir(this.collectionPath);
    const results: T[] = [];

    try {
      for (const file of files) {
        const filePath = path.join(this.collectionPath, file);
        const data = await fs.promises.readFile(filePath, 'utf8');
        const document = JSON.parse(data);

        let match = true;
        for (const key in query) {
          if (_.get(document, key) !== query[key]) {
            match = false;
            break;
          }
        }

        if (match) {
          results.push(document);
        }
      }
    } catch (error) {
      throw new Error(`Error finding documents: ${error}`);
    }

    return results;
  }

  private generateId(): string {
    return nanoid(); // Using nanoid for generating unique IDs
  }
}
