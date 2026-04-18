import { Prisma } from "@prisma/client";
import prisma from "../config/db.config.js";
import type { EntryType } from "@prisma/client";

const toNumber = (value: unknown) => Number(value ?? 0);

export type ExtraEntryRecord = {
  id: string;
  title: string;
  amount: number;
  type: EntryType;
  date: Date;
  notes: string | null;
  userId: number;
  createdAt: Date;
  updatedAt: Date;
};

const mapRow = (row: {
  id: string;
  title: string;
  amount: unknown;
  type: EntryType;
  date: Date;
  notes: string | null;
  userId: number;
  createdAt: Date;
  updatedAt: Date;
}): ExtraEntryRecord => ({
  id: row.id,
  title: row.title,
  amount: toNumber(row.amount),
  type: row.type,
  date: row.date,
  notes: row.notes,
  userId: row.userId,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export const listExtraEntries = async (params: {
  userId: number;
  from?: Date;
  to?: Date;
  type?: EntryType;
  page?: number;
  limit?: number;
}) => {
  const { userId, from, to, type, page = 1, limit = 50 } = params;
  const skip = (page - 1) * limit;

  const where: Prisma.ExtraEntryWhereInput = { userId };
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = from;
    if (to) where.date.lte = to;
  }
  if (type) where.type = type;

  const [rows, total] = await Promise.all([
    prisma.extraEntry.findMany({
      where,
      orderBy: { date: "desc" },
      skip,
      take: limit,
    }),
    prisma.extraEntry.count({ where }),
  ]);

  return {
    entries: rows.map(mapRow),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

export const getExtraEntryById = async (params: {
  id: string;
  userId: number;
}) => {
  const entry = await prisma.extraEntry.findFirst({
    where: { id: params.id, userId: params.userId },
  });
  return entry ? mapRow(entry) : null;
};

export const createExtraEntry = async (params: {
  userId: number;
  title: string;
  amount: number;
  type: EntryType;
  date: Date;
  notes?: string | null;
}) => {
  const entry = await prisma.extraEntry.create({
    data: {
      userId: params.userId,
      title: params.title,
      amount: params.amount,
      type: params.type,
      date: params.date,
      notes: params.notes ?? null,
    },
  });
  return mapRow(entry);
};

export const updateExtraEntry = async (params: {
  id: string;
  userId: number;
  title?: string;
  amount?: number;
  type?: EntryType;
  date?: Date;
  notes?: string | null;
}) => {
  const existing = await prisma.extraEntry.findFirst({
    where: { id: params.id, userId: params.userId },
  });
  if (!existing) return null;

  const entry = await prisma.extraEntry.update({
    where: { id: params.id },
    data: {
      title: params.title ?? existing.title,
      amount: params.amount ?? existing.amount,
      type: params.type ?? existing.type,
      date: params.date ?? existing.date,
      notes: params.notes === undefined ? existing.notes : params.notes,
    },
  });
  return mapRow(entry);
};

export const deleteExtraEntry = async (params: {
  id: string;
  userId: number;
}) => {
  const existing = await prisma.extraEntry.findFirst({
    where: { id: params.id, userId: params.userId },
  });
  if (!existing) return false;

  await prisma.extraEntry.delete({ where: { id: params.id } });
  return true;
};

export type ExtraEntryMonthStat = {
  income: number;
  expense: number;
  loss: number;
  investment: number;
  net: number;
};

export const getExtraEntryStats = async (params: {
  userId: number;
  from: Date;
  to: Date;
}): Promise<ExtraEntryMonthStat> => {
  const rows = await prisma.extraEntry.findMany({
    where: {
      userId: params.userId,
      date: { gte: params.from, lte: params.to },
    },
    select: { type: true, amount: true },
  });

  let income = 0;
  let expense = 0;
  let loss = 0;
  let investment = 0;

  rows.forEach((row) => {
    const amount = toNumber(row.amount);
    switch (row.type) {
      case "INCOME":
        income += amount;
        break;
      case "EXPENSE":
        expense += amount;
        break;
      case "LOSS":
        loss += amount;
        break;
      case "INVESTMENT":
        investment += amount;
        break;
    }
  });

  return {
    income,
    expense,
    loss,
    investment,
    net: income - expense - loss - investment,
  };
};
