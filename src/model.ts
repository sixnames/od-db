import fs from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';
import { ODFilter, ODModelBase } from './types';
import { get, isObject } from 'lodash';

/**
 * Class representing a model in the database.
 * @template T - The type of the model, which extends ODModelBase.
 */
export class ODModel<T extends ODModelBase> {
  /**
   * The path to the collection of documents in the database.
   */
  collectionPath: string;

  /**
   * Creates a new model.
   * @param {string} collectionName - The name of the collection.
   */
  constructor(collectionName: string) {
    this.collectionPath = path.join(process.cwd(), 'od-db', collectionName);

    // Create the collection directory if it doesn't exist
    if (!fs.existsSync(this.collectionPath)) {
      fs.mkdirSync(this.collectionPath, { recursive: true });
    }
  }

  // QUERIES
  // GET
  /**
   * Finds a document by its ID.
   * @param {string} id - The ID of the document.
   * @returns {Promise<T | null>} The document, or null if not found.
   */
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

  /**
   * Finds many documents that match a query.
   * @param {ODFilter} query - The query to match documents against.
   * @returns {Promise<T[]>} The documents that match the query.
   */
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
      throw new Error(`Error finding documents: ${error}`);
    }

    return results;
  }

  // MUTATIONS
  // CREATE
  /**
   * Inserts a document into the collection.
   * @param {T} document - The document to insert.
   * @param fileName
   * @returns {Promise<T | void>} The inserted document.
   */
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
      await fs.promises.writeFile(filePath, JSON.stringify(insertedDocument, null, 2));
      return insertedDocument;
    } catch (error) {
      throw new Error(`Error inserting document: ${error}`);
    }
  }

  /**
   * Inserts many documents into the collection.
   * @param {T[]} documents - The documents to insert.
   * @returns {Promise<T[] | void>} The inserted documents.
   */
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
        await fs.promises.writeFile(filePath, JSON.stringify(insertedDocument, null, 2));
        insertedDocuments.push(insertedDocument);
      }
      return insertedDocuments;
    } catch (error) {
      throw new Error(`Error inserting documents: ${error}`);
    }
  }

  // UPDATE
  /**
   * Finds a document by its ID and updates it.
   * @param {string} id - The ID of the document.
   * @param {Partial<Omit<T, 'id'>>} update - The update to apply to the document.
   * @returns {Promise<T | null>} The updated document, or null if not found.
   */
  async findByIdAndUpdate(id: string, update: Partial<Omit<T, 'id'>>): Promise<T | null> {
    const filePath = path.join(this.collectionPath, `${id}.json`);

    try {
      const existingData = await this.findOne(id);
      if (existingData) {
        const updatedData = {
          ...existingData,
          ...update,
          updatedAt: new Date().toISOString(),
        };
        await fs.promises.writeFile(filePath, JSON.stringify(updatedData, null, 2));
        return updatedData;
      } else {
        return null; // Document not found
      }
    } catch (error) {
      throw new Error(`Error finding and updating document: ${error}`);
    }
  }

  /**
   * Finds many documents that match a query and updates them.
   * @param {ODFilter} query - The query to match documents against.
   * @param {Partial<Omit<T, 'id'>>} update - The update to apply to the documents.
   * @returns {Promise<T[] | void>} The updated documents.
   */
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
          await fs.promises.writeFile(filePath, JSON.stringify(updatedDocument, null, 2));
        }
        updatedDocuments.push(document);
      }

      return updatedDocuments;
    } catch (error) {
      throw new Error(`Error finding and updating documents: ${error}`);
    }
  }

  // DELETE
  /**
   * Finds a document by its ID and deletes it.
   * @param {string} id - The ID of the document.
   * @returns {Promise<T | null>} The deleted document, or null if not found.
   */
  async findByIdAndDelete(id: string): Promise<T | null> {
    const filePath = path.join(this.collectionPath, `${id}.json`);

    try {
      const existingData = await this.findOne(id);
      if (existingData) {
        await fs.promises.unlink(filePath);
        return existingData;
      } else {
        return null; // Document not found
      }
    } catch (error) {
      throw new Error(`Error finding and deleting document: ${error}`);
    }
  }

  /**
   * Finds many documents that match a query and deletes them.
   * @param {ODFilter} query - The query to match documents against.
   * @returns {Promise<void>}
   */
  async findManyAndDelete(query: ODFilter): Promise<void> {
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
    } catch (error) {
      throw new Error(`Error finding and deleting documents: ${error}`);
    }
  }

  // UTILS
  /**
   * Counts the number of documents in the collection.
   * @returns {Promise<number>} The number of documents in the collection.
   */
  async countDocuments(): Promise<number> {
    const files = await fs.promises.readdir(this.collectionPath);
    return files.length;
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
