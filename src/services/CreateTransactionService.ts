import { getCustomRepository, getRepository } from 'typeorm';

import AppError from '../errors/AppError';

import Transaction from '../models/Transaction';
import TransactionsRepository from '../repositories/TransactionsRepository';
import Category from '../models/Category';

interface RequestDTO {
  title: string;
  value: number;
  type: 'income' | 'outcome';
  category: string;
}

class CreateTransactionService {
  public async execute({
    title,
    value,
    type,
    category,
  }: RequestDTO): Promise<Transaction> {
    const transactionsRepository = getCustomRepository(TransactionsRepository);
    const categoriesRepository = getRepository(Category);

    if (type !== 'income' && type !== 'outcome') {
      throw new AppError('The transaction type can just be income or outcome');
    }

    if (
      type === 'outcome' &&
      value > (await transactionsRepository.getBalance()).total
    ) {
      throw new AppError('Transaction value not allowed');
    }

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

    const transaction = transactionsRepository.create({
      title,
      value,
      type,
      category_id,
    });

    await transactionsRepository.save(transaction);

    return transaction;
  }
}

export default CreateTransactionService;
