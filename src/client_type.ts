import { ClientFilter } from './client_filter';
import { UnifiOccupancyPlatform } from './platform';

export class ClientType extends ClientFilter {
  static ACCESSORY_CONTEXT_KEY = 'clientType';

  constructor(
    platform: UnifiOccupancyPlatform,
    public name,
    private _label,
    private clientTest,
    defaultConfig = {},
  ) {
    super(platform);

    function defaultTypeConfig(property, config) {
      if (property === undefined) {
        return config;
      }

      // Backward compatibility: property is a boolean
      if ([true, false].includes(property)) {
        config.roomAccessory = property;
      } else {
        config = {...config, ...property};
        if (config.enabled !== undefined) {
          config.roomAccessory = config.enabled;
          delete config.enabled;
        }
      }


      return config;
    }

    const config = platform.config.deviceType;
    config[name] = defaultTypeConfig(
      config[name],
      {
        roomAccessory: false,
        homeAccessory: false,
        roomCatchallAccessory: false,
        homeCatchallAccessory: false,
        lazy: false,
        ...defaultConfig,
      },
    );
  }

  get label() : string {
    return this._label;
  }

  get clientTests() {
    return [(client) => this.clientTest(client, client.fingerprint)];
  }

  get config() {
    return {
      showAsOwner: this.platform.config.showAsOwner === this.name,
      ...this.platform.config.deviceType[this.name],
    };
  }

  get displayName() : string {
    return this.config.showAsOwner ? 'Anyone' : `Any ${this.label.toLowerCase()}`;
  }

  get accessoryContext() {
    return {
      name: this.name,
    };
  }
}
