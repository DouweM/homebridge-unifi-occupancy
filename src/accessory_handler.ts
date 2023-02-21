import { PlatformAccessory, Service } from 'homebridge';
import { AccessorySubject } from './accessory_subject';
import { UnifiOccupancyPlatform } from './platform';

import { AUTHOR_NAME, PLUGIN_NAME } from './settings';

export class AccessoryHandler {
  static ACCESSORY_CONTEXT_KEY = 'accessory';

  protected service: Service;

  private _active = false;
  protected _subject: AccessorySubject | null = null;

  constructor(
    protected readonly platform: UnifiOccupancyPlatform,
    protected readonly accessory: PlatformAccessory,
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

  get subject(): AccessorySubject | null {
    return this._subject;
  }

  get room(): string | null {
    return this.accessory.context.room || this.accessory.context.accessPoint;
  }

  get displayName() {
    return this.subject!.accessoryDisplayName(this.room);
  }

  get uuid() {
    return this.subject!.accessoryUUID(this.room);
  }

  get active() {
    return this.subject!.isAccessoryActive(this.room);
  }

  update() : boolean {
    this.accessory.displayName = this.displayName;
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

  get valid() : boolean {
    if (!this.subject) {
      return false;
    }

    if (this.room && ![...this.platform.rooms.values()].includes(this.room)) {
      return false;
    }

    const uuid = this.uuid;
    if (uuid !== this.accessory.UUID) {
      return false;
    }

    if (!this.subject.shouldKeepAccessory(this.room)) {
      return false;
    }

    return true;
  }
}
