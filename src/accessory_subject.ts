export abstract class AccessorySubject {
  constructor(
    protected readonly platform,
  ) {
  }

  abstract get displayName() : string;

  abstract get config();

  protected abstract accessoryUUIDKey(room: string | null) : string;

  accessoryUUID(room: string | null) {
    return this.platform.api.hap.uuid.generate(this.accessoryUUIDKey(room));
  }
}
