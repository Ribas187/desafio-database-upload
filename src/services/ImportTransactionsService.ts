import path from 'path';
import parse from 'csv-parse';
import fs from 'fs';
import { getRepository, getCustomRepository } from 'typeorm';
import uploadConfig from '../config/upload';

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

class ImportTransactionsService {
  async execute({ dataFileName }: Request): Promise<Transaction[]> {
    const transactionsRepository = getCustomRepository(TransactionsRepository);
    const categoriesRepository = getRepository(Category);

    const csvFilePath = path.join(uploadConfig.directory, dataFileName);
    const parsers = parse({ delimiter: ', ', from_line: 2 });

    const csvReadStream = fs.createReadStream(csvFilePath);

    const parseCSV = csvReadStream.pipe(parsers);

    const transactionsCSV: TransactionCSV[] = [];

    parseCSV.on('data', async line => {
      const [title, type, value, category] = line;

      transactionsCSV.push({ title, type, value, category });
    });

    await new Promise(resolve => parseCSV.on('end', resolve));

    const categories = await Promise.all(
      transactionsCSV.map(async ({ category }) => {
        const categoryExists = await categoriesRepository.findOne({
          where: {
            title: category,
          },
        });

        const category_id = categoryExists
          ? categoryExists.id
          : (
              await categoriesRepository.save(
                categoriesRepository.create({
                  title: category,
                }),
              )
            ).id;

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
          category_id: categories[index],
        });
      }),
    );

    await transactionsRepository.save(transactions);

    await fs.promises.unlink(csvFilePath);

    return transactions;
  }
}

export default ImportTransactionsService;
