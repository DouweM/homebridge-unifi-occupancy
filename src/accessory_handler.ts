import { PlatformAccessory, Service } from 'homebridge';
import { Memoize, clear as clearMemoize } from 'typescript-memoize';
import { AccessorySubject } from './accessory_subject';
import { UnifiOccupancyPlatform } from './platform';

import { AUTHOR_NAME, PLUGIN_NAME } from './settings';

export abstract class AccessoryHandler {
  static SUBJECT_CLASS_NAME = AccessorySubject.name;
  static SUBJECT_CONTEXT_KEY = 'accessory';

  static supportsAccessory(accessory: PlatformAccessory) {
    return !!accessory.context[this.SUBJECT_CONTEXT_KEY];
  }

  static supportsSubject(subject: AccessorySubject) {
    return subject.constructor.name === this.SUBJECT_CLASS_NAME;
  }

  protected service?: Service | null;

  private _active = false;
  private _subject? : AccessorySubject | null;
  private _room? : string | null;

  constructor(
    protected readonly platform: UnifiOccupancyPlatform,
    protected readonly _accessory?: PlatformAccessory | null,
    _subject?: AccessorySubject | null,
    _room?: string | null,
  ) {
    if (!_accessory && !_subject) {
      throw new Error('AccessoryHandler needs at least one of accessory and subject.');
    }

    if (_subject) {
      this.subject = _subject;
    }
    if (_room) {
      this.room = _room;
    }
    if (this.accessory) {
      this.setupAccessory();
    }
  }

  @Memoize()
  get accessory() : PlatformAccessory | null {
    if (this._accessory) {
      return this._accessory;
    }

    const subject = this._subject;
    const room = this._room;

    if (!subject || !room) {
      return null;
    }

    if (!this.shouldHaveAccessory()) {
      return null;
    }

    return new this.platform.api.platformAccessory(this.displayName, this.uuid);
  }

  setupAccessory() {
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
    if (!this._subject) {
      this._subject = this.subjectFromContext(this.accessory!.context[this.subjectContextKey]) || null;
    }
    return this._subject;
  }

  set subject(newSubject: AccessorySubject | null) {
    this._subject = newSubject;
    if (newSubject && this.accessory) {
      this.accessory.context[this.subjectContextKey] = this.subjectContext;
    }
  }

  get room(): string | null {
    return this._room || this.accessory!.context.room;
  }

  set room(newRoom: string | null) {
    this._room = newRoom;
    if (newRoom && this.accessory) {
      this.accessory.context.room = newRoom;
    }
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

    if (this.room && ![...this.platform.rooms.values()].includes(this.room)) {
      return false;
    }

    const uuid = this.uuid;
    if (uuid !== this.accessory.UUID) {
      return false;
    }

    if (!this.shouldHaveAccessory(this.accessory)) {
      return false;
    }

    return true;
  }

  abstract get subjectContext() : object;
}
