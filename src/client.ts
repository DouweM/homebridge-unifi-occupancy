import { AccessorySubject } from './accessory_subject';
import { ClientRule } from './client_rule';
import { ClientType } from './client_type';

const NAME_OWNER_PATTERNS = [
  /^(.+?)['’]/, // "<owner>'s <device>"
  / (?:van|de) (.+)$/, // "<device> van <owner>" (Dutch), "<device> de <owner>" (Spanish)
];

const HOSTNAME_OWNER_PATTERNS = [
  /^(.+?)-s-/, // "<owner>-s-<device>"
  /^(.+?)s-iPhone$/, // "<owner>s-iPhone"
  /^iPhone(?:van|de)(.+)$/, // "iPhonevan<owner>" (Dutch), "iPhonede<owner>" (Spanish)
  /-(?:van|de)-(.+)$/, // "<device>-van-<owner>" (Dutch), "<device>-de-<owner>" (Spanish)
];

function ownerFromName(name, patterns) {
  if (!name) {
    return null;
  }

  for (const pattern of patterns) {
    const match = name.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return null;
}

export class Client extends AccessorySubject {
  static ACCESSORY_CONTEXT_KEY = 'device';

  private _config;
  private _fingerprint;

  constructor(
    public raw,
    platform,
  ) {
    super(platform);
    this._config = null;
    this._fingerprint = null;
  }

  get mac() : string {
    return this.raw.mac;
  }

  get name() : string {
    return this.raw.name || this.hostname || this.raw.display_name || this.fingerprint.name;
  }

  get hostname() : string {
    return this.raw.hostname;
  }

  get wired() : boolean {
    return !!this.raw.is_wired;
  }

  get accessPointMac() : string {
    return this.wired ? this.raw.uplink_mac : this.raw.ap_mac;
  }

  get room() : string {
    return this.platform.clientCurrentRoom.get(this.mac);
  }

  get connected() : boolean {
    return !!this.room;
  }

  isConnectedTo(room: string | null) : boolean {
    return room ? this.room === room : this.connected;
  }

  get fingerprint() {
    if (this._fingerprint) {
      return this._fingerprint;
    }

    const fingerprints = this.platform.deviceFingerprints;

    const rawFingerprint = this.raw.fingerprint;
    const devId = rawFingerprint.computed_dev_id;
    const fingerprint = (devId && fingerprints.dev_ids['' + devId]) || {
      name:         null,
      family_id:    rawFingerprint.dev_family,
      dev_type_id:  rawFingerprint.dev_cat,
      vendor_id:    rawFingerprint.dev_vendor,
      os_class_id:  null,
      os_name_id:   rawFingerprint.os_name,
    };

    this._fingerprint = {
      id:         devId,
      name:       fingerprint.name,
      familyId:   fingerprint.family_id,
      family:     fingerprints.family_ids['' + fingerprint.family_id],
      typeId:     fingerprint.dev_type_id,
      type:       fingerprints.dev_type_ids['' + fingerprint.dev_type_id],
      vendorId:   fingerprint.vendor_id,
      vendor:     fingerprints.vendor_ids['' + fingerprint.vendor_id],
      osClassId:  fingerprint.os_class_id,
      osClass:    fingerprints.os_class_ids['' + fingerprint.os_class_id],
      osNameId:   fingerprint.os_name_id,
      osName:     fingerprints.os_name_ids['' + fingerprint.os_name_id],
    };
    this._fingerprint.familyIs = (...values) => values.some(value => [this._fingerprint.type, this._fingerprint.family].includes(value));
    this._fingerprint.nameContains = (...values) => {
      return values.some(value =>
        [fingerprint.name, this.name].some(name =>
          name && name.toLowerCase().includes(value.toLowerCase()),
        ),
      );
    };

    return this._fingerprint;
  }

  get type(): ClientType | null {
    // The first that matches
    return this.platform.clientTypes.find(type => type.matchesClient(this));
  }

  get rule(): ClientRule | null {
    // Later rules take precedence over earlier rules
    return this.platform.clientRules.reverse().find(rule => rule.matchesClient(this));
  }

  get config() {
    if (this._config) {
      return this._config;
    }

    this._config = this.type!.config;
    if (this.rule) {
      this._config = {...this._config, ...this.rule.config};
    }
    return this._config;
  }

  get shouldShowAsOwner() : boolean {
    return this.config.showAsOwner;
  }

  get owner(): string | null {
    return ownerFromName(this.raw.name, NAME_OWNER_PATTERNS) || ownerFromName(this.hostname, HOSTNAME_OWNER_PATTERNS);
  }

  get guest() : boolean {
    return this.shouldShowAsOwner && !this.owner;
  }

  get displayName() : string {
    if (this.shouldShowAsOwner) {
      return this.owner || `Guest: ${this.name}`;
    }
    return this.name;
  }

  shouldCreateAccessory(room: string | null) : boolean {
    if (!room) {
      return this.config.homeAccessory;
    }

    if (!this.config.roomAccessory) {
      return false;
    }

    if (this.config.lazy || this.guest) {
      return this.room === room;
    }

    return true;
  }

  shouldKeepAccessory(room: string | null) : boolean {
    if (!room) {
      return this.config.homeAccessory;
    }

    if (!this.config.roomAccessory) {
      return false;
    }

    return this.connected || !this.guest;
  }

  accessoryUUIDKey(room: string | null) {
    let uuidKey = this.displayName;
    if (room) {
      uuidKey += ` @ ${room}`;
    }
    return uuidKey;
  }

  isAccessoryActive(room: string | null) {
    return this.isConnectedTo(room);
  }

  get accessoryContext() {
    return {
      raw: this.raw,
    };
  }
}
