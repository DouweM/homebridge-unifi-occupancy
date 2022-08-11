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
    this.service.updateCharacteristic(this.platform.Characteristic.OccupancyDetected, this.connected);
  }
}
