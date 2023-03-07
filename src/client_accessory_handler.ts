import { Client } from './client';
import { AccessoryHandler } from './accessory_handler';

export class ClientAccessoryHandler extends AccessoryHandler {
  static override SUBJECT_CLASS_NAME = Client.name;
  static override SUBJECT_CONTEXT_KEY = 'device';

  protected override subjectFromContext(context) {
    const client = this.platform.clients.get(context.mac || context.raw.mac);
    if (client) {
      return client;
    }

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

    return new Client(this.platform, raw);
  }

  get client(): Client {
    return this.subject as Client;
  }

  protected override shouldHaveAccessory(existingAccessory) : boolean {
    if (!this.room) {
      return this.config.homeAccessory;
    }

    if (!this.config.roomAccessory) {
      return false;
    }

    if (existingAccessory) {
      return this.client.connected || !this.client.guest;
    }

    if (this.config.lazy || this.client.guest) {
      return this.client.isInRoom(this.room);
    }

    return true;
  }

  override get active() {
    return this.client.isInRoom(this.room);
  }

  override get subjectContext() {
    return {
      raw: this.client.raw,
    };
  }
}
