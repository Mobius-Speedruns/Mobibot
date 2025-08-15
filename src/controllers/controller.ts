import { Request, Response, NextFunction } from 'express';
import { PacemanClient } from '../clients/paceman.api';
import { pinoLogger } from '../clients/logger.client';
import { MobibotClient } from '../clients/mobibot.client';
import { SplitName } from '../types/paceman';

const paceman = new PacemanClient('https://paceman.gg/stats/api', pinoLogger);
const mobibot = new MobibotClient(paceman, pinoLogger);

export const getSession = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const name = req.query.name as string;
    const hours = req.query.hours ? Number(req.query.hours) : undefined;
    const hoursBetween = req.query.hoursBetween
      ? Number(req.query.hoursBetween)
      : undefined;

    const session = await mobibot.session(name, hours, hoursBetween);
    res.json(session);
  } catch (err) {
    pinoLogger.error(err);
    res.status(500).json({ error: 'Paceman API error' });
  }
};

export const lastPace = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const name = req.query.name as string;
    const lastsplit = await mobibot.lastpace(name);
    res.json(lastsplit);
  } catch (err) {
    pinoLogger.error(err);
    res.status(500).json({ error: 'Paceman API error' });
  }
};

export const lastSplit = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const name = req.query.name as string;
    const splitname = req.query.splitname as string;

    // Validate splitname against enum values
    const validSplitNames = Object.values(SplitName) as string[];
    if (!validSplitNames.includes(splitname)) {
      return res.status(400).json({
        error: `Invalid splitname. Must be one of: ${validSplitNames.join(', ')}`,
      });
    }

    const lastsplit = await mobibot.lastsplit(name, splitname as SplitName);
    res.json(lastsplit);
  } catch (err) {
    pinoLogger.error(err);
    res.status(500).json({ error: 'Paceman API error' });
  }
};

export const pbs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const names = req.query.name as string;

    const pbs = await mobibot.pb(names);
    res.json(pbs);
  } catch (err) {
    pinoLogger.error(err);
    res.status(500).json({ error: 'Paceman API error' });
  }
};

export const resets = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const name = req.query.name as string;
    const hours = req.query.hours ? Number(req.query.hours) : undefined;
    const hoursBetween = req.query.hoursBetween
      ? Number(req.query.hoursBetween)
      : undefined;

    const resets = await mobibot.resets(name, hours, hoursBetween);
    res.json(resets);
  } catch (err) {
    pinoLogger.error(err);
    res.status(500).json({ error: 'Paceman API error' });
  }
};
