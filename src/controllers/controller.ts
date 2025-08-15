import { Request, Response, NextFunction } from 'express';
import { PacemanClient } from '../clients/paceman.api';

const paceman = new PacemanClient('https://paceman.gg/stats/api');

export const getSession = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const name = req.query.name as string; // Get name from query string
    const session = await paceman.getSessionStats(name);
    console.log(session);
    res.json(session);
  } catch (err) {
    console.error(err); // Log the error to the console
    res.status(500).json({ error: 'Paceman API error' });
  }
};
