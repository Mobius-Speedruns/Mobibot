/* eslint-disable @typescript-eslint/unbound-method */
import { Logger as PinoLogger } from 'pino';
import { PacemanClient } from './paceman.api';
import { SplitName } from '../types/paceman';
import { Seedwave, Service } from '../types/app';
import {
  getRelativeTime,
  getRelativeTimeFromTimestamp,
} from '../util/getRelativeTime';
import { msToTime } from '../util/msToTime';
import { RankedClient } from './ranked.api';
import { handleNotFound } from '../util/handleNotFound';
import { appendInvisibleChars } from '../util/appendInvisibleChars';
import { isTodayUTC } from '../util/isTodayUTC';
import axios from 'axios';

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

    // Error handling.
    this.session = handleNotFound(this.session);
    this.lastpace = handleNotFound(this.lastpace);
    this.lastsplit = handleNotFound(this.lastsplit);
    this.pb = handleNotFound(this.pb);
    this.resets = handleNotFound(this.resets);
    this.elo = handleNotFound(this.elo);
    this.lastmatch = handleNotFound(this.lastmatch);
  }

  // Helper function to convert user-inputs into real MCSR name
  async getRealNickname(name: string): Promise<string | null> {
    const recentRun = await this.paceman.getRecentRuns(name, 1);
    if (recentRun.length === 0) return null;
    const worldId = await this.paceman.getWorld(recentRun[0].id);
    return worldId.data.nickname;
  }

  // -----------------------------
  // RSG
  // -----------------------------
  async session(
    name: string,
    hours?: number,
    hoursBetween?: number,
  ): Promise<string> {
    this.logger.debug(`Handling /session`);
    const [sessionData, nphData, lastRun] = await Promise.all([
      this.paceman.getSessionStats(name, hours, hoursBetween),
      this.paceman.getNPH(name, hours, hoursBetween),
      this.paceman.getRecentRuns(name),
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
      return `${appendInvisibleChars(name)} hasn't played in the last ${hours} hours!`;

    const timeInfo = `Playtime: ${getRelativeTime((nphData.playtime + nphData.walltime) / 1000)}, ${getRelativeTimeFromTimestamp(lastRun[0].time)} ago`;

    const sections = [
      `${appendInvisibleChars(name)} Session`,
      nethers,
      splits.length ? splits.join(' \u2756 ') : '',
      timeInfo,
      `https://paceman.gg/stats/player/${name}/`,
    ].filter(Boolean); // remove empty sections

    return sections.join(' \u2756 ');
  }
  async lastpace(name: string): Promise<string> {
    return this.lastsplit(name, SplitName.FORTRESS);
  }
  async lastsplit(name: string, splitname: SplitName): Promise<string> {
    const last100Runs = await this.paceman.getRecentRuns(name, 100);

    // Filter runs for specified splits
    const relevantRuns = last100Runs.filter((run) => run[splitname] !== null);
    if (relevantRuns.length === 0)
      return `${appendInvisibleChars(name)} hasn't reached the ${splitname} in the last 100 runs.`;

    // Use most recent pace. Assume order is most recent first.
    const run = relevantRuns[0];
    const relativeTime = getRelativeTimeFromTimestamp(run.time);
    const relativeNethers = last100Runs.findIndex((r) => r.id === run.id) + 1;

    const splits = Object.entries(run)
      .filter(
        ([key, value]) =>
          (Object.values(SplitName) as string[]).includes(key) && value != null,
      )
      .map(([key, value]) => `${key}: ${msToTime(value as number)}`);

    const sections = [
      `${appendInvisibleChars(name)} Last ${splitname}`,
      splits.join(' \u2756 '),
      `${relativeTime} ago \u2756 ${relativeNethers} nethers ago`,
      `https://paceman.gg/stats/run/${run.id}/`,
    ].filter(Boolean); // remove empty sections

    return sections.join(' \u2756 ');
  }
  async pb(names: string): Promise<string> {
    // PB endpoint is case sensitive. Attempt to retrieve first
    const mcName = await this.getRealNickname(names);
    if (!mcName) {
      return `⚠️ Player not found in paceman.`;
    }

    const pbs = await this.paceman.getPBs(mcName);
    if (!pbs) return 'Unable to fetch pbs, try again later';
    const response = pbs
      .map(
        (pb) =>
          `${appendInvisibleChars(pb.name)} \u2756 ${pb.pb} (${getRelativeTimeFromTimestamp(pb.timestamp)} ago)`,
      )
      .join(' ');
    if (!response) return '⚠️ No pb found!';
    return response;
  }
  async resets(
    name: string,
    hours?: number,
    hoursBetween?: number,
  ): Promise<string> {
    const resetData = await this.paceman.getNPH(name, hours, hoursBetween);

    return `${appendInvisibleChars(name)} Reset Stats \u2756 ${resetData.totalResets} total resets \u2756 ${resetData.resets} last session`;
  }
  async seedwave(): Promise<string> {
    const { data } = await axios.get<Seedwave>(
      'https://seedwave.vercel.app/api/seedwave',
    );

    return `Seedwave: ${data.seedwave} ${data.isBloodseed ? '🩸 ' : ''} https://seedwave.vercel.app/current.html`;
  }

  // -----------------------------
  // Ranked
  // -----------------------------
  async elo(name: string): Promise<string> {
    const userData = await this.ranked.getUserData(name);
    const data = userData.data;
    // Statistics
    const elo = data.eloRate;
    const totalMatches = data.statistics.season.playedMatches.ranked;
    const wins = data.statistics.season.wins.ranked;
    const losses = data.statistics.season.loses.ranked;
    const winrate = (wins / (wins + losses)) * 100;
    const pb = data.statistics.season.bestTime.ranked;
    const forfeits = data.statistics.season.forfeits.ranked;
    const forfeitrate = (forfeits / totalMatches) * 100;
    const totalCompletions = data.statistics.season.completions.ranked;
    const totalCompletionTime = data.statistics.season.completionTime.ranked;
    const completionAvg = totalCompletionTime / totalCompletions;

    const sections = [
      `${appendInvisibleChars(name)} Elo`,
      `Elo: ${elo || 'Unranked'} ${data.seasonResult.highest ? `(Peak: ${data.seasonResult.highest})` : ''} \u2756 Rank: ${elo ? this.ranked.convertToRank(elo) : 'Unranked'} ${data.eloRank ? `(#${data.eloRank}` : ''}`,
      `W/L: ${wins}/${losses} (${winrate.toFixed(1)}%) \u2756 Matches: ${totalMatches}`,
      `PB: ${pb ? msToTime(pb) : 'No Completions'} \u2756 Avg: ${completionAvg ? msToTime(completionAvg) : 'Unknown'}`,
      `FF Rate: ${forfeitrate.toFixed(1)}%`,
    ].filter(Boolean); // remove empty sections

    return sections.join(' \u2756 ');
  }
  async lastmatch(name: string): Promise<string> {
    const matchData = await this.ranked.getRecentMatches(name);
    if (matchData.data.length === 0 || !matchData) return `No matches yet!`;

    const mostRecentMatch = matchData.data[0];

    if (mostRecentMatch.players.length === 0) return `No matches yet!`;
    const winner = mostRecentMatch.players.find(
      (player) => player.uuid === mostRecentMatch.result.uuid,
    );
    const [player1, player2] = mostRecentMatch.players;

    // Find relevant changes
    const player1Changes = mostRecentMatch.changes.find(
      (p) => p.uuid === player1.uuid,
    );
    const player2Changes = mostRecentMatch.changes.find(
      (p) => p.uuid === player2.uuid,
    );

    const matchTime = mostRecentMatch.forfeited
      ? `(Forfeit at ${msToTime(mostRecentMatch.result.time)})`
      : `(${msToTime(mostRecentMatch.result.time)})`;

    const sections = [
      `Players: #${player1.eloRank} ${appendInvisibleChars(player1.nickname)} (${player1.eloRate}) VS #${player2.eloRank} ${appendInvisibleChars(player2.nickname)} (${player2.eloRate})`,
      `Winner: ${appendInvisibleChars(winner?.nickname || '')} ` + matchTime,
      `Elo Change: ${appendInvisibleChars(player1.nickname)} ${player1Changes?.change && player1Changes.change > 0 ? '+' : ''}${player1Changes?.change} » ${player1Changes?.eloRate} \u2756 ${appendInvisibleChars(player2.nickname)} ${player2Changes?.change && player2Changes.change > 0 ? '+' : ''}${player2Changes?.change} » ${player2Changes?.eloRate}`,
      `Seed Type: ${mostRecentMatch.seed?.overworld} » ${mostRecentMatch.seed?.nether}`,
      `https://mcsrranked.com/stats/${player1.nickname}/${mostRecentMatch.id}`,
      `${getRelativeTimeFromTimestamp(mostRecentMatch.date)} ago`,
    ].filter(Boolean);

    return sections.join(' \u2756 ');
  }
  async today(name: string): Promise<string> {
    const [userData, recentMatches] = await Promise.all([
      this.ranked.getUserData(name),
      this.ranked.getRecentMatches(name),
    ]);
    const todayMatches = recentMatches.data.filter((match) =>
      isTodayUTC(match.date),
    );

    const data = userData.data;
    // Statistics
    const elo = data.eloRate;
    let completions = 0;
    let wins = 0;
    let draws = 0;
    let losses = 0;
    let totalCompletionTime = 0;
    let eloChange = 0;
    let forfeits = 0;

    todayMatches.forEach((match) => {
      const player = match.players.find(
        (p) => p.nickname.toLowerCase() === name.toLowerCase(),
      );
      if (!player) return;

      const didWin = match.result.uuid === player.uuid;
      const didDraw = match.result.uuid === null;

      if (didWin) {
        wins++;
        if (match.result.time != null) {
          if (!match.forfeited) {
            totalCompletionTime += match.result.time;
            completions++;
          }
        }
      } else if (didDraw) {
        draws++;
      } else {
        if (match.forfeited) forfeits++;
        losses++;
      }

      const playerChange = match.changes.find((c) => c.uuid === player.uuid);
      if (playerChange) {
        eloChange += playerChange.change || 0;
      }
    });

    const totalMatches = todayMatches.length;
    const winrate = (wins / totalMatches) * 100;
    const forfeitrate = (forfeits / totalMatches) * 100;
    const completionAvg = totalCompletionTime / completions;

    const sections = [
      `${appendInvisibleChars(name)} Elo`,
      `Elo: ${elo || 'Unknown'} (${eloChange > 0 ? '+' : ''}${eloChange}) (#${data.eloRank})`,
      `W/D/L: ${wins}/${draws}/${losses} (${winrate.toFixed(1)}%) \u2756 Matches: ${totalMatches}`,
      `${completionAvg ? msToTime(completionAvg) : 'Unknown'} average`,
      `FF Rate: ${forfeitrate.toFixed(1)}%`,
    ].filter(Boolean); // remove empty sections

    return sections.join(' \u2756 ');
  }

  // TODO: record/vs command.
}
