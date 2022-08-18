import { Service, PlatformAccessory } from 'homebridge';

import { UnifiOccupancyPlatform } from './platform';

export class UnifiOccupancyPlatformAccessory {
  private service: Service;

  public connected = false;

  constructor(
    private readonly platform: UnifiOccupancyPlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'DouweM')
      .setCharacteristic(this.platform.Characteristic.Model, 'unifi-occupancy')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, accessory.UUID);

    this.service = this.accessory.getService(this.platform.Service.OccupancySensor) ||
      this.accessory.addService(this.platform.Service.OccupancySensor);

    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.displayName);

    this.service.getCharacteristic(this.platform.Characteristic.OccupancyDetected)
      .on('get', async (callback) => {
        callback(null, this.connected);
      });
  }

  update() {
    const originalConnected = this.connected;

    const context = this.accessory.context;
    this.connected = this.platform.deviceConnectedAccessPoint.get(context.device.mac) === context.accessPoint;

    if (originalConnected === this.connected) {
      return false;
    }

    this.service.updateCharacteristic(this.platform.Characteristic.OccupancyDetected, this.connected);
    return true;
  }

  get isValid() {
    const context = this.accessory.context;
    if (!context.device || !context.accessPoint) {
      return false;
    }

    if (!Array.from(this.platform.accessPoints.values()).includes(context.accessPoint)) {
      return false;
    }

    const seenDevice = this.platform.devices.get(context.device.mac);
    if (seenDevice && seenDevice.displayName !== context.device.displayName) {
      return false;
    }

    return true;
  }
}
