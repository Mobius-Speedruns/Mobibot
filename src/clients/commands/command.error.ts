export class CommandError extends Error {
  public readonly userMessage: string;

  constructor(userMessage: string) {
    super(userMessage);
    this.userMessage = userMessage;
    Object.setPrototypeOf(this, CommandError.prototype);
  }
}
