export class AccessorySubject {
  static ACCESSORY_CONTEXT_KEY = 'accessory';

  constructor(
    protected platform,
  ) {
  }

  get displayName() : string {
    return 'Accessory';
  }

  shouldCreateAccessory(room: string | null) : boolean {
    return false;
  }

  shouldKeepAccessory(room: string | null) : boolean {
    return this.shouldCreateAccessory(room);
  }

  accessoryUUIDKey(room: string | null) : string {
    return 'accessory';
  }

  accessoryUUID(room: string | null) {
    return this.platform.api.hap.uuid.generate(this.accessoryUUIDKey(room));
  }

  accessoryDisplayName(room: string | null) : string {
    if (room && this.displayName.startsWith(room)) {
      return this.displayName;
    }

    return `${room || 'Anywhere'} ${this.displayName}`;
  }

  isAccessoryActive(room: string | null) : boolean {
    return false;
  }

  get accessoryContextIdentifier() {
    return this.constructor['ACCESSORY_CONTEXT_KEY'];
  }

  get accessoryContext() : object {
    return {};
  }
}
