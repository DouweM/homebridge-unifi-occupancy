import { Client } from './client';
import { AccessoryHandler } from './accessory_handler';

export class ClientAccessoryHandler extends AccessoryHandler {
  static ACCESSORY_CONTEXT_KEY = Client.ACCESSORY_CONTEXT_KEY;

  get subject() {
    if (this._subject) {
      return this._subject;
    }

    const context = this.accessory.context[Client.ACCESSORY_CONTEXT_KEY];
    if (!context) {
      return null;
    }

    const mac = context.mac || context.raw.mac;
    this._subject = this.platform.clients.get(mac) || this.clientFromContext(context);
    return this._subject;
  }

  get client(): Client {
    return this.subject as Client;
  }

  clientFromContext(context) {
    const raw = context.raw || {
      mac:      context.mac,
      name:     context.name,
      hostname: context.hostname,
      is_wired: false,
      fingerprint: {
        dev_family: 9, // Smartphone
        dev_cat:    44, // Smartphone
        dev_vendor: context.vendor,
        os_name:    context.os,
      },
    };
    if (!raw.fingerprint) {
      raw.fingerprint = {
        dev_family:       raw.dev_family,
        dev_cat:          raw.dev_cat,
        dev_vendor:       raw.dev_vendor,
        os_name:          raw.os_name,
        computed_dev_id:  raw.dev_id,
      };
    }
    return new Client(raw, this.platform);
  }
}
