import prisma from "../../Config/db";
import { AppError } from "../../Utils/AppError";
import { PDFDocument, StandardFonts } from "pdf-lib";
import type { Transaction } from "../../generated/prisma/client";

const NGN = (amountKobo: bigint) => {
  const naira = Number(amountKobo) / 100;
  const sign = naira < 0 ? "-" : "";
  return `${sign}NGN ${Math.abs(naira).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const formatDate = (date: Date) =>
  date.toISOString().slice(0, 19).replace("T", " ");

interface StatementRow extends Transaction {
  balanceAfter: bigint;
}

interface StatementData {
  from: Date;
  to: Date;
  openingBalance: bigint;
  closingBalance: bigint;
  totalCredits: bigint;
  totalDebits: bigint;
  transactions: StatementRow[];
}

export const getWalletStatementData = async (
  userId: string,
  from: Date,
  to: Date,
): Promise<StatementData> => {
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) {
    throw new AppError("Wallet not found", 404);
  }

  const endOfTo = new Date(to);
  endOfTo.setUTCHours(23, 59, 59, 999);

  const allTransactions = await prisma.transaction.findMany({
    where: { walletId: wallet.id, status: "SUCCESS" },
    orderBy: { createdAt: "desc" },
  });

  let runningBalance = wallet.balance;
  const withBalances: StatementRow[] = allTransactions.map((tx) => {
    const balanceAfter = runningBalance;
    runningBalance -= tx.amount;
    return { ...tx, balanceAfter };
  });

  const inRange = withBalances
    .filter((tx) => tx.createdAt >= from && tx.createdAt <= endOfTo)
    .reverse();

  const totalCredits = inRange
    .filter((tx) => tx.amount > 0n)
    .reduce((sum, tx) => sum + tx.amount, 0n);

  const totalDebits = inRange
    .filter((tx) => tx.amount < 0n)
    .reduce((sum, tx) => sum + -tx.amount, 0n);

  let openingBalance = wallet.balance;
  let closingBalance = wallet.balance;
  const firstRow = inRange[0];
  const lastRow = inRange[inRange.length - 1];

  if (firstRow) {
    openingBalance = firstRow.balanceAfter - firstRow.amount;
  }
  if (lastRow) {
    closingBalance = lastRow.balanceAfter;
  }

  return {
    from,
    to,
    openingBalance,
    closingBalance,
    totalCredits,
    totalDebits,
    transactions: inRange,
  };
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const LINE_HEIGHT = 16;

export const buildStatementPdf = async (data: StatementData) => {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const monoFont = await pdfDoc.embedFont(StandardFonts.Courier);

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const newPageIfNeeded = () => {
    if (y < MARGIN + LINE_HEIGHT) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
  };

  const drawLine = (
    text: string,
    options: { bold?: boolean; mono?: boolean; size?: number } = {},
  ) => {
    const usedFont = options.mono ? monoFont : options.bold ? boldFont : font;
    page.drawText(text, {
      x: MARGIN,
      y,
      size: options.size ?? 10,
      font: usedFont,
    });
    y -= LINE_HEIGHT;
    newPageIfNeeded();
  };

  drawLine("Cowrywise - Wallet Statement", { bold: true, size: 16 });
  y -= 6;
  drawLine(
    `Period: ${data.from.toISOString().slice(0, 10)} to ${data.to.toISOString().slice(0, 10)}`,
  );
  drawLine(`Opening balance: ${NGN(data.openingBalance)}`);
  drawLine(`Closing balance: ${NGN(data.closingBalance)}`);
  drawLine(`Total credits: ${NGN(data.totalCredits)}`);
  drawLine(`Total debits: ${NGN(data.totalDebits)}`);
  y -= 10;
  drawLine(
    "Date                Type                    Amount            Balance",
    { bold: true, size: 9 },
  );

  if (data.transactions.length === 0) {
    drawLine("No transactions in this period.", { mono: true, size: 9 });
  }

  for (const tx of data.transactions) {
    const row = [
      formatDate(tx.createdAt).padEnd(20),
      tx.type.padEnd(22),
      NGN(tx.amount).padStart(18),
      NGN(tx.balanceAfter).padStart(18),
    ].join(" ");
    drawLine(row, { mono: true, size: 8 });
  }

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
};

const escapeCsvField = (value: string) => {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
};

export const buildStatementCsv = (data: StatementData) => {
  const header = [
    "Date",
    "Type",
    "Reference",
    "Amount (kobo)",
    "Balance After (kobo)",
    "Status",
  ];
  const rows = data.transactions.map((tx) => [
    tx.createdAt.toISOString(),
    tx.type,
    tx.providerReference,
    tx.amount.toString(),
    tx.balanceAfter.toString(),
    tx.status,
  ]);

  const lines = [header, ...rows].map((row) =>
    row.map(escapeCsvField).join(","),
  );
  return lines.join("\r\n");
};
