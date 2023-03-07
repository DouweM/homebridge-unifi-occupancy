import { AccessorySubject } from './accessory_subject';
import { Client } from './client';

export abstract class ClientFilter extends AccessorySubject {
  abstract get label() : string;

  protected abstract get clientTests(): ((Client) => boolean)[];

  matchesClient(client: Client): boolean {
    return this.clientTests.some(test => test(client));
  }

  get matchingClients(): Client[] {
    return [...this.platform.clients.values()].filter(client => this.matchesClient(client));
  }

  get config() {
    return {
      roomAccessory: false,
      homeAccessory: false,
      roomCatchallAccessory: false,
      homeCatchallAccessory: false,
      lazy: false,
    };
  }

  override get displayName() : string {
    return `Any ${this.label}`;
  }

  override accessoryUUIDKey(room: string | null) {
    let uuidKey = `Any ${this.label}`;
    if (room) {
      uuidKey += ` @ ${room}`;
    }
    return uuidKey;
  }
}
