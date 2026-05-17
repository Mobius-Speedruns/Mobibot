export class PlayerNotFound extends Error {
  constructor() {
    super();
    this.name = 'PLAYER_NOT_FOUND';
  }
}

export class ClientTimeout extends Error {
  constructor() {
    super();
    this.name = 'CLIENT_TIMEOUT';
  }
}
