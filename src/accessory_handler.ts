import { PlatformAccessory, Service } from 'homebridge';
import { AccessorySubject } from './accessory_subject';
import { UnifiOccupancyPlatform } from './platform';

import { AUTHOR_NAME, PLUGIN_NAME } from './settings';

export abstract class AccessoryHandler {
  static SUBJECT_CLASS_NAME = AccessorySubject.name;
  static SUBJECT_CONTEXT_KEY = 'accessory';
  static ROOM_CONTEXT_KEY = 'room';

  static supportsAccessory(accessory: PlatformAccessory) {
    return !!accessory.context[this.SUBJECT_CONTEXT_KEY];
  }

  static supportsSubject(subject: AccessorySubject) {
    return subject.constructor.name === this.SUBJECT_CLASS_NAME;
  }

  protected service?: Service | null;

  private _active = false;
  private _buildingAccessory = false;

  constructor(
    protected readonly platform: UnifiOccupancyPlatform,
    protected _accessory?: PlatformAccessory | null,
    private _subject?: AccessorySubject | null,
    private _room?: string | null,
  ) {
    if (!_accessory && !_subject) {
      throw new Error('AccessoryHandler needs at least one of accessory and subject.');
    }

    if (this.accessory) {
      this.setupAccessory();
    }
  }

  get accessory() : PlatformAccessory | null {
    // Break recursion when this.shouldHaveAccessory, this.displayName, or this.uuid
    // read this.subject or this.room, which can use this.accessory.
    if (this._buildingAccessory) {
      return null;
    }

    if (!this._accessory && this._subject) {
      this._buildingAccessory = true;
      if (this.shouldHaveAccessory()) {
        this._accessory = new this.platform.api.platformAccessory(this.displayName, this.uuid);
      }
      this._buildingAccessory = false;
    }

    return this._accessory || null;
  }

  setAccessoryContext() {
    if (!this.accessory) {
      return;
    }

    this.accessory.context = {
      [this.subjectContextKey]: this.subjectContext,
      [AccessoryHandler.ROOM_CONTEXT_KEY]: this.room,
    };
  }

  setupAccessory() {
    this.setAccessoryContext();

    const accessory = this.accessory!;

    accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, AUTHOR_NAME)
      .setCharacteristic(this.platform.Characteristic.Model, PLUGIN_NAME)
      .setCharacteristic(this.platform.Characteristic.SerialNumber, this.uuid)
      .setCharacteristic(this.platform.Characteristic.Name, this.displayName);

    this.service = accessory.getService(this.platform.Service.OccupancySensor) ||
      accessory.addService(this.platform.Service.OccupancySensor);

    this.service.getCharacteristic(this.platform.Characteristic.OccupancyDetected)
      .on('get', async (callback) => callback(null, this.active));
  }

  protected abstract subjectFromContext(context): AccessorySubject | null;

  get subjectContextKey() {
    return (<typeof AccessoryHandler>this.constructor).SUBJECT_CONTEXT_KEY;
  }

  get subject(): AccessorySubject | null {
    if (!this._subject && this.accessory) {
      this._subject = this.subjectFromContext(this.accessory.context[this.subjectContextKey]);
    }
    return this._subject || null;
  }

  set subject(subject: AccessorySubject | null) {
    this._subject = subject;
    this.setAccessoryContext();
  }

  get room(): string | null {
    return this._room || this.accessory?.context[AccessoryHandler.ROOM_CONTEXT_KEY];
  }

  set room(room: string | null) {
    this._room = room;
    this.setAccessoryContext();
  }

  get displayName() {
    const displayName = this.subject!.displayName;
    if (this.room && displayName.startsWith(this.room)) {
      return displayName;
    }

    return `${this.room || 'Anywhere'} ${displayName}`;
  }

  get uuid() {
    return this.subject!.accessoryUUID(this.room);
  }

  abstract get active();

  get config() {
    return this.subject!.config;
  }

  protected abstract shouldHaveAccessory(existingAccessory?: PlatformAccessory | null) : boolean;

  update() : boolean {
    const accessory = this.accessory!;

    accessory.displayName = this.displayName;
    accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Name, accessory.displayName);

    const active = this.active;
    const changed = active !== this._active;
    this._active = active;

    if (changed) {
      this.service!.updateCharacteristic(this.platform.Characteristic.OccupancyDetected, active);
    }

    return changed;
  }

  get valid() : boolean {
    if (!this.subject || !this.accessory) {
      return false;
    }

    const uuid = this.uuid;
    if (uuid !== this.accessory.UUID) {
      return false;
    }

    if (this.room && ![...this.platform.rooms.values()].includes(this.room)) {
      return false;
    }

    if (!this.shouldHaveAccessory(this.accessory)) {
      return false;
    }

    return true;
  }

  abstract get subjectContext() : object;
}
