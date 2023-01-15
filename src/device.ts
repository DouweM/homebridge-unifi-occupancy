const VENDOR_NAMES = {
  320: 'iPhone',
  96: 'Samsung Galaxy',
  7: 'Google Pixel',
};

const OS_NAMES = {
  24: 'iPhone',
  56: 'Android',
};

const NAME_PATTERNS = [
  /^(.+?)['’]/, // "NAME's iPhone"
  / (?:van|de) (.+)$/, // "iPhone van NAME" (Dutch), "iPhone de NAME" (Spanish)
];
const HOSTNAME_PATTERNS = [
  /^(.+?)-s-/, // "NAME-s-Pixel"
  /^(.+?)s-iPhone$/, // "NAMEs-iPhone"
  /^iPhone(?:van|de)(.+)$/, // "iPhonevanNAME" (Dutch), "iPhonedeNAME" (Spanish)
];

export class Device {
  constructor(
    public raw: any,
  ) {

  }

  get mac() {
    return this.raw.mac;
  }

  get name() {
    return this.raw.name;
  }

  get hostname() {
    return this.raw.hostname;
  }

  get vendor() {
    return VENDOR_NAMES[this.raw.dev_vendor];
  }

  get os() {
    return OS_NAMES[this.raw.os_name];
  }

  get isPhone(){
    return [9, 12].includes(this.raw.dev_family);
  }

  get apMac(){
    return this.raw.ap_mac;
  }

  get displayName() {
    if (this.name) {
      for (const pattern of NAME_PATTERNS) {
        const match = this.name.match(pattern);
        if (match) {
          return match[1];
        }
      }
    }

    if (this.hostname) {
      for (const pattern of HOSTNAME_PATTERNS) {
        const match = this.hostname.match(pattern);
        if (match) {
          return match[1];
        }
      }
    }

    let descriptor = this.vendor || this.os || 'phone';

    const deviceName = this.name || this.hostname;
    if (deviceName) {
      descriptor += ` (${deviceName})`;
    }

    return `Unknown ${descriptor}`;
  }
}
