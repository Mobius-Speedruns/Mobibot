import { Logger as PinoLogger } from 'pino';
import { PacemanClient } from './paceman.api';
import { SplitName, Timeframe } from '../types/paceman';
import { Service } from '../types/app';
import {
  getRelativeTime,
  getRelativeTimeFromTimestamp,
} from '../util/getRelativeTime';
import { msToTime } from '../util/msToTime';

export class MobibotClient {
  private paceman: PacemanClient;
  private logger: PinoLogger;

  constructor(paceman: PacemanClient, logger: PinoLogger) {
    this.paceman = paceman;
    this.logger = logger.child({ Service: Service.MOBIBOT });
  }

  async session(
    name: string,
    hours?: number,
    hoursBetween?: number,
  ): Promise<string> {
    this.logger.debug(`Handling /session`);
    const [sessionData, nphData] = await Promise.all([
      this.paceman.getSessionStats(name, hours, hoursBetween),
      this.paceman.getNPH(name, hours, hoursBetween),
    ]);

    // Collate session data
    const nethers = sessionData.nether
      ? `nethers: ${sessionData.nether.count} (${sessionData.nether.avg} avg, ${nphData.rnph} nph, ${nphData.rpe} rpe)`
      : '';
    const splits = Object.entries(sessionData)
      .filter(([key, { count }]) => key !== 'nether' && count > 0)
      .map(([key, { count, avg }]) => `${key}: ${count} (${avg} avg)`);

    // Return message for missing session
    if (sessionData.nether.count === 0)
      return `${name} hasn't played in the specified timeframe!`;

    // Convert to chat message.
    return (
      `${name} Session Stats • (${getRelativeTime((nphData.playtime + nphData.walltime) / 1000)}) ` +
      nethers +
      (splits.length > 0 ? ' • ' + splits.join(' • ') : '') +
      ` • https://paceman.gg/stats/player/${name}/`
    );
  }
  async lastpace(name: string): Promise<string> {
    return this.lastsplit(name, SplitName.FORTRESS);
  }
  async lastsplit(name: string, splitname: SplitName): Promise<string> {
    const last100Runs = await this.paceman.getRecentRuns(name, 100);

    // Filter runs for specified splits
    const relevantRuns = last100Runs.filter((run) => run[splitname] !== null);
    if (relevantRuns.length === 0)
      return `${name} hasn't reached the ${splitname} in the last 100 runs.`;

    // Use most recent pace. Assume order is most recent first.
    const run = relevantRuns[0];
    const relativeTime = getRelativeTimeFromTimestamp(run.time);
    const relativeNethers = last100Runs.findIndex((r) => r.id === run.id);
    const splits = Object.entries(run)
      // Only consider splits from response data
      .filter(([key, value]) => {
        return (
          (Object.values(SplitName) as string[]).includes(key) && value != null
        );
      })
      // Convert splits into min:sec
      .map(([key, value]) => `${key}: ${msToTime(value as number)}`);

    // Convert to chat message.
    return (
      `Lastest ${name} Pace: (${relativeTime} ago • ${relativeNethers + 1} nethers ago) ` +
      splits.join(' • ') +
      ` • https://paceman.gg/stats/run/${run.id}/`
    );
  }
  async pb(names: string): Promise<string> {
    const pbs = await this.paceman.getPBs(names);

    return pbs
      .map(
        (pb) =>
          `${pb.name} • ${pb.pb} (${getRelativeTimeFromTimestamp(pb.timestamp)} ago)`,
      )
      .join(' ');
  }
  async resets(
    name: string,
    hours?: number,
    hoursBetween?: number,
  ): Promise<string> {
    const resetData = await this.paceman.getNPH(name, hours, hoursBetween);

    return `${name} Reset Stats • ${resetData.totalResets} total resets • ${resetData.resets} last session`;
  }
  async elo(name: string): Promise<void> {}
  async lastmatch(name: string): Promise<void> {}
  async leaderboard(timeframe: Timeframe): Promise<void> {}
}
