import { AccessorySubject } from './accessory_subject';
import { Client } from './client';
import { UnifiOccupancyPlatform } from './platform';

export class ClientFilter extends AccessorySubject {
  get label() : string {
    return 'Filter';
  }

  get clientTests() {
    return [(client) => false];
  }

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

  get displayName() : string {
    return `Any ${this.label}`;
  }

  shouldCreateAccessory(room: string | null) : boolean {
    return room ? this.config.roomCatchallAccessory : this.config.homeCatchallAccessory;
  }

  accessoryUUIDKey(room: string | null) {
    let uuidKey = `Any ${this.label}`;
    if (room) {
      uuidKey += ` @ ${room}`;
    }
    return uuidKey;
  }

  isAccessoryActive(room: string | null) {
    return this.matchingClients.some(client => client.isConnectedTo(room));
  }
}
