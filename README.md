# Homebridge + UniFi = Occupancy

[Homebridge](https://homebridge.io) plugin that creates occupancy sensors for all smartphones on a [UniFi](https://www.ui.com/wi-fi) network.

To enable presence tracking across rooms/areas/floors, every device gets a dedicated sensor per WiFi access point, named `<Name> @ <AP>`.

AP aliases can be configured to map an AP name or MAC address to a room name, or to merge different APs into one sensor (per device).

Device aliases can be configured in the UniFi Network UI.
Generic prefixes and suffixes are filtered out to derive the owner's name, e.g. `Douwe's iPhone` becomes `Douwe`.

PS. To see these smartphones in your macOS menu bar as well, check out [XBar + UniFi = Who's Home?](https://github.com/DouweM/xbar-whos-home-unifi).

## Screenshot

<img src="screenshot.png" width="585">

## Installation

The easiest way to install and configure this plugin is via [Homebridge Config UI X](https://github.com/oznu/homebridge-config-ui-x).

Alternatively, add `homebridge-unifi-occupancy` to your Homebridge `package.json` and add the following to `config.json`:

```json
{
  "platforms": [
    {
      "platform": "UnifiOccupancy",
      "unifi": {
          "controller": "https://192.168.1.1",
          "username": "<username>",
          "password": "<password>",
          "site": "default",
          "secure": false,
          "unifios": true
      },
      "interval": 180,
      "accessPointAliases": [
          {
              "accessPoint": "Dream Machine",
              "alias": "Living"
          },
          {
              "accessPoint": "Office nanoHD",
              "alias": "Office"
          },
          {
              "accessPoint": "Bedroom nanoHD",
              "alias": "Bedroom"
          },
          {
              "accessPoint": "Roof FlexHD",
              "alias": "Rooftop"
          }
      ]
    }
  ]
}
```
