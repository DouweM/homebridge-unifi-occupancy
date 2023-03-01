import { ClientFilter } from './client_filter';
import { UnifiOccupancyPlatform } from './platform';

export class ClientRule extends ClientFilter {
  static ACCESSORY_CONTEXT_KEY = 'clientRule';

  private _clientTests;

  constructor(
    platform: UnifiOccupancyPlatform,
    public raw,
  ) {
    super(platform);
  }

  get label() : string {
    return this.raw.label;
  }

  get clientTests() {
    if (this._clientTests) {
      return this._clientTests;
    }

    this._clientTests = (this.raw.namePatterns || []).map(pattern => {
      if (pattern.startsWith('/') && pattern.endsWith('/')) {
        return (client) => client.name.match(new RegExp(pattern.slice(1, -1), 'i'));
      } else {
        return (client) => client.name.toLowerCase() === pattern.toLowerCase();
      }
    });
    return this._clientTests;
  }

  get config() {
    return {
      roomAccessory: this.raw.roomAccessory,
      homeAccessory: this.raw.homeAccessory,
      roomCatchallAccessory: this.raw.roomCatchallAccessory,
      homeCatchallAccessory: this.raw.homeCatchallAccessory,
      lazy: this.raw.lazy,
    };
  }

  get accessoryContext() {
    return {
      label: this.label,
    };
  }
}
