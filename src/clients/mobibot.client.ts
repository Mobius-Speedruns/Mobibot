import { Logger as PinoLogger } from 'pino';
import { PacemanClient } from './paceman.api';
import { SplitName, Timeframe } from '../types/paceman';
import { Service } from '../types/app';
import {
  getRelativeTime,
  getRelativeTimeFromTimestamp,
} from '../util/getRelativeTime';
import { msToTime } from '../util/msToTime';
import { RankedClient } from './ranked.api';

export class MobibotClient {
  private paceman: PacemanClient;
  private ranked: RankedClient;
  private logger: PinoLogger;

  constructor(
    paceman: PacemanClient,
    ranked: RankedClient,
    logger: PinoLogger,
  ) {
    this.paceman = paceman;
    this.ranked = ranked;
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
  async elo(name: string): Promise<string> {
    const userData = await this.ranked.getUserData(name);
    const data = userData.data;
    // Statistics
    const elo = data.eloRate;
    const totalMatchs = data.statistics.season.playedMatches.ranked;
    const wins = data.statistics.season.wins.ranked;
    const losses = data.statistics.season.loses.ranked;
    const winrate = (wins / (wins + losses)) * 100;
    const pb = data.statistics.season.bestTime.ranked;
    const forfeits = data.statistics.season.forfeits.ranked;
    const forfeitrate = (forfeits / totalMatchs) * 100;
    const totalCompletions = data.statistics.season.completions.ranked;
    const totalCompletionTime = data.statistics.season.completionTime.ranked;
    const completionAvg = totalCompletionTime / totalCompletions;

    return (
      `${name} Elo: ${elo || 'unknown'} ` +
      `(${data.seasonResult.highest} Peak) • ` +
      `${elo ? this.ranked.convertToRank(elo) : 'unknown'} (#${data.eloRank}) • ` +
      `W/L ${wins}/${losses} (${winrate.toFixed(1)}%) • ` +
      `${totalMatchs} Matches • ` +
      `${pb ? msToTime(pb) : 'unknown'} PB (${completionAvg ? msToTime(completionAvg) + ' avg' : 'unknown'}) • ` +
      `${forfeitrate.toFixed(1)}% FF Rate`
    );
  }
  async lastmatch(name: string): Promise<string> {
    const matchData = await this.ranked.getRecentMatches(name);
    const mostRecentMatch = matchData.data[0];
    const winner = mostRecentMatch.players.find(
      (player) => player.uuid === mostRecentMatch.result.uuid,
    );
    const player1 = mostRecentMatch.players[0];
    const player2 = mostRecentMatch.players[1];

    // Find relevant changes
    const player1Changes = mostRecentMatch.changes.find(
      (player) => player.uuid === player1.uuid,
    );
    const player2Changes = mostRecentMatch.changes.find(
      (player) => player.uuid === player2.uuid,
    );

    return (
      `Ranked Match Stats (${getRelativeTimeFromTimestamp(mostRecentMatch.date)} ago) • ` +
      `#${player1.eloRank} ${player1.nickname} (${player1.eloRate}) VS #${player2.eloRank} ${player2.nickname} (${player2.eloRate}) • ` +
      `Winner: ${winner?.nickname} ` +
      (mostRecentMatch.forfeited
        ? `(Forfeit at ${msToTime(mostRecentMatch.result.time)})`
        : `(${msToTime(mostRecentMatch.result.time)})`) +
      ` • ` +
      `Elo Change: ${player1.nickname} ${player1Changes?.change} → ${player1Changes?.eloRate} | ${player2.nickname} ${player2Changes?.change} → ${player2Changes?.eloRate} • ` +
      `Seed Type: ${mostRecentMatch.seed?.overworld} -> ${mostRecentMatch.seed?.nether} • ` +
      `https://mcsrranked.com/stats/${player1.nickname}/${mostRecentMatch.id}`
    );
  }
  async leaderboard(timeframe: Timeframe): Promise<void> {}
}
