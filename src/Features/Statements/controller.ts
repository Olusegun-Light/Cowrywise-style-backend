import type { Request, Response } from "express";
import { validateBody } from "../../Utils/validateBody";
import * as statementsService from "./service";
import { walletStatementQuerySchema } from "./validation";

export default class StatementsController {
  static async getWalletStatement(req: Request, res: Response) {
    const { from, to, format } = validateBody(
      walletStatementQuerySchema,
      req.query,
    );

    const data = await statementsService.getWalletStatementData(
      req.user!.id,
      from,
      to,
    );

    if (format === "csv") {
      const csv = statementsService.buildStatementCsv(data);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="wallet-statement.csv"`,
      );
      res.send(csv);
      return;
    }

    const pdfBuffer = await statementsService.buildStatementPdf(data);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="wallet-statement.pdf"`,
    );
    res.send(pdfBuffer);
  }
}
