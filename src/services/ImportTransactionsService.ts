import path from 'path';
import parse from 'csv-parse';
import fs from 'fs';
import { getRepository, getCustomRepository } from 'typeorm';
import uploadConfig from '../config/upload';

import AppError from '../errors/AppError';

import Transaction from '../models/Transaction';
import Category from '../models/Category';
import TransactionsRepository from '../repositories/TransactionsRepository';

interface Request {
  dataFileName: string;
}

interface TransactionCSV {
  title: string;
  value: number;
  type: 'income' | 'outcome';
  category: string;
}

interface NewCategory {
  category: string;
}

class ImportTransactionsService {
  async execute({ dataFileName }: Request): Promise<Transaction[]> {
    const transactionsRepository = getCustomRepository(TransactionsRepository);
    const categoriesRepository = getRepository(Category);

    const csvFilePath = path.join(uploadConfig.directory, dataFileName);
    const parsers = parse({ delimiter: ', ', from_line: 2 });

    const csvReadStream = fs.createReadStream(csvFilePath);

    const parseCSV = csvReadStream.pipe(parsers);

    const transactionsCSV: TransactionCSV[] = [];
    const categories: string[] = [];

    parseCSV.on('data', async line => {
      const [title, type, value, category] = line;

      if (!title || !type || !value) throw new AppError('File content invalid');

      transactionsCSV.push({ title, type, value, category });
      categories.push(category);
    });

    await new Promise(resolve => parseCSV.on('end', resolve));

    const newCategories = (
      await Promise.all(
        categories.map(async category => {
          const categoryExists = await categoriesRepository.findOne({
            where: {
              title: category,
            },
          });

          if (categoryExists) {
            return '';
          }

          return category;
        }),
      )
    )
      .filter(category => category !== '')
      .filter((a, b) => categories.indexOf(a) === b);

    const newCategoriesAll = await Promise.all(
      newCategories.map(async category => {
        const newCategory = categoriesRepository.create({
          title: category,
        });

        await categoriesRepository.save(newCategory);
        return newCategory;
      }),
    );

    const categories_id = await Promise.all(
      categories.map(async category => {
        if (!newCategories.includes(category)) {
          const categoryT = await categoriesRepository.findOne({
            where: { title: category },
          });

          return categoryT?.id;
        }

        const newCategory = newCategoriesAll.find(
          categ => categ.title === category,
        );

        const category_id = newCategory?.id;

        return category_id;
      }),
    );

    const transactions = await Promise.all(
      transactionsCSV.map(async (transaction, index) => {
        const { title, type, value } = transaction;

        return transactionsRepository.create({
          title,
          type,
          value,
          category_id: categories_id[index],
        });
      }),
    );

    await transactionsRepository.save(transactions);

    await fs.promises.unlink(csvFilePath);

    return transactions;
  }
}

export default ImportTransactionsService;
