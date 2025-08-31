declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        roles: string[];
      };
      session?: {
        id: string;
        data: any;
      };
    }
  }
}

export {};