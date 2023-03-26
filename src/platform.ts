import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';
import UnifiEvents from 'unifi-events';
import url from 'url';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { AccessoryHandler } from './accessory_handler';
import { ClientAccessoryHandler } from './client_accessory_handler';
import { ClientTypeAccessoryHandler } from './client_type_accessory_handler';
import { Client } from './client';
import { ClientType } from './client_type';
import { AccessorySubject } from './accessory_subject';
import { ClientRule } from './client_rule';
import { ClientRuleAccessoryHandler } from './client_rule_accessory_handler';

function ensure(map, uuid, updater, builder) {
  let item = map.get(uuid) || null;
  if (item) {
    updater(item);
  } else {
    item = builder();
    if (item) {
      map.set(uuid, item);
    }
  }
  return item;
}

export class UnifiOccupancyPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  public clientTypes: ClientType[] = [];
  public clientRules: ClientRule[] = [];

  private unifi: UnifiEvents;

  public accessories: Map<string, PlatformAccessory> = new Map();
  public readonly accessoryHandlers: Map<string, AccessoryHandler> = new Map();

  public deviceFingerprints: object = {};
  public readonly rooms: Map<string, string> = new Map();

  public readonly clients: Map<string, Client> = new Map();
  public readonly clientCurrentRoom: Map<string, string> = new Map();

  ACCESSORY_HANDLERS = [
    ClientTypeAccessoryHandler,
    ClientRuleAccessoryHandler,
    ClientAccessoryHandler,
  ];

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    if (!this.parseConfig()) {
      return;
    }

    this.api.on('didFinishLaunching', () => {
      this.connect();

      this.loadDeviceFingerprints()
        .then(() => this.loadRooms())
        .then(() => this.refresh())
        .then(() => this.listenForConnections())
        .then(() => this.refreshPeriodically());
    });
  }

  parseConfig(): boolean {
    if (!this.config.unifi) {
      this.log.error('ERROR: UniFi Controller is not configured.');
      return false;
    }

    this.config.interval ||= 180;
    this.config.showAsOwner ||= 'smartphone';
    this.config.deviceType ||= {};
    this.config.clientRules ||= [];

    this.clientTypes = [
      new ClientType(
        this, 'wired', 'Wired client',
        (client, fp) => client.wired,
        {lazy: true},
      ),
      new ClientType(
        this, 'smartphone', 'Smartphone',
        (client, fp) => fp.familyIs('Smartphone', 'Apple iOS Device') || fp.nameContains('phone'),
        {roomAccessory: true},
      ),
      new ClientType(
        this, 'smart_watch', 'Smart Watch',
        (client, fp) => fp.familyIs('Wearable devices', 'Smart Watch') || fp.nameContains('watch'),
      ),
      new ClientType(
        this, 'laptop', 'Laptop',
        (client, fp) =>
          (fp.familyIs('Desktop/Laptop') && fp.nameContains('book')) || fp.nameContains('laptop', 'macbook'),
      ),
      new ClientType(
        this, 'tablet', 'Tablet',
        (client, fp) => fp.familyIs('Tablet') || fp.nameContains('tablet', 'pad', 'tab'),
      ),
      new ClientType(
        this, 'ereader', 'E-reader',
        (client, fp) => fp.familyIs('eBook Reader') || fp.nameContains('ereader'),
      ),
      new ClientType(
        this, 'game_console', 'Game Console',
        (client, fp) => fp.nameContains('Nintendo Switch', 'Steam Deck'),
      ),
      new ClientType(
        this, 'handheld', 'Handheld',
        (client, fp) => fp.familyIs('Handheld'),
        {lazy: true},
      ),
      new ClientType(
        this, 'other', 'Other wireless client',
        (client, fp) => true,
        {lazy: true},
      ),
    ];
    this.clientRules = this.config.clientRules.map(raw => new ClientRule(this, raw));

    return true;
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
      this.refresh();
    });
  }

  listenForConnections() {
    this.unifi.on('*.connected', (data) => {
      this.log.debug('Client connected:', data.msg);
      this.refresh();
    });

    this.unifi.on('*.roam', (data) => {
      this.log.debug('Client roamed:', data.msg);
      if (this.clientCurrentRoom.has(data.user)) {
        this.refresh();
      }
    });

    this.unifi.on('*.disconnected', (data) => {
      this.log.debug('Client disconnected:', data.msg);
      if (this.clientCurrentRoom.has(data.user)) {
        this.refresh();
      }
    });
  }

  refreshPeriodically() {
    setInterval(() => this.refresh(), this.config.interval * 1000);
  }

  configureAccessory(accessory: PlatformAccessory) {
    this.accessories.set(accessory.UUID, accessory);
  }

  getNetworkDevices() {
    this.log.debug('Loading network devices...');

    return this.unifi.get(`/v2/api/site/${this.unifi.opts.site}/device`)
      .then(({network_devices}) => {
        return network_devices
          .filter(({disabled}) => !disabled)
          .map(({mac, name}) => ({mac, name}));
      })
      .catch((err) => {
        this.log.error('ERROR: Failed to load network devices', err);
        throw err;
      });
  }

  loadRooms() {
    return this.getNetworkDevices()
      .then((res) => {
        for (const {mac, name} of res) {
          const aliasMatch = this.config.accessPointAliases?.find(({accessPoint}) => [mac, name].includes(accessPoint));
          const alias = aliasMatch ? aliasMatch.alias : name;

          this.rooms.set(mac, alias);

          this.log.debug('Found room:', alias, `(${name})`);
        }
      });
  }

  getDeviceFingerprints() {
    this.log.debug('Loading device fingerprints...');

    return this.unifi.get('/v2/api/fingerprint_devices/0')
      .catch((err) => {
        this.log.error('ERROR: Failed to load device fingerprints', err);
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

  getClients() {
    this.log.debug('Loading clients...');

    return this.unifi.get(`/v2/api/site/${this.unifi.opts.site}/clients/active`)
      .then(data => {
        return data;
      })
      .catch((err) => {
        this.log.error('ERROR: Failed to load clients:', err);
        throw err;
      });
  }

  refresh() {
    return this.loadClients()
      .then(() => this.refreshAccessories());
  }

  loadClients() {
    return this.getClients()
      .then(clients => {
        this.clientCurrentRoom.clear();

        for (const raw of clients) {
          const client = new Client(this, raw);
          this.clients.set(client.mac, client);

          const room = this.rooms.get(client.roomMac) || client.roomMac;
          this.clientCurrentRoom.set(client.mac, room);

          this.log.debug(
            'Found client:',
            client.name,
            '@',
            room,
            '-',
            client.fingerprint.name || 'Unknown',
            '—',
            client.type!.name,
          );
        }
      });
  }

  refreshAccessories() {
    this.removeInvalidAccessories();

    for (const subject of [...this.clients.values(), ...this.clientTypes, ...this.clientRules]) {
      this.ensureAccessory(subject, null);
      this.rooms.forEach(room => this.ensureAccessory(subject, room));
    }

    this.updateAccessories();
  }

  ensureAccessory(subject: AccessorySubject, room: string | null) {
    return ensure(
      this.accessories,
      subject.accessoryUUID(room),
      accessory => {
        this.ensureAccessoryHandler(accessory, subject, room)!;
        this.api.updatePlatformAccessories([accessory]);
      },
      () => {
        const handler = this.ensureAccessoryHandler(null, subject, room)!;
        const accessory = handler.accessory;
        if (accessory) {
          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
          this.log.debug('Registered new accessory:', accessory.displayName);
        }
        return accessory;
      },
    );
  }

  removeInvalidAccessories() {
    const invalidAccessories: PlatformAccessory[] = [];

    this.accessories.forEach((accessory, uuid) => {
      const handler = this.ensureAccessoryHandler(accessory);
      if (!handler?.valid) {
        invalidAccessories.push(accessory);
      }
    });

    for (const accessory of invalidAccessories) {
      this.removeAccessory(accessory);
    }
  }

  updateAccessories() {
    this.accessories.forEach((accessory, uuid) => {
      const handler = this.ensureAccessoryHandler(accessory);
      this.updateAccessoryHandler(handler);
    });
  }

  removeAccessory(accessory: PlatformAccessory) {
    this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
    this.accessories.delete(accessory.UUID);
    this.accessoryHandlers.delete(accessory.UUID);
    this.log.debug('Removed accessory:', accessory.displayName);
  }

  updateAccessoryHandler(handler: AccessoryHandler) {
    const updated = handler.update();

    this.log[updated ? 'info' : 'debug'](
      updated ? 'Updated accessory status:' : 'Accessory status unchanged:',
      `"${handler.displayName}"`,
      handler.active ? 'active' : 'inactive',
    );

    return updated;
  }

  private ensureAccessoryHandler(accessory?: PlatformAccessory | null, subject?: AccessorySubject, room?: string | null) {
    return ensure(
      this.accessoryHandlers,
      accessory ? accessory.UUID : subject!.accessoryUUID(room!),
      handler => {
        subject ||= this.clients.get(handler.subject.mac);
        if (subject) {
          handler.subject = subject;
        }
        if (room) {
          handler.room = room;
        }
      },
      () => {
        const handlerClass = this.ACCESSORY_HANDLERS.find(handlerClass => {
          return accessory ? handlerClass.supportsAccessory(accessory) : handlerClass.supportsSubject(subject!);
        });
        return handlerClass ? new handlerClass(this, accessory, subject, room) : null;
      },
    );
  }
}
