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

  public readonly registeredAccessories: PlatformAccessory[] = [];

  public readonly accessPoints: Map<string, string> = new Map();
  public readonly accessoryHandlers: Map<string, UnifiOccupancyPlatformAccessory> = new Map();
  public readonly devices: Map<string, Device> = new Map();
  public readonly deviceConnectedAccessPoint: Map<string, string> = new Map();

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.api.on('didFinishLaunching', () => {
      this.connect();

      this.loadAccessPoints()
        .then(() => this.listenForConnections())
        .then(() => this.refreshPeriodically())
        .then(() => this.discoverDevices());

    });
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
      unifios: [undefined, true].includes(this.config.unifi.unifios),
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
      this.log.debug('Device connected to UniFi Controller:', data.msg);
      this.discoverDevices();
    });

    this.unifi.on('*.roam', (data) => {
      this.log.debug('Device roamed on UniFi Controller:', data.msg);
      if (this.deviceConnectedAccessPoint.has(data.user)) {
        this.discoverDevices();
      }
    });

    this.unifi.on('*.disconnected', (data) => {
      this.log.debug('Device disconnected from UniFi Controller:', data.msg);
      if (this.deviceConnectedAccessPoint.has(data.user)) {
        this.discoverDevices();
      }
    });
  }

  refreshPeriodically() {
    const interval = this.config.interval || 180;
    setInterval(() => this.discoverDevices(), interval * 1000);
  }

  configureAccessory(accessory: PlatformAccessory) {
    this.registeredAccessories.push(accessory);
  }

  discoverDevices() {
    this.getConnectedDevices()
      .then((connectedDevices) => {
        this.deviceConnectedAccessPoint.clear();

        for (const {device, accessPoint} of connectedDevices) {
          this.log.debug('Found connected device @ AP:', device, accessPoint);

          this.devices.set(device.mac, device);
          this.deviceConnectedAccessPoint.set(device.mac, accessPoint);

          this.accessPoints.forEach((accessPoint) => this.ensureRegisteredAccessory(device, accessPoint));
        }
      })
      .then(() => this.updateRegisteredAccessories());
  }

  getAccessPoints() {
    this.log.debug('Getting access points from UniFi Controller...');

    return this.unifi.get('stat/device')
      .then(({data}) => {
        return data
          .filter(d => d.is_access_point)
          .map(({mac, name}) => ({mac, name}));
      })
      .catch((err) => {
        this.log.error(`ERROR: Failed to get access points: ${err.message}`);
      });
  }

  loadAccessPoints() {
    return this.getAccessPoints()
      .then((res) => {
        for (const {mac, name} of res) {
          let alias = name;
          const aliasMatch = this.config.accessPointAliases?.find(({accessPoint}) => [mac, name].includes(accessPoint));
          if (aliasMatch) {
            alias = aliasMatch.alias;
          }
          this.log.debug('Found access point:', mac, alias);

          this.accessPoints.set(mac, alias);
        }
      });
  }

  getConnectedDevices() {
    this.log.debug('Getting connected devices from UniFi Controller...');

    return this.unifi.get('stat/sta')
      .then(({data}) => {
        return data
          .filter(d => [9, 12].includes(d.dev_family) && d.ap_mac)
          .map(d => ({
            device: new Device(
              d.mac,
              d.name,
              d.hostname,
              d.device_name,
              d.dev_vendor,
              d.os_name,
            ),
            accessPoint: this.accessPoints.get(d.ap_mac),
          }));
      })
      .catch((err) => {
        this.log.error(`ERROR: Failed to get connected devices: ${err.message}`);
      });
  }

  ensureRegisteredAccessory(device: Device, accessPoint: string) {
    const displayName = `${device.displayName} @ ${accessPoint}`;
    const uuid = this.api.hap.uuid.generate(displayName);

    let accessory = this.registeredAccessories.find(accessory => accessory.UUID === uuid);
    if (accessory) {
      return;
    }

    this.log.debug('Registering new accessory:', displayName);

    accessory = new this.api.platformAccessory(displayName, uuid);
    accessory.context.device = device;
    accessory.context.accessPoint = accessPoint;

    this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
    this.registeredAccessories.push(accessory);
  }

  updateRegisteredAccessories() {
    for (const accessory of this.registeredAccessories) {
      let accessoryHandler = this.accessoryHandlers.get(accessory.UUID);
      if (!accessoryHandler) {
        accessoryHandler = new UnifiOccupancyPlatformAccessory(this, accessory);
        this.accessoryHandlers.set(accessory.UUID, accessoryHandler);
        this.api.updatePlatformAccessories([accessory]);
      }

      const context = accessory.context;
      if (!context.device || !context.accessPoint || !Array.from(this.accessPoints.values()).includes(context.accessPoint)) {
        this.log.debug('Removing accessory:', accessory.displayName);
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        continue;
      }

      const originalConnected = accessoryHandler.connected;
      accessoryHandler.connected = this.deviceConnectedAccessPoint.get(context.device.mac) === context.accessPoint;

      if (originalConnected === accessoryHandler.connected) {
        continue;
      }

      this.log.info('Updating accessory status:', accessory.displayName, accessoryHandler.connected ? 'connected' : 'disconnected');
      accessoryHandler.update();
    }
  }
}
