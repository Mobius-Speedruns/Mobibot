import EventEmitter from 'events';

type Listener<T> = (payload: T) => void;

export class TypedEmitter<T extends Record<string, unknown>> {
  private emitter = new EventEmitter();

  emit<K extends keyof T>(event: K, payload: T[K]) {
    return this.emitter.emit(event as string, payload);
  }

  on<K extends keyof T>(event: K, listener: Listener<T[K]>) {
    this.emitter.on(event as string, listener);
    return this;
  }

  once<K extends keyof T>(event: K, listener: Listener<T[K]>) {
    this.emitter.once(event as string, listener);
    return this;
  }

  off<K extends keyof T>(event: K, listener: Listener<T[K]>) {
    this.emitter.off(event as string, listener);
    return this;
  }
}
