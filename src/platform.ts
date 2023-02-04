import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';
import UnifiEvents from 'unifi-events';
import url from 'url';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { UnifiOccupancyPlatformAccessory } from './platformAccessory';
import { Device } from './device';

export class UnifiOccupancyPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  private unifi: UnifiEvents;

  public registeredAccessories: PlatformAccessory[] = [];
  public deviceFingerprints: object = {};

  public readonly accessPoints: Map<string, string> = new Map();
  public readonly accessoryHandlers: Map<string, UnifiOccupancyPlatformAccessory> = new Map();
  public readonly devices: Map<string, Device> = new Map();
  public readonly deviceConnectedAccessPoint: Map<string, string> = new Map();

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.setDefaultConfig();

    this.api.on('didFinishLaunching', () => {
      this.connect();

      this.loadAccessPoints()
        .then(() => this.loadDeviceFingerprints())
        .then(() => this.listenForConnections())
        .then(() => this.refreshPeriodically())
        .then(() => this.discoverDevices());
    });
  }

  setDefaultConfig() {
    this.config.interval ||= 180;
    this.config.showAsOwner ||= 'smartphone';
    this.config.deviceType ||= {};

    const deviceTypeConfig = this.config.deviceType;
    function defaultTypeConfig(property, config) {
      if (property === undefined) {
        return config;
      }

      // If property is an enabled boolean
      if (!property.enabled) {
        config.enabled = property;
        return config;
      }

      return property;
    }
    deviceTypeConfig.smartphone = defaultTypeConfig(deviceTypeConfig.smartphone, {enabled: true, lazy: false, home_accessory: false});
    deviceTypeConfig.laptop = defaultTypeConfig(deviceTypeConfig.laptop, {enabled: false, lazy: false, home_accessory: false});
    deviceTypeConfig.tablet = defaultTypeConfig(deviceTypeConfig.tablet, {enabled: false, lazy: false, home_accessory: false});
    deviceTypeConfig.smart_watch = defaultTypeConfig(deviceTypeConfig.smart_watch, {enabled: false, lazy: false, home_accessory: false});
    deviceTypeConfig.ereader = defaultTypeConfig(deviceTypeConfig.ereader, {enabled: false, lazy: false, home_accessory: false});
    deviceTypeConfig.game_console = defaultTypeConfig(deviceTypeConfig.game_console, {enabled: false, lazy: false, home_accessory: false});
    deviceTypeConfig.handheld = defaultTypeConfig(deviceTypeConfig.handheld, {enabled: false, lazy: false, home_accessory: false});
    deviceTypeConfig.other = defaultTypeConfig(deviceTypeConfig.other, {enabled: false, lazy: true, home_accessory: false});
    deviceTypeConfig.wired = defaultTypeConfig(deviceTypeConfig.wired, {enabled: false, lazy: true, home_accessory: false});
  }

  connect() {
    const controller = url.parse(this.config.unifi.controller);

    this.log.debug('Connecting with UniFi Controller...');
    this.unifi = new UnifiEvents({
      host: controller.hostname,
      port: controller.port || 443,
      username: this.config.unifi.username,
      password: this.config.unifi.password,
      site: this.config.unifi.site || 'default',
      insecure: [undefined, false].includes(this.config.unifi.secure),
      unifios: true,
      listen: true,
    });

    this.unifi.on('ctrl.disconnect', () => {
      this.log.debug('UniFi Controller disconnected, reconnecting...');
      this.unifi.connect();
      this.discoverDevices();
    });
  }

  listenForConnections() {
    this.unifi.on('*.connected', (data) => {
      this.log.debug('Client connected:', data.msg);
      this.discoverDevices();
    });

    this.unifi.on('*.roam', (data) => {
      this.log.debug('Client roamed:', data.msg);
      if (this.deviceConnectedAccessPoint.has(data.user)) {
        this.discoverDevices();
      }
    });

    this.unifi.on('*.disconnected', (data) => {
      this.log.debug('Client disconnected:', data.msg);
      if (this.deviceConnectedAccessPoint.has(data.user)) {
        this.discoverDevices();
      }
    });
  }

  refreshPeriodically() {
    setInterval(() => this.discoverDevices(), this.config.interval * 1000);
  }

  configureAccessory(accessory: PlatformAccessory) {
    this.registeredAccessories.push(accessory);
  }

  discoverDevices() {
    this.getConnectedDevices()
      .then((connectedDevices) => {
        this.deviceConnectedAccessPoint.clear();
        if (!connectedDevices) {
          return;
        }

        for (const {device, accessPoint} of connectedDevices) {
          this.devices.set(device.mac, device);
          this.deviceConnectedAccessPoint.set(device.mac, accessPoint);

          if (!device.shouldCreateAccessory(accessPoint) && !device.shouldCreateAccessory(null)) {
            continue;
          }
          this.log.debug('Detected device:', device.displayName, '@', accessPoint);

          this.ensureRegisteredAccessory(device, null);
          this.accessPoints.forEach((accessPoint) => this.ensureRegisteredAccessory(device, accessPoint));
        }
      })
      .then(() => this.updateRegisteredAccessories());
  }

  getAccessPoints() {
    this.log.debug('Getting access points...');

    return this.unifi.get(`/v2/api/site/${this.unifi.opts.site}/device`)
      .then(({network_devices}) => {
        return network_devices
          .filter(({is_access_point}) => this.config.deviceType.wired || is_access_point)
          .map(raw => {
            this.log.debug('Found access point:', raw.mac, raw.name);
            return {mac: raw.mac, name: raw.name};
          });
      })
      .catch((err) => {
        this.log.error('ERROR: Failed to get access points', err);
        throw err;
      });
  }

  loadAccessPoints() {
    return this.getAccessPoints()
      .then((res) => {
        for (const {mac, name} of res) {
          const aliasMatch = this.config.accessPointAliases?.find(({accessPoint}) => [mac, name].includes(accessPoint));
          const alias = aliasMatch ? aliasMatch.alias : name;

          this.accessPoints.set(mac, alias);
        }
      });
  }

  getDeviceFingerprints() {
    this.log.debug('Getting device fingerprints...');

    return this.unifi.get('/v2/api/fingerprint_devices/0')
      .catch((err) => {
        this.log.error('ERROR: Failed to get device fingerprints', err);
        throw err;
      });
  }

  loadDeviceFingerprints() {
    return this.getDeviceFingerprints()
      .then((data) => {
        this.log.debug('Loaded device fingerprints');
        this.deviceFingerprints = data;
      });
  }

  getConnectedDevices() {
    this.log.debug('Getting connected devices...');

    return this.unifi.get(`/v2/api/site/${this.unifi.opts.site}/clients/active`)
      .then(data => {
        return data
          .map(raw => {
            const device = new Device(raw, this);
            this.log.debug(
              'Found client:',
              device.mac,
              `"${device.name}"`,
              '-',
              device.fingerprint.name || 'Unknown',
              '—',
              device.type,
            );
            return {
              device: device,
              accessPoint: this.accessPoints.get(device.accessPointMac),
            };
          });
      })
      .catch((err) => {
        this.log.error('ERROR: Failed to get connected devices:', err);
        throw err;
      });
  }

  ensureRegisteredAccessory(device: Device, accessPoint: string | null) {
    const uuid = device.accessoryUUID(accessPoint);

    let accessory = this.registeredAccessories.find(accessory => accessory.UUID === uuid);
    if (accessory) {
      // Device fingerprint may have changed, even if its display name (in UUID) didn't.
      accessory.context.device = device.accessoryContext;
      this.api.updatePlatformAccessories([accessory]);
      return;
    }

    if (!device.shouldCreateAccessory(accessPoint)) {
      return;
    }

    const displayName = device.accessoryDisplayName(accessPoint);

    accessory = new this.api.platformAccessory(displayName, uuid);
    accessory.context.device = device.accessoryContext;
    accessory.context.accessPoint = accessPoint;

    this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
    this.registeredAccessories.push(accessory);

    this.log.debug('Registered new accessory:', displayName);
  }

  updateRegisteredAccessories() {
    const validAccessories: PlatformAccessory[] = [];
    for (const accessory of this.registeredAccessories) {
      let accessoryHandler = this.accessoryHandlers.get(accessory.UUID);
      if (!accessoryHandler) {
        accessoryHandler = new UnifiOccupancyPlatformAccessory(this, accessory);
        this.accessoryHandlers.set(accessory.UUID, accessoryHandler);
      }

      if (!accessoryHandler.valid) {
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        this.accessoryHandlers.delete(accessory.UUID);
        this.log.debug('Removed accessory:', accessory.displayName);
        continue;
      }

      validAccessories.push(accessory);

      const updated = accessoryHandler.update();

      this.log[updated ? 'info' : 'debug'](
        updated ? 'Updated accessory status:' : 'Accessory status unchanged:',
        '"' + accessory.displayName + '"',
        accessoryHandler.active ? 'active' : 'inactive',
      );
    }
    this.registeredAccessories = validAccessories;
  }
}
