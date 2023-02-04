const TYPE_TESTS = {
  'smartphone':   (familyIs, nameContains) => familyIs('Smartphone', 'Apple iOS Device') || nameContains('phone'),
  'laptop':       (familyIs, nameContains) => (familyIs('Desktop/Laptop') && nameContains('book')) || nameContains('laptop', 'macbook'),
  'tablet':       (familyIs, nameContains) => familyIs('Tablet') || nameContains('tablet', 'pad', 'tab'),
  'smart_watch':  (familyIs, nameContains) => familyIs('Wearable devices', 'Smart Watch') || nameContains('watch'),
  'ereader':      (familyIs, nameContains) => familyIs('eBook Reader') || nameContains('ereader'),
  'game_console': (familyIs, nameContains) => nameContains('Nintendo Switch', 'Steam Deck'),
  'handheld':     (familyIs, nameContains) => familyIs('Handheld'),
};

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

export class Device {
  private _fingerprint;

  constructor(
    public raw,
    private platform,
  ) {
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

  get accessPoint() : string {
    return this.platform.deviceConnectedAccessPoint.get(this.mac);
  }

  get connected() : boolean {
    return !!this.accessPoint;
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

    return this._fingerprint;
  }

  get type(): string {
    if (this.wired) {
      return 'wired';
    }

    const fingerprint = this.fingerprint;
    const name = this.name;

    function familyIs(...values) {
      return values.some(value => [fingerprint.type, fingerprint.family].includes(value));
    }
    function nameContains(...values) {
      return values.some(value =>
        [fingerprint.name, name].some(name =>
          name && name.toLowerCase().includes(value.toLowerCase()),
        ),
      );
    }

    for (const type in TYPE_TESTS) {
      if (TYPE_TESTS[type](familyIs, nameContains)){
        return type;
      }
    }

    return 'other';
  }

  get stationary() : boolean {
    return this.wired || this.type === 'other';
  }

  get shouldShowAsOwner() : boolean {
    return this.platform.config.showAsOwner === this.type;
  }

  get owner(): string | null {
    return ownerFromName(this.raw.name, NAME_OWNER_PATTERNS) || ownerFromName(this.hostname, HOSTNAME_OWNER_PATTERNS);
  }

  get temporary() : boolean {
    return this.shouldShowAsOwner && !this.owner;
  }

  get displayName() : string {
    if (this.shouldShowAsOwner) {
      return this.owner || `Guest: ${this.name}`;
    }
    return this.name;
  }

  shouldCreateAccessory(accessPoint) : boolean {
    if (!this.platform.config.deviceType![this.type]) {
      return false;
    }

    if (this.stationary && this.accessPoint !== accessPoint) {
      return false;
    }

    return true;
  }

  accessoryUUID(accessPoint = this.accessPoint) {
    // "<Device> @ <AP>" to ensure backward compatibility
    return this.platform.api.hap.uuid.generate(`${this.displayName} @ ${accessPoint}`);
  }

  accessoryDisplayName(accessPoint = this.accessPoint) {
    // "<AP> <Device>" so the "<AP>" prefix is hidden by the Home app if it matches the room name
    return `${accessPoint} ${this.displayName}`;
  }

  get accessoryContext() {
    return {
      raw: this.raw,
    };
  }
}
