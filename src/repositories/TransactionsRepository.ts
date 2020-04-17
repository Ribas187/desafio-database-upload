import { EntityRepository, Repository, getRepository } from 'typeorm';
import Transaction from '../models/Transaction';

interface Balance {
  income: number;
  outcome: number;
  total: number;
}

@EntityRepository(Transaction)
class TransactionsRepository extends Repository<Transaction> {
  public async getBalance(): Promise<Balance> {
    const repository = getRepository(Transaction);

    const trasactions = await repository.find();

    const { income, outcome } = trasactions.reduce(
      (amount, { type, value }) => {
        const obj = amount;

        obj[type] += Number(value);

        return obj;
      },
      {
        income: 0,
        outcome: 0,
      },
    );

    const balance = {
      income,
      outcome,
      total: income - outcome,
    };

    return balance;
  }
}

export default TransactionsRepository;
