declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string | null;
      };
      rawBody?: Buffer;
    }
  }
}

export {};
