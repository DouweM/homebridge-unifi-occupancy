import { Memoize } from 'typescript-memoize';
import gravatar from 'gravatar';

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
  constructor(
    platform,
    public readonly raw,
  ) {
    super(platform);
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

  get roomMac() : string {
    return this.wired ? this.raw.uplink_mac : this.raw.ap_mac;
  }

  get room() : string {
    return this.platform.clientCurrentRoom.get(this.mac);
  }

  get connected() : boolean {
    return !!this.room;
  }

  get ip() : string {
    return this.raw.ip;
  }

  get wifiSSID() : string {
    return this.raw.essid;
  }

  isInRoom(room: string | null) : boolean {
    return room ? this.room === room : this.connected;
  }

  @Memoize()
  get fingerprint() {
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

    fingerprint.id = devId,
    fingerprint.image_url = `https://static.ubnt.com/fingerprint/0/${devId}_101x101.png`;
    fingerprint.family = fingerprints.family_ids['' + fingerprint.family_id],
    fingerprint.type = fingerprints.dev_type_ids['' + fingerprint.dev_type_id],
    fingerprint.type_id = fingerprint.dev_type_id;
    fingerprint.vendor = fingerprints.vendor_ids['' + fingerprint.vendor_id],
    fingerprint.os_class = fingerprints.os_class_ids['' + fingerprint.os_class_id],
    fingerprint.os_name = fingerprints.os_name_ids['' + fingerprint.os_name_id],

    fingerprint.familyIs = (...values) => values.some(value => [fingerprint.type, fingerprint.family].includes(value));
    fingerprint.nameContains = (...values) => {
      return values.some(value =>
        [fingerprint.name, this.name].some(name =>
          name && name.toLowerCase().includes(value.toLowerCase()),
        ),
      );
    };

    return fingerprint;
  }

  get type(): ClientType | null {
    // The first that matches
    return this.platform.clientTypes.find(type => type.matchesClient(this));
  }

  get rule(): ClientRule | null {
    // Later rules take precedence over earlier rules
    return this.platform.clientRules.reverse().find(rule => rule.matchesClient(this));
  }

  @Memoize()
  get config() {
    let config = this.type!.config;
    if (this.rule) {
      config = {...config, ...this.rule.config};
    }
    return config;
  }

  @Memoize()
  get owner(): string | null {
    return ownerFromName(this.raw.name, NAME_OWNER_PATTERNS) || ownerFromName(this.hostname, HOSTNAME_OWNER_PATTERNS);
  }

  get guest() : boolean {
    return this.config.showAsOwner && !this.owner;
  }

  get avatarIdentifier(): string | null {
    return this.owner && this.platform.avatars.get(this.owner);
  }

  get avatarURL(): string | null {
    const identifier = this.avatarIdentifier;
    if (!identifier) {
      return null;
    }

    if (identifier.includes('@')) {
      return gravatar.url(identifier, {}, true);
    }

    return identifier;
  }

  get imageURL(): string | null {
    return (this.config.showAsOwner && this.avatarURL) || this.fingerprint.image_url;
  }

  override get displayName() : string {
    if (this.config.showAsOwner) {
      return this.owner || `Guest: ${this.name}`;
    }
    return this.name;
  }

  override accessoryUUIDKey(room: string | null) {
    let uuidKey = this.displayName;
    if (room) {
      uuidKey += ` @ ${room}`;
    }
    return uuidKey;
  }

  get asJSON() {
    return {
      display_name: this.displayName,
      type: this.type?.name,
      room: this.room,
      image_url: this.imageURL,
      owner: this.owner,

      name: this.name,
      hostname: this.hostname,

      mac: this.mac,
      ip: this.ip,
      connected: this.connected,

      wired: this.wired,
      wifi_ssid: this.wifiSSID,
      room_mac: this.roomMac,

      fingerprint: this.fingerprint,

      avatar_url: this.avatarURL,
      guest: this.guest,
      show_as_owner: this.config.showAsOwner,

      raw: this.raw,
    };
  }
}
