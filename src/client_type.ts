import { ClientFilter } from './client_filter';
import { UnifiOccupancyPlatform } from './platform';

export class ClientType extends ClientFilter {
  constructor(
    platform: UnifiOccupancyPlatform,
    public readonly name,
    private readonly _label,
    private readonly clientTest: ((Client, any) => boolean),
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

  override get label() : string {
    return this._label;
  }

  override get clientTests() {
    return [(client) => this.clientTest(client, client.fingerprint)];
  }

  override get config() {
    return {
      showAsOwner: this.platform.config.showAsOwner === this.name,
      ...this.platform.config.deviceType[this.name],
    };
  }

  override get displayName() : string {
    return this.config.showAsOwner ? 'Anyone' : `Any ${this.label.toLowerCase()}`;
  }
}
