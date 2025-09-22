/* eslint-disable @typescript-eslint/unbound-method */
import axios from 'axios';
import { Logger as PinoLogger } from 'pino';

import { Seedwave, Service } from '../types/app';
import { Day, MAX_HOUR, Run, SplitName, User } from '../types/paceman';
import { MatchType, NETHER_TYPE, OVERWORLD_TYPE } from '../types/ranked';
import { appendInvisibleChars } from '../util/appendInvisibleChars';
import { capitalizeWords } from '../util/capitalizeWords';
import { getFlag } from '../util/getFlag';
import {
  getRelativeTime,
  getRelativeTimeFromTimestamp,
} from '../util/getRelativeTime';
import { handleNotFound } from '../util/handleNotFound';
import { isTodayUTC } from '../util/isTodayUTC';
import { msToTime } from '../util/msToTime';
import { msToYMDH } from '../util/msToYMDH';
import { PacemanClient } from './paceman.api';
import { PostgresClient } from './postgres.client';
import { RankedClient } from './ranked.api';
import { getHoursSinceTime } from '../util/getHoursSinceTime';

export class MobibotClient {
  private db: PostgresClient;
  private logger: PinoLogger;
  private paceman: PacemanClient;
  private ranked: RankedClient;

  constructor(
    paceman: PacemanClient,
    ranked: RankedClient,
    db: PostgresClient,
    logger: PinoLogger,
  ) {
    this.paceman = paceman;
    this.ranked = ranked;
    this.db = db;
    this.logger = logger.child({ Service: Service.MOBIBOT });

    // Error handling.
    this.session = handleNotFound(this.session);
    this.lastpace = handleNotFound(this.lastpace);
    this.lastsplit = handleNotFound(this.lastsplit);
    this.pb = handleNotFound(this.pb);
    this.resets = handleNotFound(this.resets);
    this.elo = handleNotFound(this.elo);
    this.lastmatch = handleNotFound(this.lastmatch);
    this.today = handleNotFound(this.today);
    this.record = handleNotFound(this.record);
    this.winrate = handleNotFound(this.winrate);
    this.average = handleNotFound(this.average);
  }

  async average(name: string, season?: number): Promise<string> {
    const [matchData, userData] = await Promise.all([
      this.ranked.getAllMatches(name, season),
      this.ranked.getUserData(name, season),
    ]);

    if (matchData.length === 0 || !matchData) return `No matches yet!`;
    const uuid = userData.data.uuid;

    // Split completions by seed type
    type CompletionRecord = { completions: number; total: number };

    type CompletionByType = {
      nether: Record<NETHER_TYPE, CompletionRecord>;
      overworld: Record<OVERWORLD_TYPE, CompletionRecord>;
    };

    // Start each type with 0 completions, 0 total
    function initRecord<T extends string>(
      values: readonly T[],
    ): Record<T, CompletionRecord> {
      return values.reduce(
        (acc, v) => ({ ...acc, [v]: { completions: 0, total: 0 } }),
        {} as Record<T, CompletionRecord>,
      );
    }

    const initial: CompletionByType = {
      nether: initRecord(Object.values(NETHER_TYPE)),
      overworld: initRecord(Object.values(OVERWORLD_TYPE)),
    };

    const completionsByType: CompletionByType = matchData.reduce(
      (acc, match) => {
        const seed = match.seed;
        if (!seed) return acc;
        // Ignore draws
        if (!match.result.uuid) return acc;
        const isRanked = match.type === MatchType['Ranked Match'];
        if (!isRanked) return acc;
        // No completion if the match was forfeited or lost.
        if (match.forfeited) return acc;
        const isWin = match.result.uuid === uuid;
        if (!isWin) return acc;

        // ---- Overworld ----
        if (seed.overworld) {
          acc.overworld[seed.overworld].total += 1;
          if (isWin) {
            acc.overworld[seed.overworld].completions += match.result.time;
          }
        }

        // ---- Nether ----
        if (seed.nether) {
          acc.nether[seed.nether].total += 1;
          const isWin = match.result.uuid === uuid;
          if (isWin) {
            acc.nether[seed.nether].completions += match.result.time;
          }
        }

        return acc;
      },
      initial,
    );

    // Overall Statistics
    const totalCompletions = userData.data.statistics.season.completions.ranked;
    const totalCompletionTime =
      userData.data.statistics.season.completionTime.ranked;
    const completionAvg = totalCompletionTime / totalCompletions;

    const sections = [
      `${appendInvisibleChars(userData.data.nickname)} ${season ? `season ${season} ` : ''}overall average: ${completionAvg ? msToTime(completionAvg, false) : 'Unknown'}`,
      `${totalCompletions} total completions`,
      Object.entries(completionsByType.overworld)
        .map(
          ([type, { completions, total }]) =>
            `${capitalizeWords(type)}: ${completions ? msToTime(completions / total, false) : '--'}`,
        )
        .join(', '),
      Object.entries(completionsByType.nether)
        .map(
          ([type, { completions, total }]) =>
            `${capitalizeWords(type)}: ${completions ? msToTime(completions / total, false) : '--'}`,
        )
        .join(', '),
    ];
    return sections.join(' \u2756 ');
  }

  async elo(
    name: string,
    season?: null | number,
  ): Promise<{ color: string | undefined; response: string }> {
    const userData = await this.ranked.getUserData(name, season);
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
      `${userData.data.country ? getFlag(userData.data.country) : ''} ${appendInvisibleChars(name)} ${season ? `Season ${season} ` : ''}Elo`,
      `Elo: ${elo || 'Unranked'} ${data.seasonResult.highest ? `(Peak: ${data.seasonResult.highest})` : ''} \u2756 Rank: ${elo ? this.ranked.convertToRank(elo) : 'Unranked'} ${data.eloRank ? `(#${data.eloRank}` : ''})`,
      `W/L: ${wins}/${losses} (${winrate.toFixed(1)}%) \u2756 Matches: ${totalMatches}`,
      `PB: ${pb ? msToTime(pb) : 'No Completions'} \u2756 Avg: ${completionAvg ? msToTime(completionAvg, false) : 'Unknown'}`,
      `FF Rate: ${forfeitrate.toFixed(1)}%`,
    ].filter(Boolean); // remove empty sections
    const color = this.ranked.getRankColor(elo || null);
    return {
      color,
      response: sections.join(' \u2756 '),
    };
  }

  async getAllUsers(): Promise<User[]> {
    return await this.paceman.getAllUsers();
  }

  // Helper function to convert user-inputs into real MCSR name
  async getRealNickname(name: string): Promise<null | string> {
    let username: null | string;
    const isAt = name.includes('@');

    // Use caches obtained via paceman
    // If @ was used, assume a twitch handle
    if (isAt) {
      username = await this.db.getTwitchFuzzy(name);
      // If no name found, attempt user search
      if (!username) username = await this.db.getUserFuzzy(name);
    } else {
      // Attempt user name search
      username = await this.db.getUserFuzzy(name);
      // If no name found, attempt twitch handle
      if (!username) username = await this.db.getTwitchFuzzy(name);
    }

    // If no twitch found, attempt search on ranked.
    if (!username) {
      try {
        const user = await this.ranked.getUserData(name);
        if (user.data.nickname) {
          username = user.data.nickname;
          // Update the cache
          this.db.upsertUser(username);
        }
      } catch {
        return null;
      }
    }

    return username;
  }
  async lastmatch(name: string, season?: null | number): Promise<string> {
    const matchData = await this.ranked.getRecentMatches(name, season);
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
      `#${player1.eloRank} ${player1.country ? getFlag(player1.country) : ''} ${appendInvisibleChars(player1.nickname)} (${player1.eloRate}) VS #${player2.eloRank} ${player2.country ? getFlag(player2.country) : ''} ${appendInvisibleChars(player2.nickname)} (${player2.eloRate})`,
      `Winner: ${appendInvisibleChars(winner?.nickname || '')} ` + matchTime,
      `Elo Change: ${appendInvisibleChars(player1.nickname)} ${player1Changes?.change && player1Changes.change > 0 ? '+' : ''}${player1Changes?.change} » ${player1Changes?.eloRate} \u2756 ${appendInvisibleChars(player2.nickname)} ${player2Changes?.change && player2Changes.change > 0 ? '+' : ''}${player2Changes?.change} » ${player2Changes?.eloRate}`,
      `Seed Type: ${mostRecentMatch.seed?.overworld} » ${mostRecentMatch.seed?.nether}`,
      `https://mcsrranked.com/stats/${player1.nickname}/${mostRecentMatch.id}`,
      `${getRelativeTimeFromTimestamp(mostRecentMatch.date)} ago`,
    ].filter(Boolean);

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
      .sort(([, a], [, b]) => (a as number) - (b as number))
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
    const pbs = await this.paceman.getPBs(names);
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
  async playtime(name: string, season?: null | number): Promise<string> {
    let currentSeason = season;
    if (!season) currentSeason = await this.ranked.getCurrentSeason();
    const [rsg, ranked] = await Promise.all([
      this.paceman.getNPH(name, MAX_HOUR, MAX_HOUR),
      this.ranked.getUserData(name, currentSeason),
    ]);

    const rankedSeasonPlaytime = ranked.data.statistics.season.playtime.ranked;
    const rankedTotalPlaytime = ranked.data.statistics.total.playtime.ranked;
    const rsgPlaytime = rsg.playtime;
    const rsgTotalResets = rsg.totalResets;

    const sections = [
      `${appendInvisibleChars(name)} playtime`,
      `Total ranked playtime: ${msToYMDH(rankedTotalPlaytime)} total, ${msToYMDH(rankedSeasonPlaytime)} in season ${currentSeason}`,
      `Total RSG any% playtime: ${msToYMDH(rsgPlaytime)}, with ${rsgTotalResets.toLocaleString('en-US')} resets`,
    ].filter(Boolean);

    return sections.join(' \u2756 ');
  }
  async rankedLeaderboard(season?: number): Promise<string> {
    let currentSeason = season;
    if (!season) currentSeason = await this.ranked.getCurrentSeason();
    const leaderboard = await this.ranked.getLeaderboard(season);

    // Only consider top 10
    const top10 = leaderboard.data.users.slice(0, 10);

    const sections = [
      `Season ${currentSeason}`,
      top10
        .map(
          (player) =>
            `#${player.seasonResult.eloRank} ${player.country ? getFlag(player.country) : ''} ${player.nickname} (${player.seasonResult.eloRate})`,
        )
        .join(' '),
    ];

    return sections.join(' \u2756  ');
  }
  async record(
    name1: string,
    name2: string,
    season?: null | number,
  ): Promise<string> {
    const { data } = await this.ranked.getVersusData(name1, name2, season);
    if (data.players.length != 2) {
      this.logger.error(data, 'Invalid vs data from ranked.');
      return '';
    }
    const player1 = data.players[0];
    const player2 = data.players[1];

    const sections = [
      `${player1.country ? getFlag(player1.country) : ''} ${player1.nickname} ${data.results.ranked[player1.uuid]} - ${data.results.ranked[player2.uuid]} ${player2.nickname} ${player2.country ? getFlag(player2.country) : ''}`,
      `${data.results.ranked.total} total game(s)${season ? ` in season ${season}` : ''}`,
    ];
    return sections.join(' \u2756 ');
  }

  async resets(
    name: string,
    hours?: number,
    hoursBetween?: number,
  ): Promise<string> {
    const resetData = await this.paceman.getNPH(name, hours, hoursBetween);

    return `${appendInvisibleChars(name)} Reset Stats \u2756 ${resetData.totalResets} total resets \u2756 ${resetData.resets} last session`;
  }
  async rsgLeaderboard(days: Day): Promise<string> {
    const leaderboard = await this.paceman.getLeaderboard(days);
    const first = leaderboard[0];
    return `${capitalizeWords(Day[days])} Paceman Record: ${first.name} with ${msToTime(first.value)}`;
  }
  async seedwave(): Promise<string> {
    const { data } = await axios.get<Seedwave>(
      'https://seedwave.vercel.app/api/seedwave',
    );

    return `Seedwave: ${data.seedwave} ${data.isBloodseed ? '🩸 ' : ''} https://seedwave.vercel.app/current.html`;
  }

  async session(
    name: string,
    hours?: number,
    hoursBetween?: number,
  ): Promise<string> {
    this.logger.debug(`Handling /session`);
    // Promise of lastRun - takes a while to return so be optimistic about initial call to session and nph
    const lastRunPromise = this.paceman.getLatestRun(name);

    let [sessionData, nphData] = await Promise.all([
      this.paceman.getSessionStats(name, hours, hoursBetween),
      this.paceman.getNPH(name, hours, hoursBetween),
    ]);

    // Use call of lastRun to obtain hours
    if (sessionData.nether.count === 0) {
      // Return early is user specified hours
      if (hours) {
        return `${appendInvisibleChars(name)} hasn't played in the last ${hours} hours!`;
      }
      // Use result of lastRun to determine hours since last session.
      const lastRun = await lastRunPromise;
      const searchHours = getHoursSinceTime(lastRun.time) + 24; // add 24 hours to get full session.

      [sessionData, nphData] = await Promise.all([
        this.paceman.getSessionStats(name, searchHours, hoursBetween),
        this.paceman.getNPH(name, searchHours, hoursBetween),
      ]);

      if (sessionData.nether.count === 0) {
        return `${appendInvisibleChars(name)} hasn't played in the last ${searchHours} hours!`;
      }
    }

    // Await return of lastRun
    const lastRun = await lastRunPromise;

    // Collate session data
    const nethers = sessionData.nether
      ? `nethers: ${sessionData.nether.count} (${sessionData.nether.avg} avg, ${nphData.rnph} nph, ${nphData.rpe} rpe)`
      : '';
    const splits = Object.entries(sessionData)
      .filter(([key, { count }]) => key !== 'nether' && count > 0)
      .map(([key, { avg, count }]) => `${key}: ${count} (${avg} avg)`);

    const timeInfo = `Playtime: ${getRelativeTime((nphData.playtime + nphData.walltime) / 1000)}, ${getRelativeTimeFromTimestamp(lastRun.time)} ago`;

    const sections = [
      `${appendInvisibleChars(name)} Session`,
      nethers,
      splits.length ? splits.join(' \u2756 ') : '',
      timeInfo,
      `https://paceman.gg/stats/player/${name}/`,
    ].filter(Boolean); // remove empty sections

    return sections.join(' \u2756 ');
  }
  async today(
    name: string,
  ): Promise<{ color: string | undefined; response: string }> {
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
      `${userData.data.country ? getFlag(userData.data.country) : ''} ${appendInvisibleChars(name)} Elo`,
      `Elo: ${elo || 'Unknown'} (${eloChange > 0 ? '+' : ''}${eloChange}) (#${data.eloRank})`,
      `W/D/L: ${wins}/${draws}/${losses} (${winrate.toFixed(1)}%) \u2756 Matches: ${totalMatches}`,
      `${completionAvg ? msToTime(completionAvg, false) : 'Unknown'} average`,
      `FF Rate: ${forfeitrate.toFixed(1)}%`,
    ].filter(Boolean); // remove empty sections
    const color = this.ranked.getRankColor(elo || null);
    return { color, response: sections.join(' \u2756 ') };
  }

  async wastedTime(
    name: string,
    hours?: number,
    hoursBetween?: number,
  ): Promise<string> {
    const [nph, session] = await Promise.all([
      this.paceman.getNPH(name, hours, hoursBetween),
      this.paceman.getSessionStats(name, hours, hoursBetween),
    ]);
    if (!session) return 'Could not fetch session stats!';
    const seeds = await this.paceman.getRecentRuns(name, session.nether.count);

    // OW time from pace
    const inSeedPlaytime = seeds.reduce((sum, seed) => {
      if (seed.updatedTime === null || !seed.nether) return sum;
      return (sum += seed.nether);
    }, 0);

    // Total time in-between seeds
    const wastedTime = nph.playtime - inSeedPlaytime;

    const sections = [
      `${appendInvisibleChars(name)} Wasted Time`,
      `${msToTime(wastedTime / session.nether.count, false)} avg wasted time spent per enter`,
      `${msToTime(wastedTime, false)} total wasted time (${((wastedTime / nph.playtime) * 100).toFixed(1)}%)`,
      `${msToTime(inSeedPlaytime, false)} spent in overworlds that entered (${((inSeedPlaytime / nph.playtime) * 100).toFixed(1)}%)`,
      `${msToTime(nph.playtime, false)} total playtime`,
      `${msToTime(nph.walltime, false)} total walltime`,
    ];
    return sections.join(' \u2756 ');
  }
  async winrate(name: string, season?: number): Promise<string> {
    const [matchData, userData] = await Promise.all([
      this.ranked.getAllMatches(name, season),
      this.ranked.getUserData(name, season),
    ]);

    if (matchData.length === 0 || !matchData) return `No matches yet!`;
    const uuid = userData.data.uuid;

    // Split wins by seed type
    type WinRecord = { total: number; wins: number };

    type WinsByType = {
      nether: Record<NETHER_TYPE, WinRecord>;
      overworld: Record<OVERWORLD_TYPE, WinRecord>;
    };

    // Start each type with 0 wins, 0 total
    function initRecord<T extends string>(
      values: readonly T[],
    ): Record<T, WinRecord> {
      return values.reduce(
        (acc, v) => ({ ...acc, [v]: { total: 0, wins: 0 } }),
        {} as Record<T, WinRecord>,
      );
    }

    const initial: WinsByType = {
      nether: initRecord(Object.values(NETHER_TYPE)),
      overworld: initRecord(Object.values(OVERWORLD_TYPE)),
    };

    const winsByType: WinsByType = matchData.reduce((acc, match) => {
      const seed = match.seed;
      if (!seed) return acc;
      // Ignore draws
      if (!match.result.uuid) return acc;
      const isWin = match.result.uuid === uuid;
      const isRanked = match.type === MatchType['Ranked Match'];
      if (!isRanked) return acc;

      // ---- Overworld ----
      if (seed.overworld) {
        acc.overworld[seed.overworld].total += 1;
        if (isWin) {
          acc.overworld[seed.overworld].wins += 1;
        }
      }

      // ---- Nether ----
      if (seed.nether) {
        acc.nether[seed.nether].total += 1;
        if (isWin) {
          acc.nether[seed.nether].wins += 1;
        }
      }

      return acc;
    }, initial);

    // Overall Statistics
    const totalWins = userData.data.statistics.season.wins.ranked;
    const totalMatches =
      userData.data.statistics.season.wins.ranked +
      userData.data.statistics.season.loses.ranked;
    const totalWinrate = (totalWins / totalMatches) * 100;

    const sections = [
      `${appendInvisibleChars(userData.data.nickname)} ${season ? `season ${season} ` : ''}overall winrate: ${totalWins}/${totalMatches} (${totalWinrate.toFixed(1)}%)`,
      Object.entries(winsByType.overworld)
        .map(
          ([type, { total, wins }]) =>
            `${capitalizeWords(type)}: ${wins}/${total} (${total > 0 ? ((wins / total) * 100).toFixed(1) : '0'}%)`,
        )
        .join(', '),
      Object.entries(winsByType.nether)
        .map(
          ([type, { total, wins }]) =>
            `${capitalizeWords(type)}: ${wins}/${total} (${total > 0 ? ((wins / total) * 100).toFixed(1) : '0'}%)`,
        )
        .join(', '),
    ];
    return sections.join(' \u2756 ');
  }
  private getLargestSplitTime(run: Run): number {
    const splits: (keyof Run)[] = [
      'nether',
      'bastion',
      'fortress',
      'first_portal',
      'stronghold',
      'end',
      'finish',
    ];

    const times = splits
      .map((split) => run[split])
      .filter((time): time is number => time != null);

    return times.length > 0 ? Math.max(...times) : 0;
  }
}
