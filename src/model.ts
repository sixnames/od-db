import fs from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';
import { ODFilter, ODModelBase } from './types';
import { get, isObject } from 'lodash';

export class ODModel<T extends ODModelBase> {
  collectionPath: string;

  constructor(collectionName: string) {
    this.collectionPath = path.join(process.cwd(), 'od-db', collectionName);

    // Create the collection directory if it doesn't exist
    if (!fs.existsSync(this.collectionPath)) {
      fs.mkdirSync(this.collectionPath, { recursive: true });
    }
  }

  // QUERIES
  // GET
  async findOne(id?: string): Promise<T | null> {
    if (!id) {
      return null;
    }
    const filePath = path.join(this.collectionPath, `${id}.json`);

    try {
      const data = await fs.promises.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error(`Error finding document: ${error}`);
      return null;
    }
  }

  async findMany(query?: ODFilter): Promise<T[]> {
    const files = await fs.promises.readdir(this.collectionPath);
    const results: T[] = [];

    try {
      for (const file of files) {
        if (file.includes('.DS_Store')) {
          continue;
        }

        const filePath = path.join(this.collectionPath, file);
        const data = await fs.promises.readFile(filePath, 'utf8');
        const document = JSON.parse(data);

        if (!query) {
          results.push(document);
          continue;
        }

        const match = this.matchesFilter(document, query);

        if (match) {
          results.push(document);
        }
      }
    } catch (error) {
      throw new Error(`Error finding documents in ${this.collectionPath} : ${error}`);
    }

    return results;
  }

  // MUTATIONS
  // CREATE
  async insertOne(document: T, fileName?: string): Promise<T | void> {
    const id = (document as any).id || this.generateId();
    const finalFileName = fileName || id;
    const filePath = path.join(this.collectionPath, `${finalFileName}.json`);

    try {
      const insertedDocument = {
        ...document,
        id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await fs.promises.writeFile(filePath, JSON.stringify(insertedDocument, null, 2), 'utf8');
      return insertedDocument;
    } catch (error) {
      throw new Error(`Error inserting document: ${error}`);
    }
  }

  async insertMany(documents: T[]): Promise<T[] | void> {
    const insertedDocuments: T[] = [];
    try {
      for (const document of documents) {
        const id = document.id || this.generateId();
        const filePath = path.join(this.collectionPath, `${id}.json`);
        const insertedDocument = {
          ...document,
          id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await fs.promises.writeFile(filePath, JSON.stringify(insertedDocument, null, 2), 'utf8');
        insertedDocuments.push(insertedDocument);
      }
      return insertedDocuments;
    } catch (error) {
      throw new Error(`Error inserting documents: ${error}`);
    }
  }

  // UPDATE
  async findByIdAndUpdate(id: string, update: T): Promise<T | null> {
    const filePath = path.join(this.collectionPath, `${id}.json`);

    try {
      const existingData = await this.findOne(id);
      if (existingData) {
        const updatedData = {
          ...update,
          id: existingData.id,
          updatedAt: new Date().toISOString(),
        };
        await fs.promises.writeFile(filePath, JSON.stringify(updatedData, null, 2), 'utf8');
        return updatedData;
      } else {
        return null; // Document not found
      }
    } catch (error) {
      throw new Error(`Error finding and updating document: ${error}`);
    }
  }

  async findManyAndUpdate(query: ODFilter, update: Partial<Omit<T, 'id'>>): Promise<T[] | void> {
    const files = await fs.promises.readdir(this.collectionPath);
    const updatedDocuments: T[] = [];
    try {
      for (const file of files) {
        if (file.includes('.DS_Store')) {
          continue;
        }

        const filePath = path.join(this.collectionPath, file);
        const data = await fs.promises.readFile(filePath, 'utf8');
        const document = JSON.parse(data);

        const match = this.matchesFilter(document, query);

        if (match) {
          const updatedDocument = { ...document, ...update };
          await fs.promises.writeFile(filePath, JSON.stringify(updatedDocument, null, 2), 'utf8');
        }
        updatedDocuments.push(document);
      }

      return updatedDocuments;
    } catch (error) {
      throw new Error(`Error finding and updating documents: ${error}`);
    }
  }

  // DELETE
  async findByIdAndDelete(id: string): Promise<boolean> {
    const filePath = path.join(this.collectionPath, `${id}.json`);

    try {
      const existingData = await this.findOne(id);
      if (existingData) {
        await fs.promises.unlink(filePath);
        return true;
      } else {
        return false; // Document not found
      }
    } catch (error) {
      throw new Error(`Error finding and deleting document: ${error}`);
    }
  }

  async findManyAndDelete(query: ODFilter): Promise<boolean> {
    const files = await fs.promises.readdir(this.collectionPath);

    try {
      for (const file of files) {
        if (file.includes('.DS_Store')) {
          continue;
        }

        const filePath = path.join(this.collectionPath, file);
        const data = await fs.promises.readFile(filePath, 'utf8');
        const document = JSON.parse(data);

        // Check if the document matches the query
        const match = this.matchesFilter(document, query);
        if (match) {
          await fs.promises.unlink(filePath);
        }
      }
      return true;
    } catch (error) {
      throw new Error(`Error finding and deleting documents: ${error}`);
    }
  }

  // UTILS
  async countDocuments(): Promise<number> {
    const files = await fs.promises.readdir(this.collectionPath);
    return files.length;
  }

  // drop collection only if not in production environment
  async dropCollection(): Promise<boolean> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot drop collection in production environment');
    }

    try {
      const files = await fs.promises.readdir(this.collectionPath);
      for (const file of files) {
        if (file.includes('.DS_Store')) {
          continue;
        }
        const filePath = path.join(this.collectionPath, file);
        await fs.promises.unlink(filePath);
      }
      return true;
    } catch (error) {
      throw new Error(`Error dropping collection: ${error}`);
    }
  }

  // PRIVATE
  // TODO add support for $and, $or, $not, $nor, $where, $elemMatch, $size
  private matchesFilter(document: Partial<T>, filter: ODFilter): boolean {
    for (const key in filter) {
      const filterValue = filter[key];
      const documentValue = get(document, key);

      if (isObject(filterValue)) {
        if ('$eq' in filterValue && documentValue !== filterValue['$eq']) {
          return false;
        }
        if ('$ne' in filterValue && documentValue === filterValue['$ne']) {
          return false;
        }
        if ('$gt' in filterValue && documentValue <= (filterValue['$gt'] as any)) {
          return false;
        }
        if ('$gte' in filterValue && documentValue < (filterValue['$gte'] as any)) {
          return false;
        }
        if ('$lt' in filterValue && documentValue >= (filterValue['$lt'] as any)) {
          return false;
        }
        if ('$lte' in filterValue && documentValue > (filterValue['$lte'] as any)) {
          return false;
        }
        if ('$in' in filterValue) {
          const filterValueArray = filterValue['$in'] as any[];
          if (!filterValueArray.includes(documentValue)) {
            return false;
          }
        }
        if ('$nin' in filterValue) {
          const filterValueArray = filterValue['$nin'] as any[];
          if (filterValueArray.includes(documentValue)) {
            return false;
          }
        }
        if (
          '$exists' in filterValue &&
          ((filterValue['$exists'] && documentValue === undefined) ||
            (!filterValue['$exists'] && documentValue !== undefined))
        ) {
          return false;
        }
      } else if (Array.isArray(filterValue)) {
        if (!filterValue.includes(documentValue)) {
          return false;
        }
      } else {
        if (filterValue !== documentValue) {
          return false;
        }
      }
    }
    return true;
  }

  private generateId(): string {
    return nanoid(); // Using nanoid for generating unique IDs
  }
}
