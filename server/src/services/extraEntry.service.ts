import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import type { EntryType } from "@prisma/client";
import prisma from "../config/db.config.js";
import { ensureExtraEntriesTable } from "../lib/schemaCompatibility.js";

const toNumber = (value: unknown) => Number(value ?? 0);

type ExtraEntryRow = {
  id: string;
  title: string;
  amount: Prisma.Decimal | number;
  type: EntryType;
  date: Date;
  notes: string | null;
  user_id: number;
  created_at: Date;
  updated_at: Date;
};

type ExtraEntryAggregateRow = {
  type: EntryType;
  amount: Prisma.Decimal | number;
};

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

const getSelectEntryColumns = () => Prisma.sql`
  "id",
  "title",
  "amount",
  "type",
  "date",
  "notes",
  "user_id",
  "created_at",
  "updated_at"
`;

const mapRow = (row: ExtraEntryRow): ExtraEntryRecord => ({
  id: row.id,
  title: row.title,
  amount: toNumber(row.amount),
  type: row.type,
  date: row.date,
  notes: row.notes,
  userId: row.user_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const buildWhereClause = (params: {
  userId: number;
  from?: Date;
  to?: Date;
  type?: EntryType;
}) => {
  const conditions: Prisma.Sql[] = [Prisma.sql`"user_id" = ${params.userId}`];

  if (params.from) {
    conditions.push(Prisma.sql`"date" >= ${params.from}`);
  }

  if (params.to) {
    conditions.push(Prisma.sql`"date" <= ${params.to}`);
  }

  if (params.type) {
    conditions.push(Prisma.sql`"type" = ${params.type}::"EntryType"`);
  }

  return Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;
};

const queryExtraEntries = async (params: {
  userId: number;
  from?: Date;
  to?: Date;
  type?: EntryType;
  order?: "asc" | "desc";
  skip?: number;
  take?: number;
}) => {
  await ensureExtraEntriesTable();

  const whereClause = buildWhereClause(params);
  const orderByClause =
    params.order === "asc"
      ? Prisma.sql`ORDER BY "date" ASC`
      : Prisma.sql`ORDER BY "date" DESC`;
  const paginationClause =
    params.skip === undefined || params.take === undefined
      ? Prisma.empty
      : Prisma.sql`OFFSET ${params.skip} LIMIT ${params.take}`;

  return prisma.$queryRaw<ExtraEntryRow[]>(Prisma.sql`
    SELECT ${getSelectEntryColumns()}
    FROM "extra_entries"
    ${whereClause}
    ${orderByClause}
    ${paginationClause}
  `);
};

export const listExtraEntriesInRange = async (params: {
  userId: number;
  from?: Date;
  to?: Date;
  type?: EntryType;
  order?: "asc" | "desc";
}) => {
  const rows = await queryExtraEntries(params);
  return rows.map(mapRow);
};

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
  const [rows, totalRows] = await Promise.all([
    queryExtraEntries({
      userId,
      from,
      to,
      type,
      order: "desc",
      skip,
      take: limit,
    }),
    (async () => {
      await ensureExtraEntriesTable();
      const whereClause = buildWhereClause({ userId, from, to, type });
      return prisma.$queryRaw<Array<{ count: bigint | number }>>(Prisma.sql`
        SELECT COUNT(*) AS "count"
        FROM "extra_entries"
        ${whereClause}
      `);
    })(),
  ]);

  const total = Number(totalRows[0]?.count ?? 0);

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
  await ensureExtraEntriesTable();

  const rows = await prisma.$queryRaw<ExtraEntryRow[]>(Prisma.sql`
    SELECT ${getSelectEntryColumns()}
    FROM "extra_entries"
    WHERE "id" = ${params.id}
      AND "user_id" = ${params.userId}
    LIMIT 1
  `);

  return rows[0] ? mapRow(rows[0]) : null;
};

export const createExtraEntry = async (params: {
  userId: number;
  title: string;
  amount: number;
  type: EntryType;
  date: Date;
  notes?: string | null;
}) => {
  await ensureExtraEntriesTable();

  const [entry] = await prisma.$queryRaw<ExtraEntryRow[]>(Prisma.sql`
    INSERT INTO "extra_entries" (
      "id",
      "title",
      "amount",
      "type",
      "date",
      "notes",
      "user_id"
    )
    VALUES (
      ${randomUUID()},
      ${params.title},
      ${params.amount},
      ${params.type}::"EntryType",
      ${params.date},
      ${params.notes ?? null},
      ${params.userId}
    )
    RETURNING ${getSelectEntryColumns()}
  `);

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
  const existing = await getExtraEntryById({
    id: params.id,
    userId: params.userId,
  });

  if (!existing) return null;

  const [entry] = await prisma.$queryRaw<ExtraEntryRow[]>(Prisma.sql`
    UPDATE "extra_entries"
    SET
      "title" = ${params.title ?? existing.title},
      "amount" = ${params.amount ?? existing.amount},
      "type" = ${(params.type ?? existing.type) as EntryType}::"EntryType",
      "date" = ${params.date ?? existing.date},
      "notes" = ${
        params.notes === undefined ? existing.notes : (params.notes ?? null)
      },
      "updated_at" = CURRENT_TIMESTAMP
    WHERE "id" = ${params.id}
      AND "user_id" = ${params.userId}
    RETURNING ${getSelectEntryColumns()}
  `);

  return entry ? mapRow(entry) : null;
};

export const deleteExtraEntry = async (params: {
  id: string;
  userId: number;
}) => {
  await ensureExtraEntriesTable();

  const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    DELETE FROM "extra_entries"
    WHERE "id" = ${params.id}
      AND "user_id" = ${params.userId}
    RETURNING "id"
  `);

  return rows.length > 0;
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
  await ensureExtraEntriesTable();

  const rows = await prisma.$queryRaw<ExtraEntryAggregateRow[]>(Prisma.sql`
    SELECT "type", COALESCE(SUM("amount"), 0) AS "amount"
    FROM "extra_entries"
    WHERE "user_id" = ${params.userId}
      AND "date" >= ${params.from}
      AND "date" < ${params.to}
    GROUP BY "type"
  `);

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
