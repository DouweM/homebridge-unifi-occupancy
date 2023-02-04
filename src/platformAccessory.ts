import { Service, PlatformAccessory } from 'homebridge';
import { Device } from './device';

import { UnifiOccupancyPlatform } from './platform';
import { AUTHOR_NAME, PLUGIN_NAME } from './settings';

export class UnifiOccupancyPlatformAccessory {
  private service: Service;

  private _active = false;
  private _device: Device | null = null;

  constructor(
    private readonly platform: UnifiOccupancyPlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, AUTHOR_NAME)
      .setCharacteristic(this.platform.Characteristic.Model, PLUGIN_NAME)
      .setCharacteristic(this.platform.Characteristic.SerialNumber, accessory.UUID)
      .setCharacteristic(this.platform.Characteristic.Name, accessory.displayName);

    this.service = this.accessory.getService(this.platform.Service.OccupancySensor) ||
      this.accessory.addService(this.platform.Service.OccupancySensor);

    this.service.getCharacteristic(this.platform.Characteristic.OccupancyDetected)
      .on('get', async (callback) => callback(null, this.active));
  }

  get device() {
    if (this._device) {
      return this._device;
    }

    const deviceContext = this.accessory.context.device;
    if (!deviceContext) {
      return null;
    }

    const mac = deviceContext.mac || deviceContext.raw.mac;
    this._device = this.platform.devices.get(mac) || this.deviceFromContext(deviceContext);
    return this._device;
  }

  deviceFromContext(context) {
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
    return new Device(raw, this.platform);
  }

  get accessPoint(): string | null {
    return this.accessory.context.accessPoint;
  }

  get active() {
    if (!this.device) {
      return false;
    }
    if (!this.accessPoint) {
      return this.device.connected;
    }

    return this.device.accessPoint === this.accessPoint;
  }

  update() {
    if (!this.device) {
      return false;
    }

    this.accessory.displayName = this.device.accessoryDisplayName(this.accessPoint);
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Name, this.accessory.displayName);

    const active = this.active;
    const changed = active !== this._active;
    this._active = active;

    if (changed) {
      this.service.updateCharacteristic(this.platform.Characteristic.OccupancyDetected, active);
    }

    return changed;
  }

  get valid() {
    if (!this.device) {
      return false;
    }

    if (this.accessPoint && !Array.from(this.platform.accessPoints.values()).includes(this.accessPoint)) {
      return false;
    }

    if (!this.device.shouldCreateAccessory(this.accessPoint)) {
      return false;
    }

    // If the accessory's UUID doesn't match the UUID that would be calculated
    // the next time this device connects with this AP, it's invalid.
    const deviceUUID = this.device.accessoryUUID(this.accessPoint);
    if (deviceUUID !== this.accessory.UUID) {
      return false;
    }

    // Temporary devices expire once disconnected.
    return this.device.connected || !this.device.temporary;
  }
}
