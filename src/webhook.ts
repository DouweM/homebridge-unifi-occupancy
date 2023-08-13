import { Client } from './client';

export class Webhook {
  constructor(public readonly raw) {
  }

  get url() {
    return this.raw.url;
  }

  get username() {
    return this.raw.auth?.username;
  }

  get password() {
    return this.raw.auth?.password;
  }

  get onlyShowAsOwner() {
    return this.raw.onlyShowAsOwner;
  }

  get events() {
    return this.raw.events;
  }

  async trigger(event: string, client: Client) {
    if (!this.events[event]) {
      return null;
    }

    if (this.onlyShowAsOwner && !client.config.showAsOwner) {
      return null;
    }

    const payload = {
      'event': event,
      'client': client.asJSON,
    };

    const headers = {'Content-Type': 'application/json'};
    if (this.username && this.password) {
      headers['Authorization'] = 'Basic ' + Buffer.from(this.username + ':' + this.password).toString('base64');
    }

    const response = await global.fetch(
      this.url,
      {
        method: 'post',
        body: JSON.stringify(payload),
        headers: headers,
      },
    );

    return response.ok;
  }
}
