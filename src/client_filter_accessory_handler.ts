import { AccessoryHandler } from './accessory_handler';
import { ClientFilter } from './client_filter';

export abstract class ClientFilterAccessoryHandler extends AccessoryHandler {
  get filter() {
    return this.subject as ClientFilter;
  }

  protected override shouldHaveAccessory() : boolean {
    return this.room ? this.config.roomCatchallAccessory : this.config.homeCatchallAccessory;
  }

  override get active() {
    return this.filter.matchingClients.some(client => client.isInRoom(this.room));
  }
}
