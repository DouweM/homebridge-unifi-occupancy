const vendors = {
  320: 'iPhone',
  96: 'Samsung Galaxy',
  7: 'Google Pixel',
};

const oses = {
  24: 'iPhone',
  56: 'Android',
};

const namePatterns = [
  /^(.+?)['’]/, // "NAME's iPhone"
  / (?:van|de) (.+)$/, // "iPhone van NAME" (Dutch), "iPhone de NAME" (Spanish)
];
const hostnamePatterns = [
  /^(.+?)-s-/, // "NAME-s-Pixel"
  /^(.+?)s-iPhone$/, // "NAMEs-iPhone"
  /^iPhone(?:van|de)(.+)$/, // "iPhonevanNAME" (Dutch), "iPhonedeNAME" (Spanish)
];

export class Device {
  constructor(
    public mac: string,
    public name: string,
    public hostname: string,
    public deviceName: string,
    public vendor: number,
    public os: number,
  ) { }

  get displayName() {
    if (this.name) {
      for (const pattern of namePatterns) {
        const match = this.name.match(pattern);
        if (match) {
          return match[1];
        }
      }
    }

    if (this.hostname) {
      for (const pattern of hostnamePatterns) {
        const match = this.hostname.match(pattern);
        if (match) {
          return match[1];
        }
      }
    }

    let descriptor = vendors[this.vendor] || oses[this.os] || 'phone';

    const deviceName = this.name || this.hostname || this.deviceName;
    if (deviceName) {
      descriptor += ` (${deviceName})`;
    }

    return `Unknown ${descriptor}`;
  }
}
