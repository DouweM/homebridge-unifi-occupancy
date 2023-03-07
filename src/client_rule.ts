import { Memoize } from 'typescript-memoize';

import { ClientFilter } from './client_filter';
import { UnifiOccupancyPlatform } from './platform';

export class ClientRule extends ClientFilter {
  constructor(
    platform: UnifiOccupancyPlatform,
    public readonly raw,
  ) {
    super(platform);
  }

  override get label() : string {
    return this.raw.label;
  }

  @Memoize()
  override get clientTests() {
    return (this.raw.namePatterns || []).map(pattern => {
      if (pattern.startsWith('/') && pattern.endsWith('/')) {
        return (client) => client.name.match(new RegExp(pattern.slice(1, -1), 'i'));
      } else {
        return (client) => client.name.toLowerCase() === pattern.toLowerCase();
      }
    });
  }

  override get config() {
    return {
      roomAccessory: this.raw.roomAccessory,
      homeAccessory: this.raw.homeAccessory,
      roomCatchallAccessory: this.raw.roomCatchallAccessory,
      homeCatchallAccessory: this.raw.homeCatchallAccessory,
      lazy: this.raw.lazy,
    };
  }
}
